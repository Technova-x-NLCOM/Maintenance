<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StockAdjustmentController extends Controller
{
    public function getAdjustableItems(Request $request)
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
                'i.shelf_life_days',
                'i.image_url',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                DB::raw('COALESCE(es.expired_stock, 0) as expired_stock')
            )
            ->where('i.is_active', true)
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
            $items->getCollection()->map(function ($item) {
                $item->image_url = $this->resolveImageUrl($item->image_url ?? null);
                $item->current_stock = (int) $item->current_stock;
                $item->expired_stock = (int) $item->expired_stock;
                $item->shelf_life_days = $item->shelf_life_days ? (int) $item->shelf_life_days : null;
                return $item;
            })
        );

        return response()->json([
            'success' => true,
            'message' => 'Adjustable items retrieved successfully.',
            'data' => $items,
        ]);
    }

    public function createAdjustment(Request $request)
    {
        $validated = $request->validate([
            'item_id' => ['required', 'integer', 'exists:items,item_id'],
            'adjustment_mode' => ['required', 'string', 'in:increase,decrease'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'purchase_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'manufactured_date' => ['nullable', 'date'],
            'confirm_expiration' => ['nullable', 'boolean'],
        ]);

        $itemId = (int) $validated['item_id'];
        $adjustmentMode = (string) $validated['adjustment_mode'];
        $quantity = (int) $validated['quantity'];

        $stock = (int) DB::table('inventory_batches')
            ->where('item_id', $itemId)
            ->where('status', 'active')
            ->sum('quantity');

        $expiredStock = (int) DB::table('inventory_batches')
            ->where('item_id', $itemId)
            ->where('status', 'active')
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString())
            ->sum('quantity');

        $confirmExpiration = (bool) ($validated['confirm_expiration'] ?? false);

        if ($adjustmentMode === 'increase' && !empty($validated['manufactured_date']) && !empty($validated['expiry_date'])) {
            if (strtotime((string) $validated['manufactured_date']) > strtotime((string) $validated['expiry_date'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Manufactured date cannot be after expiry date.',
                ], 422);
            }
        }

        if ($adjustmentMode === 'decrease' && $confirmExpiration && $quantity > $expiredStock) {
            return response()->json([
                'success' => false,
                'message' => 'Adjustment quantity exceeds available expired stock.',
                'error_type' => 'insufficient_expired_stock',
                'details' => [
                    'current_expired_stock' => $expiredStock,
                    'requested_decrease' => $quantity,
                ],
            ], 422);
        }

        if ($adjustmentMode === 'decrease' && $quantity > $stock) {
            return response()->json([
                'success' => false,
                'message' => 'Adjustment quantity exceeds current stock.',
                'error_type' => 'insufficient_stock',
                'details' => [
                    'current_stock' => $stock,
                    'requested_decrease' => $quantity,
                ],
            ], 422);
        }

        $item = DB::table('items')
            ->select('item_id', 'item_code', 'item_description', 'shelf_life_days')
            ->where('item_id', $itemId)
            ->first();

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.',
            ], 404);
        }

        $user = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference = 'ADJ-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        $resolvedExpiryDate = !empty($validated['expiry_date']) ? Carbon::parse((string) $validated['expiry_date'])->toDateString() : null;
        $resolvedManufacturedDate = !empty($validated['manufactured_date']) ? Carbon::parse((string) $validated['manufactured_date'])->toDateString() : null;
        $resolvedPurchaseDate = !empty($validated['purchase_date']) ? Carbon::parse((string) $validated['purchase_date'])->toDateString() : null;
        $locationId = $this->resolveLocationId($request);
        $fromLocationId = $locationId;
        $toLocationId = $locationId;

        if ($adjustmentMode === 'increase' && Schema::hasColumn('inventory_batches', 'location_id') && $locationId === null) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record stock adjustment: no valid location is configured for inventory batches.',
            ], 422);
        }

        $shelfLifeDays = $item->shelf_life_days ? (int) $item->shelf_life_days : null;
        if ($adjustmentMode === 'increase' && $shelfLifeDays) {
            if (!$resolvedExpiryDate) {
                $baseDate = $resolvedManufacturedDate ?? $resolvedPurchaseDate;
                if (!$baseDate) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Expiry date is required for items with shelf life. Provide expiry date or a purchase/manufactured date for auto-computation.',
                    ], 422);
                }

                $resolvedExpiryDate = Carbon::parse($baseDate)->addDays($shelfLifeDays)->toDateString();
            }
        }

        if ($adjustmentMode === 'increase' && $resolvedManufacturedDate && $resolvedExpiryDate) {
            if (strtotime($resolvedManufacturedDate) > strtotime($resolvedExpiryDate)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Manufactured date cannot be after expiry date.',
                ], 422);
            }
        }

        try {
            $result = DB::transaction(function () use ($item, $itemId, $adjustmentMode, $quantity, $validated, $performedBy, $reference, $stock, $confirmExpiration, $resolvedExpiryDate, $resolvedManufacturedDate, $resolvedPurchaseDate, $locationId, $fromLocationId, $toLocationId) {
                if ($adjustmentMode === 'increase') {
                    $batchInsert = [
                        'item_id' => $itemId,
                        'batch_number' => 'ADJ-IN-' . now()->format('YmdHis'),
                        'quantity' => $quantity,
                        'expiry_date' => $resolvedExpiryDate,
                        'manufactured_date' => $resolvedManufacturedDate,
                        'status' => 'active',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    if (Schema::hasColumn('inventory_batches', 'location_id')) {
                        $batchInsert['location_id'] = $locationId;
                    }

                    $batchId = DB::table('inventory_batches')->insertGetId($batchInsert);

                    $transactionInsert = [
                        'item_id' => $itemId,
                        'batch_id' => $batchId,
                        'transaction_type' => 'ADJUSTMENT',
                        'quantity' => $quantity,
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason' => $validated['reason'],
                        'notes' => $this->buildAdjustmentNotes('increase', $validated['notes'] ?? null, false),
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

                    $newStock = $stock + $quantity;
                } else {
                    $remaining = $quantity;
                    $batchId = null;

                    $batches = DB::table('inventory_batches')
                        ->select('batch_id', 'quantity', 'expiry_date')
                        ->where('item_id', $itemId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0)
                        ->when($confirmExpiration, function ($query) {
                            $query->whereNotNull('expiry_date')
                                ->whereDate('expiry_date', '<', now()->toDateString());
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

                        if ($batchId === null) {
                            $batchId = (int) $batch->batch_id;
                        }

                        $newQty = ((int) $batch->quantity) - $deduct;
                        DB::table('inventory_batches')
                            ->where('batch_id', $batch->batch_id)
                            ->update([
                                'quantity' => $newQty,
                                'status' => $newQty <= 0 ? 'depleted' : 'active',
                                'updated_at' => now(),
                            ]);

                        $remaining -= $deduct;
                    }

                    $transactionInsert = [
                        'item_id' => $itemId,
                        'batch_id' => $batchId,
                        'transaction_type' => 'ADJUSTMENT',
                        'quantity' => -$quantity,
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason' => $validated['reason'],
                        'notes' => $this->buildAdjustmentNotes('decrease', $validated['notes'] ?? null, $confirmExpiration),
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

                    $newStock = $stock - $quantity;
                }

                return [
                    'reference_number' => $reference,
                    'item_id' => (int) $item->item_id,
                    'item_code' => (string) $item->item_code,
                    'item_description' => (string) $item->item_description,
                    'adjustment_mode' => $adjustmentMode,
                    'adjusted_quantity' => $quantity,
                    'previous_stock' => $stock,
                    'new_stock' => $newStock,
                    'confirm_expiration' => $confirmExpiration,
                    'expiry_date' => $resolvedExpiryDate,
                    'manufactured_date' => $resolvedManufacturedDate,
                    'purchase_date' => $resolvedPurchaseDate,
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
                'message' => 'Stock adjustment recorded successfully.',
                'data' => $result,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to record stock adjustment.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    private function buildAdjustmentNotes(string $mode, ?string $notes, bool $confirmExpiration): string
    {
        $parts = ['Adjustment: ' . strtoupper($mode)];
        if ($confirmExpiration) {
            $parts[] = 'Expired stock confirmation: YES';
        }
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

    private function resolveLocationId(Request $request): ?int
    {
        $incoming = $request->input('location_id');
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
