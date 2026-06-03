<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ItemTransferController extends Controller
{
    /**
     * Items that have stock in at least one location — for the card catalog.
     */
    public function getTransferableItems(Request $request)
    {
        $perPage = (int) $request->input('per_page', 12);
        $perPage = $perPage > 0 ? min($perPage, 100) : 12;

        // Total stock per item (all locations)
        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        $query = DB::table('items as i')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', fn ($j) => $j->on('i.item_id', '=', 's.item_id'))
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'c.category_name',
                'i.measurement_unit',
                'i.image_url',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock')
            )
            ->where('i.is_active', true)
            ->whereRaw('COALESCE(s.current_stock, 0) > 0')
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

        $items = $query->paginate($perPage);
        $items->setCollection(
            $items->getCollection()->map(function ($item) {
                $item->current_stock = (int) $item->current_stock;
                $item->image_url     = $this->resolveImageUrl($item->image_url ?? null);

                // Stock breakdown per location for this item
                $item->locations = DB::table('inventory_batches as b')
                    ->join('locations as l', 'b.location_id', '=', 'l.location_id')
                    ->where('b.item_id', $item->item_id)
                    ->where('b.status', 'active')
                    ->whereNotNull('b.location_id')
                    ->groupBy('l.location_id', 'l.location_code', 'l.location_name')
                    ->having(DB::raw('COALESCE(SUM(b.quantity), 0)'), '>', 0)
                    ->orderBy('l.location_name')
                    ->get([
                        'l.location_id',
                        'l.location_code',
                        'l.location_name',
                        DB::raw('COALESCE(SUM(b.quantity), 0) as stock'),
                    ])
                    ->map(fn ($loc) => [
                        'location_id'   => (int) $loc->location_id,
                        'location_code' => $loc->location_code,
                        'location_name' => $loc->location_name,
                        'stock'         => (int) $loc->stock,
                    ])
                    ->values();

                return $item;
            })
        );

        return response()->json([
            'success' => true,
            'message' => 'Transferable items retrieved successfully.',
            'data'    => $items,
        ]);
    }

    /**
     * All locations available as a transfer destination.
     */
    public function getDestinationLocations(Request $request)
    {
        $locations = DB::table('locations')
            ->where('is_active', true)
            ->orderBy('location_name')
            ->get(['location_id', 'location_code', 'location_name', 'location_type'])
            ->map(fn ($l) => [
                'location_id'   => (int) $l->location_id,
                'location_code' => $l->location_code,
                'location_name' => $l->location_name,
                'location_type' => $l->location_type,
            ])
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Destination locations retrieved successfully.',
            'data'    => $locations,
        ]);
    }

    /**
     * Execute the transfer: deduct from source location (FEFO), add to destination.
     */
    public function createTransfer(Request $request)
    {
        $validated = $request->validate([
            'item_id'              => ['required', 'integer', 'exists:items,item_id'],
            'from_location_id'     => ['required', 'integer', 'exists:locations,location_id'],
            'to_location_id'       => ['required', 'integer', 'exists:locations,location_id'],
            'quantity'             => ['required', 'integer', 'min:1'],
            'reason'               => ['nullable', 'string', 'max:255'],
            'notes'                => ['nullable', 'string', 'max:1000'],
        ]);

        $itemId       = (int) $validated['item_id'];
        $fromLocId    = (int) $validated['from_location_id'];
        $toLocId      = (int) $validated['to_location_id'];
        $quantity     = (int) $validated['quantity'];
        $reason       = $this->nullIfEmpty($validated['reason'] ?? null) ?? 'Stock Transfer';
        $notes        = $this->nullIfEmpty($validated['notes'] ?? null);

        if ($fromLocId === $toLocId) {
            return response()->json([
                'success' => false,
                'message' => 'Source and destination locations must be different.',
            ], 422);
        }

        // Check available stock at source
        $availableAtSource = (int) DB::table('inventory_batches')
            ->where('item_id', $fromLocId ? $itemId : $itemId)
            ->where('location_id', $fromLocId)
            ->where('status', 'active')
            ->sum('quantity');

        if ($quantity > $availableAtSource) {
            return response()->json([
                'success' => false,
                'message' => 'Transfer quantity exceeds available stock at source location.',
                'error_type' => 'insufficient_stock',
                'details' => [
                    'available_quantity' => $availableAtSource,
                    'requested_quantity' => $quantity,
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

        $fromLocation = DB::table('locations')->where('location_id', $fromLocId)->first(['location_id', 'location_name']);
        $toLocation   = DB::table('locations')->where('location_id', $toLocId)->first(['location_id', 'location_name']);

        $user        = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference   = 'TRF-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        try {
            $result = DB::transaction(function () use (
                $item, $itemId, $fromLocId, $toLocId, $quantity,
                $reason, $notes, $performedBy, $reference
            ) {
                // ── FEFO deduction from source batches ──────────────────
                $remaining       = $quantity;
                $transferredBatches = [];

                $sourceBatches = DB::table('inventory_batches')
                    ->select('batch_id', 'quantity', 'expiry_date', 'manufactured_date', 'batch_number')
                    ->where('item_id', $itemId)
                    ->where('location_id', $fromLocId)
                    ->where('status', 'active')
                    ->where('quantity', '>', 0)
                    ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                    ->orderBy('created_at')
                    ->lockForUpdate()
                    ->get();

                foreach ($sourceBatches as $batch) {
                    if ($remaining <= 0) break;

                    $take   = min($remaining, (int) $batch->quantity);
                    $newQty = ((int) $batch->quantity) - $take;

                    DB::table('inventory_batches')
                        ->where('batch_id', $batch->batch_id)
                        ->update([
                            'quantity'   => $newQty,
                            'status'     => $newQty <= 0 ? 'depleted' : 'active',
                            'updated_at' => now(),
                        ]);

                    $transferredBatches[] = [
                        'source_batch_id'   => (int) $batch->batch_id,
                        'quantity'          => $take,
                        'expiry_date'       => $batch->expiry_date,
                        'manufactured_date' => $batch->manufactured_date,
                        'batch_number'      => $batch->batch_number,
                    ];

                    $remaining -= $take;
                }

                // ── Create new batch(es) at destination ──────────────────
                foreach ($transferredBatches as $seg) {
                    $newBatchId = DB::table('inventory_batches')->insertGetId([
                        'item_id'          => $itemId,
                        'location_id'      => $toLocId,
                        'batch_number'     => 'TRF-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4)),
                        'quantity'         => $seg['quantity'],
                        'expiry_date'      => $seg['expiry_date'],
                        'manufactured_date'=> $seg['manufactured_date'],
                        'status'           => 'active',
                        'created_at'       => now(),
                        'updated_at'       => now(),
                    ]);

                    // OUT transaction at source
                    DB::table('inventory_transactions')->insert([
                        'item_id'          => $itemId,
                        'batch_id'         => $seg['source_batch_id'],
                        'transaction_type' => 'TRANSFER',
                        'quantity'         => -$seg['quantity'],
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason'           => $reason,
                        'notes'            => $notes,
                        'from_location_id' => $fromLocId,
                        'to_location_id'   => $toLocId,
                        'performed_by'     => $performedBy,
                        'created_at'       => now(),
                    ]);

                    // IN transaction at destination
                    DB::table('inventory_transactions')->insert([
                        'item_id'          => $itemId,
                        'batch_id'         => $newBatchId,
                        'transaction_type' => 'TRANSFER',
                        'quantity'         => $seg['quantity'],
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason'           => $reason,
                        'notes'            => $notes,
                        'from_location_id' => $fromLocId,
                        'to_location_id'   => $toLocId,
                        'performed_by'     => $performedBy,
                        'created_at'       => now(),
                    ]);
                }

                return [
                    'reference_number'  => $reference,
                    'item_id'           => (int) $item->item_id,
                    'item_code'         => (string) $item->item_code,
                    'item_description'  => (string) $item->item_description,
                    'from_location_id'  => $fromLocId,
                    'to_location_id'    => $toLocId,
                    'transferred_quantity' => $quantity,
                ];
            });

            AuditLogService::log(
                'inventory_transactions', $itemId, 'UPDATE',
                null, $result, $request, $performedBy
            );

            return response()->json([
                'success' => true,
                'message' => "Transfer recorded successfully. Ref: {$reference}.",
                'data'    => $result,
            ], 201);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record transfer.',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function nullIfEmpty(?string $value): ?string
    {
        if ($value === null) return null;
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function resolveImageUrl(?string $storedValue): ?string
    {
        if (!$storedValue) return null;
        if (preg_match('/^https?:\/\//i', $storedValue)) return $storedValue;
        $path = ltrim($storedValue, '/');
        return str_starts_with($path, 'storage/') ? url($path) : url('storage/' . $path);
    }
}
