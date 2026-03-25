<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
        if (is_array($request->input('items')) && count($request->input('items')) > 0) {
            return $this->createReceivingBulk($request);
        }

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

        try {
            return DB::transaction(function () use ($data) {
                $line = $this->createReceivingLine($data);

                return response()->json([
                    'success' => true,
                    'message' => 'Stock received successfully.',
                    'data' => $line,
                ], 201);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create receiving transaction: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function createReceivingBulk(Request $request)
    {
        $data = $request->validate([
            'batch_number' => ['required', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', 'exists:items,item_id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.purchase_date' => ['required', 'date'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.manufactured_date' => ['nullable', 'date'],
            'items.*.supplier_info' => ['nullable', 'string', 'max:255'],
            'items.*.batch_value' => ['nullable', 'numeric', 'min:0'],
            'items.*.reason' => ['nullable', 'string', 'max:255'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        foreach ($data['items'] as $index => $line) {
            $purchaseDate = Carbon::parse($line['purchase_date'])->startOfDay();

            if (!empty($line['expiry_date'])) {
                $expiryDate = Carbon::parse($line['expiry_date'])->startOfDay();
                if ($expiryDate->lessThanOrEqualTo($purchaseDate)) {
                    throw ValidationException::withMessages([
                        "items.{$index}.expiry_date" => ['Expiry date must be after purchase date.'],
                    ]);
                }
            }

            if (!empty($line['manufactured_date'])) {
                $manufacturedDate = Carbon::parse($line['manufactured_date'])->startOfDay();
                if ($manufacturedDate->greaterThan($purchaseDate)) {
                    throw ValidationException::withMessages([
                        "items.{$index}.manufactured_date" => ['Manufactured date must be on or before purchase date.'],
                    ]);
                }
            }
        }

        $reference = 'RCV-LIST-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        try {
            $summary = DB::transaction(function () use ($data, $reference) {
                $receivedLines = [];
                $totalReceived = 0;

                foreach ($data['items'] as $lineData) {
                    $lineData['batch_number'] = $data['batch_number'];
                    $createdLine = $this->createReceivingLine($lineData, $reference);
                    $receivedLines[] = $createdLine;
                    $totalReceived += (int) $createdLine['quantity'];
                }

                return [
                    'reference_number' => $reference,
                    'batch_number' => $data['batch_number'],
                    'qr_payload' => $this->buildBatchTransactionQrPayload($reference, $data['batch_number']),
                    'qr_label' => 'BATCH:' . $data['batch_number'],
                    'line_count' => count($receivedLines),
                    'total_received_quantity' => $totalReceived,
                    'received_lines' => $receivedLines,
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Stock received successfully.',
                'data' => $summary,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create receiving transaction: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function createReceivingLine(array $data, ?string $referenceNumber = null): array
    {
        $item = DB::table('items')
            ->select('item_id', 'item_code', 'item_description', 'shelf_life_days')
            ->where('item_id', (int) $data['item_id'])
            ->first();

        if (!$item) {
            throw new \RuntimeException('Item not found.');
        }

        $purchaseDate = Carbon::parse($data['purchase_date'])->startOfDay();

        if (!empty($data['expiry_date'])) {
            $expiryDate = Carbon::parse($data['expiry_date'])->startOfDay();
        } elseif ($item->shelf_life_days) {
            $expiryDate = $purchaseDate->copy()->addDays((int) $item->shelf_life_days);
        } else {
            $expiryDate = null;
        }

        $batchId = DB::table('inventory_batches')->insertGetId([
            'item_id' => (int) $data['item_id'],
            'batch_number' => $data['batch_number'],
            'quantity' => (int) $data['quantity'],
            'expiry_date' => $expiryDate ? $expiryDate->toDateString() : null,
            'manufactured_date' => !empty($data['manufactured_date']) ? Carbon::parse($data['manufactured_date'])->toDateString() : null,
            'supplier_info' => $data['supplier_info'] ?? null,
            'batch_value' => $data['batch_value'] ?? null,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = auth()->id() ?? 1;
        $reference = $referenceNumber ?: 'RCV-' . date('YmdHis') . '-' . $batchId;

        DB::table('inventory_transactions')->insert([
            'item_id' => (int) $data['item_id'],
            'batch_id' => $batchId,
            'transaction_type' => 'IN',
            'quantity' => (int) $data['quantity'],
            'reference_number' => $reference,
            'transaction_date' => now(),
            'reason' => $data['reason'] ?? 'Stock Received',
            'notes' => $data['notes'] ?? null,
            'performed_by' => $userId,
            'created_at' => now(),
        ]);

        $response = [
            'batch_id' => $batchId,
            'item_id' => (int) $item->item_id,
            'item_code' => $item->item_code,
            'item_description' => $item->item_description,
            'reference_number' => $reference,
            'batch_number' => $data['batch_number'],
            'qr_payload' => $this->buildBatchLineQrPayload($batchId, $item, $reference, (string) $data['batch_number']),
            'qr_label' => 'BATCH:' . $data['batch_number'],
            'quantity' => (int) $data['quantity'],
            'purchase_date' => $purchaseDate->toDateString(),
            'expiry_date' => $expiryDate ? $expiryDate->toDateString() : null,
            'manufactured_date' => $data['manufactured_date'] ?? null,
            'supplier_info' => $data['supplier_info'] ?? null,
            'batch_value' => $data['batch_value'] ?? null,
        ];

        if ($item->shelf_life_days) {
            $response['shelf_life_days'] = (int) $item->shelf_life_days;
            if (empty($data['expiry_date'])) {
                $response['expiry_date_auto_calculated'] = true;
            }
        }

        return $response;
    }

    private function buildBatchLineQrPayload(int $batchId, object $item, string $reference, string $batchNumber): string
    {
        return json_encode([
            'entity' => 'batch_line',
            'batch_id' => $batchId,
            'reference_number' => $reference,
            'batch_number' => $batchNumber,
            'item_id' => (int) $item->item_id,
            'item_code' => (string) $item->item_code,
            'item_description' => (string) $item->item_description,
        ], JSON_UNESCAPED_SLASHES);
    }

    private function buildBatchTransactionQrPayload(string $reference, string $batchNumber): string
    {
        return json_encode([
            'entity' => 'batch_transaction',
            'reference_number' => $reference,
            'batch_number' => $batchNumber,
        ], JSON_UNESCAPED_SLASHES);
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
