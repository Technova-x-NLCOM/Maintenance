<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class IssuanceTransactionController extends Controller
{
    public function getIssuableItems(Request $request)
    {
        $perPage = (int) $request->input('per_page', 12);
        $perPage = $perPage > 0 ? min($perPage, 100) : 12;

        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        $expiredStockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as expired_stock'))
            ->where('status', 'active')
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString())
            ->groupBy('item_id');

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', function ($join) {
                $join->on('i.item_id', '=', 's.item_id');
            })
            ->leftJoinSub($expiredStockSubquery, 'es', function ($join) {
                $join->on('i.item_id', '=', 'es.item_id');
            })
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'it.type_name as item_type_name',
                'c.category_name',
                'i.measurement_unit',
                'i.image_url',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                DB::raw('COALESCE(es.expired_stock, 0) as expired_stock')
            )
            ->where('i.is_active', true)
            ->whereRaw('COALESCE(s.current_stock, 0) > 0')
            ->orderBy('i.item_description');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('it.type_name', 'like', "%{$search}%")
                    ->orWhere('c.category_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('i.category_id', (int) $request->input('category_id'));
        }

        $items = $query->paginate($perPage);
        $items->setCollection(
            $items->getCollection()->map(fn ($item) => $this->normalizeItem($item))
        );

        return response()->json([
            'success' => true,
            'message' => 'Issuable items retrieved successfully.',
            'data' => $items,
        ]);
    }

    public function createIssuance(Request $request)
    {
        $data = $request->validate([
            'destination' => ['required', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'from_location_id' => ['nullable', 'integer'],
            'to_location_id' => ['nullable', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', 'exists:items,item_id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $fromLocationId = $this->resolveLocationId($data['from_location_id'] ?? null);
        $toLocationId = $this->resolveLocationId($data['to_location_id'] ?? null) ?? $fromLocationId;

        if (Schema::hasColumn('inventory_transactions', 'from_location_id') && $fromLocationId === null) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record issuance transaction: no valid source location is configured.',
            ], 422);
        }

        if (Schema::hasColumn('inventory_transactions', 'to_location_id') && $toLocationId === null) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record issuance transaction: no valid destination location is configured.',
            ], 422);
        }

        $lineItemIds = collect($data['items'])->pluck('item_id')->map(fn ($id) => (int) $id)->values();
        $availableStock = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->whereIn('item_id', $lineItemIds)
            ->where('status', 'active')
            ->groupBy('item_id')
            ->pluck('current_stock', 'item_id');

        if (Schema::hasColumn('inventory_batches', 'location_id') && $fromLocationId !== null) {
            $availableStock = DB::table('inventory_batches')
                ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
                ->whereIn('item_id', $lineItemIds)
                ->where('status', 'active')
                ->where('location_id', $fromLocationId)
                ->groupBy('item_id')
                ->pluck('current_stock', 'item_id');
        }

        $insufficient = [];
        foreach ($data['items'] as $line) {
            $itemId = (int) $line['item_id'];
            $requested = (int) $line['quantity'];
            $available = (int) ($availableStock[$itemId] ?? 0);

            if ($requested > $available) {
                $insufficient[] = [
                    'item_id' => $itemId,
                    'requested_quantity' => $requested,
                    'available_quantity' => $available,
                ];
            }
        }

        if (!empty($insufficient)) {
            return response()->json([
                'success' => false,
                'message' => 'Some items exceed available stock.',
                'error_type' => 'insufficient_stock',
                'details' => $insufficient,
            ], 422);
        }

        $user = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference = 'ISS-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        try {
            $summary = DB::transaction(function () use ($data, $performedBy, $reference, $fromLocationId, $toLocationId) {
                $allocationSummary = [];
                $totalIssued = 0;

                foreach ($data['items'] as $line) {
                    $itemId = (int) $line['item_id'];
                    $remaining = (int) $line['quantity'];
                    $issuedForItem = 0;

                    $batches = DB::table('inventory_batches')
                        ->select('batch_id', 'quantity', 'expiry_date')
                        ->where('item_id', $itemId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0)
                        ->when(Schema::hasColumn('inventory_batches', 'location_id') && $fromLocationId !== null, function ($query) use ($fromLocationId) {
                            $query->where('location_id', $fromLocationId);
                        })
                        ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                        ->orderBy('created_at')
                        ->lockForUpdate()
                        ->get();

                    foreach ($batches as $batch) {
                        if ($remaining <= 0) {
                            break;
                        }

                        $deduct = min($remaining, (int) $batch->quantity);
                        if ($deduct <= 0) {
                            continue;
                        }

                        $newQty = ((int) $batch->quantity) - $deduct;
                        DB::table('inventory_batches')
                            ->where('batch_id', $batch->batch_id)
                            ->update([
                                'quantity' => $newQty,
                                'status' => $newQty <= 0 ? 'depleted' : 'active',
                                'updated_at' => now(),
                            ]);

                        $transactionInsert = [
                            'item_id' => $itemId,
                            'batch_id' => $batch->batch_id,
                            'transaction_type' => 'OUT',
                            'quantity' => $deduct,
                            'reference_number' => $reference,
                            'transaction_date' => now(),
                            'reason' => $data['reason'] ?? 'Stock Issuance',
                            'notes' => $data['notes'] ?? null,
                            'destination' => $data['destination'],
                            'performed_by' => $performedBy,
                            'created_at' => now(),
                        ];

                        if (Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                            $transactionInsert['from_location_id'] = $fromLocationId;
                        }

                        if (Schema::hasColumn('inventory_transactions', 'to_location_id')) {
                            $transactionInsert['to_location_id'] = $toLocationId;
                        }

                        DB::table('inventory_transactions')->insert($transactionInsert);

                        $remaining -= $deduct;
                        $issuedForItem += $deduct;
                        $totalIssued += $deduct;
                    }

                    $allocationSummary[] = [
                        'item_id' => $itemId,
                        'requested_quantity' => (int) $line['quantity'],
                        'issued_quantity' => $issuedForItem,
                    ];
                }

                return [
                    'reference_number' => $reference,
                    'destination' => $data['destination'],
                    'from_location_id' => $fromLocationId,
                    'to_location_id' => $toLocationId,
                    'issued_lines' => $allocationSummary,
                    'total_issued_quantity' => $totalIssued,
                ];
            });

            AuditLogService::log(
                'inventory_transactions',
                0,
                'UPDATE',
                null,
                $summary,
                $request,
                $performedBy
            );

            return response()->json([
                'success' => true,
                'message' => 'Issuance recorded successfully.',
                'data' => $summary,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record issuance transaction.',
                'error_type' => 'issuance_save_failed',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    private function resolveLocationId(mixed $incoming): ?int
    {
        if ($incoming !== null && $incoming !== '') {
            return (int) $incoming;
        }

        $bootstrapped = $this->ensureDefaultLocation();
        if ($bootstrapped !== null) {
            return $bootstrapped;
        }

        $candidates = [
            ['table' => 'locations', 'column' => 'location_id'],
            ['table' => 'inventory_locations', 'column' => 'location_id'],
            ['table' => 'stock_locations', 'column' => 'location_id'],
            ['table' => 'warehouses', 'column' => 'warehouse_id'],
        ];

        foreach ($candidates as $candidate) {
            if (!Schema::hasTable($candidate['table']) || !Schema::hasColumn($candidate['table'], $candidate['column'])) {
                continue;
            }

            $id = DB::table($candidate['table'])
                ->whereNotNull($candidate['column'])
                ->orderBy($candidate['column'])
                ->value($candidate['column']);

            if ($id !== null) {
                return (int) $id;
            }
        }

        return null;
    }

    private function ensureDefaultLocation(): ?int
    {
        if (!Schema::hasTable('locations') || !Schema::hasColumn('locations', 'location_id')) {
            return null;
        }

        $existing = DB::table('locations')->orderBy('location_id')->value('location_id');
        if ($existing !== null) {
            return (int) $existing;
        }

        $insert = [
            'location_code' => 'AUTO-DEFAULT',
            'location_name' => 'Default Location',
            'address' => null,
            'contact_person' => null,
            'contact_phone' => null,
            'contact_email' => null,
            'location_type' => 'warehouse',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        try {
            $newId = DB::table('locations')->insertGetId($insert, 'location_id');
            return (int) $newId;
        } catch (\Throwable $e) {
            $fallback = DB::table('locations')->orderBy('location_id')->value('location_id');
            return $fallback !== null ? (int) $fallback : null;
        }
    }

    private function normalizeItem(object $item): object
    {
        $item->image_url = $this->resolveImageUrl($item->image_url ?? null);
        $item->expired_stock = (int) ($item->expired_stock ?? 0);

        return $item;
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
