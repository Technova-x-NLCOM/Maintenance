<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            'location_id' => ['nullable', 'integer'],
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

        $expiryDateInput = $data['expiry_date'] ?? null;
        $manufacturedDateInput = $data['manufactured_date'] ?? null;
        $supplierInfo = $this->nullIfEmpty($data['supplier_info'] ?? null);
        $batchValue = array_key_exists('batch_value', $data) ? $data['batch_value'] : null;
        $reason = $this->nullIfEmpty($data['reason'] ?? null) ?? 'Stock Received';
        $notes = $this->nullIfEmpty($data['notes'] ?? null);
        $locationId = $this->resolveLocationId($request);

        if (Schema::hasColumn('inventory_batches', 'location_id') && $locationId === null) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create receiving transaction: no valid location is configured for inventory batches.',
            ], 422);
        }

        try {
            $line = DB::transaction(function () use ($data, $locationId, $expiryDateInput, $manufacturedDateInput, $supplierInfo, $batchValue, $reason, $notes) {
                $data['location_id'] = $locationId;
                return $this->createReceivingLine($data);
            });

            AuditLogService::log(
                'inventory_transactions',
                (int) ($line['batch_id'] ?? 0),
                'INSERT',
                null,
                $line,
                $request
            );

            return response()->json([
                'success' => true,
                'message' => 'Stock received successfully.',
                'data' => $line,
            ], 201);
        } catch (\Throwable $e) {
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
            'location_id' => ['nullable', 'integer'],
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
        $locationId = $this->resolveLocationId($request);

        if (Schema::hasColumn('inventory_batches', 'location_id') && $locationId === null) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create receiving transaction: no valid location is configured for inventory batches.',
            ], 422);
        }

        try {
            $summary = DB::transaction(function () use ($data, $reference, $locationId) {
                $receivedLines = [];
                $totalReceived = 0;

                foreach ($data['items'] as $lineData) {
                    $lineData['batch_number'] = $data['batch_number'];
                    $lineData['location_id'] = $locationId;
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

            foreach ($summary['received_lines'] as $line) {
                AuditLogService::log(
                    'inventory_transactions',
                    (int) ($line['batch_id'] ?? 0),
                    'INSERT',
                    null,
                    $line,
                    $request
                );
            }

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
        
        // Use provided expiry date or auto-compute from shelf life days
        if (!empty($data['expiry_date'])) {
            $expiryDate = Carbon::parse($data['expiry_date'])->startOfDay();
        } elseif ($item->shelf_life_days) {
            // Auto-compute expected expiry from purchase date + shelf life days
            $expiryDate = $purchaseDate->copy()->addDays((int) $item->shelf_life_days);
        } else {
            $expiryDate = null;
        }

        // Create the batch
        $batchInsert = [
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
        ];

        // Add location_id if the column exists and is provided
        if (Schema::hasColumn('inventory_batches', 'location_id') && !empty($data['location_id'])) {
            $batchInsert['location_id'] = (int) $data['location_id'];
        }

        $batchId = DB::table('inventory_batches')->insertGetId($batchInsert);

        // Create the transaction record
        $user = auth('api')->user();
        $userId = $user?->user_id ?? auth()->id() ?? 1;
        $reference = $referenceNumber ?: 'RCV-' . date('YmdHis') . '-' . $batchId;

        $transactionInsert = [
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
        ];

        // Add location fields if they exist
        if (Schema::hasColumn('inventory_transactions', 'from_location_id') && !empty($data['location_id'])) {
            $transactionInsert['from_location_id'] = (int) $data['location_id'];
        }
        if (Schema::hasColumn('inventory_transactions', 'to_location_id') && !empty($data['location_id'])) {
            $transactionInsert['to_location_id'] = (int) $data['location_id'];
        }

        DB::table('inventory_transactions')->insert($transactionInsert);

        // Prepare response data
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

        // Include shelf life info if available
        if ($item->shelf_life_days) {
            $response['shelf_life_days'] = (int) $item->shelf_life_days;
            if (empty($data['expiry_date'])) {
                $response['expiry_date_auto_calculated'] = true;
            }
        }

        return $response;
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
