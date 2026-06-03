<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DiscrepancyController extends Controller
{
    /**
     * Get items with current stock per location for discrepancy counting.
     */
    public function getItems(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = $perPage > 0 ? min($perPage, 100) : 15;

        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', 'location_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id', 'location_id');

        $query = DB::table('items as i')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', fn ($j) => $j->on('i.item_id', '=', 's.item_id'))
            ->leftJoin('locations as l', 's.location_id', '=', 'l.location_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'c.category_name',
                'i.measurement_unit',
                'i.image_url',
                'l.location_id',
                'l.location_name',
                'l.location_code',
                DB::raw('COALESCE(s.current_stock, 0) as recorded_stock')
            )
            ->where('i.is_active', true)
            ->orderBy('l.location_name')
            ->orderBy('i.item_description');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('c.category_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('i.category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('s.location_id', (int) $request->input('location_id'));
        }

        $items = $query->paginate($perPage);
        $items->setCollection(
            $items->getCollection()->map(function ($item) {
                $item->recorded_stock = (int) $item->recorded_stock;
                $item->image_url = $this->resolveImageUrl($item->image_url ?? null);
                return $item;
            })
        );

        return response()->json([
            'success' => true,
            'message' => 'Items retrieved successfully.',
            'data' => $items,
        ]);
    }

    /**
     * Record a discrepancy update — adjusts stock to the physical count value.
     */
    public function createDiscrepancy(Request $request)
    {
        $validated = $request->validate([
            'item_id'          => ['required', 'integer', 'exists:items,item_id'],
            'location_id'      => ['nullable', 'integer', 'exists:locations,location_id'],
            'physical_count'   => ['required', 'integer', 'min:0'],
            'reason'           => ['required', 'string', 'max:255'],
            'notes'            => ['nullable', 'string', 'max:1000'],
        ]);

        $itemId     = (int) $validated['item_id'];
        $locationId = isset($validated['location_id']) ? (int) $validated['location_id'] : null;

        // Get current recorded stock for the item (optionally at a specific location)
        $stockQuery = DB::table('inventory_batches')
            ->where('item_id', $itemId)
            ->where('status', 'active');

        if ($locationId !== null && Schema::hasColumn('inventory_batches', 'location_id')) {
            $stockQuery->where('location_id', $locationId);
        }

        $recordedStock  = (int) $stockQuery->sum('quantity');
        $physicalCount  = (int) $validated['physical_count'];
        $variance       = $physicalCount - $recordedStock; // positive = surplus, negative = shortage

        if ($variance === 0) {
            return response()->json([
                'success' => false,
                'message' => 'No discrepancy found. Physical count matches recorded stock.',
                'data'    => [
                    'recorded_stock'  => $recordedStock,
                    'physical_count'  => $physicalCount,
                    'variance'        => 0,
                ],
            ], 422);
        }

        $item = DB::table('items')
            ->select('item_id', 'item_code', 'item_description')
            ->where('item_id', $itemId)
            ->first();

        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Item not found.'], 404);
        }

        $user        = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference   = 'DISC-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        try {
            $result = DB::transaction(function () use (
                $item, $itemId, $locationId, $recordedStock, $physicalCount, $variance,
                $validated, $performedBy, $reference
            ) {
                if ($variance > 0) {
                    // Surplus — add a new batch
                    $batchInsert = [
                        'item_id'      => $itemId,
                        'batch_number' => 'DISC-SURPLUS-' . now()->format('YmdHis'),
                        'quantity'     => $variance,
                        'status'       => 'active',
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ];

                    if (Schema::hasColumn('inventory_batches', 'location_id')) {
                        $batchInsert['location_id'] = $locationId;
                    }

                    $batchId = DB::table('inventory_batches')->insertGetId($batchInsert);
                } else {
                    // Shortage — deduct from existing batches (FEFO)
                    $toDeduct = abs($variance);
                    $batchId  = null;

                    $batches = DB::table('inventory_batches')
                        ->select('batch_id', 'quantity')
                        ->where('item_id', $itemId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0)
                        ->when(
                            $locationId !== null && Schema::hasColumn('inventory_batches', 'location_id'),
                            fn ($q) => $q->where('location_id', $locationId)
                        )
                        ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                        ->orderBy('created_at')
                        ->lockForUpdate()
                        ->get();

                    foreach ($batches as $batch) {
                        if ($toDeduct <= 0) {
                            break;
                        }

                        $deduct = min($toDeduct, (int) $batch->quantity);
                        if ($deduct <= 0) {
                            continue;
                        }

                        if ($batchId === null) {
                            $batchId = (int) $batch->batch_id;
                        }

                        $newQty = ((int) $batch->quantity) - $deduct;
                        DB::table('inventory_batches')
                            ->where('batch_id', $batch->batch_id)
                            ->update([
                                'quantity'   => $newQty,
                                'status'     => $newQty <= 0 ? 'depleted' : 'active',
                                'updated_at' => now(),
                            ]);

                        $toDeduct -= $deduct;
                    }
                }

                $txInsert = [
                    'item_id'          => $itemId,
                    'batch_id'         => $batchId ?? null,
                    'transaction_type' => 'DISCREPANCY',
                    'quantity'         => $variance,          // positive=surplus, negative=shortage
                    'reference_number' => $reference,
                    'transaction_date' => now(),
                    'reason'           => $validated['reason'],
                    'notes'            => $this->buildNotes($variance, $validated['notes'] ?? null),
                    'performed_by'     => $performedBy,
                    'created_at'       => now(),
                ];

                if (Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                    $txInsert['from_location_id'] = $locationId;
                }

                if (Schema::hasColumn('inventory_transactions', 'to_location_id')) {
                    $txInsert['to_location_id'] = $locationId;
                }

                DB::table('inventory_transactions')->insert($txInsert);

                return [
                    'reference_number' => $reference,
                    'item_id'          => (int) $item->item_id,
                    'item_code'        => (string) $item->item_code,
                    'item_description' => (string) $item->item_description,
                    'location_id'      => $locationId,
                    'recorded_stock'   => $recordedStock,
                    'physical_count'   => $physicalCount,
                    'variance'         => $variance,
                    'new_stock'        => $physicalCount,
                    'discrepancy_type' => $variance > 0 ? 'surplus' : 'shortage',
                ];
            });

            AuditLogService::log(
                'inventory_transactions',
                $itemId,
                'UPDATE',
                null,
                $result,
                $request,
                $performedBy
            );

            return response()->json([
                'success' => true,
                'message' => 'Discrepancy recorded successfully.',
                'data'    => $result,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record discrepancy.',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Get discrepancy transaction history for the monitoring page.
     */
    public function index(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 20), 100);

        $query = DB::table('inventory_transactions as t')
            ->join('items as i', 't.item_id', '=', 'i.item_id')
            ->leftJoin('users as u', 't.performed_by', '=', 'u.user_id')
            ->leftJoin('inventory_batches as b', 't.batch_id', '=', 'b.batch_id')
            ->leftJoin('locations as bl', 'b.location_id', '=', 'bl.location_id')
            ->leftJoin('locations as fl', 't.from_location_id', '=', 'fl.location_id')
            ->select(
                't.transaction_id',
                't.transaction_type',
                't.quantity',
                't.reference_number',
                't.transaction_date',
                't.reason',
                't.notes',
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                'b.batch_number',
                'bl.location_name as batch_location_name',
                'fl.location_name as from_location_name',
                DB::raw("CONCAT(u.first_name, ' ', u.last_name) as performed_by_name"),
                't.created_at'
            )
            ->where('t.transaction_type', 'DISCREPANCY')
            ->orderByDesc('t.transaction_date');

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('i.item_code', 'like', "%{$s}%")
                    ->orWhere('i.item_description', 'like', "%{$s}%")
                    ->orWhere('t.reference_number', 'like', "%{$s}%")
                    ->orWhere('bl.location_name', 'like', "%{$s}%")
                    ->orWhere('fl.location_name', 'like', "%{$s}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('t.transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('t.transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('location_id')) {
            $locationId = (int) $request->input('location_id');
            $query->where(function ($builder) use ($locationId) {
                $builder->where('b.location_id', $locationId)
                    ->orWhere('t.from_location_id', $locationId);
            });
        }

        if ($request->filled('discrepancy_type')) {
            $type = $request->input('discrepancy_type');
            if ($type === 'surplus') {
                $query->where('t.quantity', '>', 0);
            } elseif ($type === 'shortage') {
                $query->where('t.quantity', '<', 0);
            }
        }

        $results = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Discrepancy records retrieved successfully.',
            'data'    => $results,
        ]);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function buildNotes(int $variance, ?string $notes): string
    {
        $type  = $variance > 0 ? 'SURPLUS (+' . $variance . ')' : 'SHORTAGE (' . $variance . ')';
        $parts = ['Discrepancy: ' . $type];
        $notes = $this->nullIfEmpty($notes);
        if ($notes) {
            $parts[] = 'Notes: ' . $notes;
        }

        return implode(' | ', $parts);
    }

    private function nullIfEmpty(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function resolveImageUrl(?string $storedValue): ?string
    {
        if (!$storedValue) {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $storedValue)) {
            return $storedValue;
        }

        $path = ltrim($storedValue, '/');
        if (str_starts_with($path, 'storage/')) {
            return url($path);
        }

        return url('storage/' . $path);
    }
}
