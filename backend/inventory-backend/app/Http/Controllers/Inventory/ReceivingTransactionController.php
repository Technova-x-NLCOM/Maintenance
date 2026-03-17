<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReceivingTransactionController extends Controller
{
    /**
     * Get items available for receiving with current stock info
     */
    public function getReceivingItems(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = $perPage > 0 ? min($perPage, 100) : 15;

        // Subquery for current stock (sum of active batches)
        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', function ($join) {
                $join->on('i.item_id', '=', 's.item_id');
            })
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.item_type_id',
                'it.type_name as item_type_name',
                'i.category_id',
                'c.category_name',
                'i.measurement_unit',
                'i.shelf_life_days',
                'i.image_url',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                'i.is_active'
            )
            ->where('i.is_active', true)
            ->orderByDesc('i.updated_at');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('it.type_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('item_type_id')) {
            $query->where('i.item_type_id', (int) $request->input('item_type_id'));
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
            'message' => 'Items retrieved successfully.',
            'data' => $items,
        ]);
    }

    /**
     * Create a receiving transaction with batch
     */
    public function createReceiving(Request $request)
    {
        $data = $request->validate([
            'item_id' => ['required', 'integer', 'exists:items,item_id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'batch_number' => ['required', 'string', 'max:100'],
            'purchase_date' => ['required', 'date'],
            'expiry_date' => ['nullable', 'date', 'after:purchase_date'],
            'manufactured_date' => ['nullable', 'date', 'before_or_equal:purchase_date'],
            'supplier_info' => ['nullable', 'string', 'max:255'],
            'batch_value' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        // Get item details for shelf life calculation
        $item = DB::table('items')
            ->select('item_id', 'item_code', 'item_description', 'shelf_life_days')
            ->where('item_id', $data['item_id'])
            ->first();

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.',
            ], 404);
        }

        // Start a database transaction
        try {
            return DB::transaction(function () use ($data, $item) {
                $purchaseDate = Carbon::parse($data['purchase_date'])->startOfDay();
                
                // Use provided expiry date or auto-compute from shelf life days
                if ($data['expiry_date']) {
                    $expiryDate = Carbon::parse($data['expiry_date'])->startOfDay();
                } elseif ($item->shelf_life_days) {
                    // Auto-compute expected expiry from purchase date + shelf life days
                    $expiryDate = $purchaseDate->copy()->addDays((int) $item->shelf_life_days);
                } else {
                    $expiryDate = null;
                }

                // Create the batch
                $batchId = DB::table('inventory_batches')->insertGetId([
                    'item_id' => $data['item_id'],
                    'batch_number' => $data['batch_number'],
                    'quantity' => $data['quantity'],
                    'expiry_date' => $expiryDate ? $expiryDate->toDateString() : null,
                    'manufactured_date' => $data['manufactured_date'] ? Carbon::parse($data['manufactured_date'])->toDateString() : null,
                    'supplier_info' => $data['supplier_info'] ?? null,
                    'batch_value' => $data['batch_value'] ?? null,
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Create the transaction record
                $userId = auth()->id() ?? 1; // Fallback to user 1 if not authenticated

                DB::table('inventory_transactions')->insert([
                    'item_id' => $data['item_id'],
                    'batch_id' => $batchId,
                    'transaction_type' => 'IN',
                    'quantity' => $data['quantity'],
                    'reference_number' => 'RCV-' . date('YmdHis') . '-' . $batchId,
                    'transaction_date' => now(),
                    'reason' => $data['reason'] ?? 'Stock Received',
                    'notes' => $data['notes'] ?? null,
                    'performed_by' => $userId,
                    'created_at' => now(),
                ]);

                // Prepare response data
                $response = [
                    'batch_id' => $batchId,
                    'item_id' => $item->item_id,
                    'item_code' => $item->item_code,
                    'item_description' => $item->item_description,
                    'batch_number' => $data['batch_number'],
                    'quantity' => $data['quantity'],
                    'purchase_date' => $purchaseDate->toDateString(),
                    'expiry_date' => $expiryDate ? $expiryDate->toDateString() : null,
                    'manufactured_date' => $data['manufactured_date'] ?? null,
                    'supplier_info' => $data['supplier_info'] ?? null,
                    'batch_value' => $data['batch_value'] ?? null,
                ];

                // Include shelf life info if available
                if ($item->shelf_life_days) {
                    $response['shelf_life_days'] = (int) $item->shelf_life_days;
                    if (!$data['expiry_date']) {
                        $response['expiry_date_auto_calculated'] = true;
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Stock received successfully.',
                    'data' => $response,
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create receiving transaction: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function normalizeItem(object $item): object
    {
        $item->image_url = $this->resolveImageUrl($item->image_url ?? null);
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
