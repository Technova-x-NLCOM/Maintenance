<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = $perPage > 0 ? min($perPage, 100) : 15;

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoin('users as u', 'i.created_by', '=', 'u.user_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.item_type_id',
                'it.type_name as item_type_name',
                'i.category_id',
                'c.category_name',
                'i.measurement_unit',
                'i.particular',
                'i.mg_dosage',
                'i.image_url',
                'i.remarks',
                'i.unit_value',
                'i.reorder_level',
                'i.shelf_life_days',
                'i.is_active',
                'i.created_by',
                DB::raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as created_by_name"),
                'i.created_at',
                'i.updated_at'
            )
            ->orderByDesc('i.updated_at');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('it.type_name', 'like', "%{$search}%")
                    ->orWhere('c.category_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('item_type_id')) {
            $query->where('i.item_type_id', (int) $request->input('item_type_id'));
        }

        if ($request->filled('category_id')) {
            $query->where('i.category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if (!is_null($isActive)) {
                $query->where('i.is_active', $isActive);
            }
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

    public function show(int $itemId)
    {
        $item = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoin('users as u', 'i.created_by', '=', 'u.user_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.item_type_id',
                'it.type_name as item_type_name',
                'i.category_id',
                'c.category_name',
                'i.measurement_unit',
                'i.particular',
                'i.mg_dosage',
                'i.image_url',
                'i.remarks',
                'i.unit_value',
                'i.reorder_level',
                'i.shelf_life_days',
                'i.is_active',
                'i.created_by',
                DB::raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as created_by_name"),
                'i.created_at',
                'i.updated_at'
            )
            ->where('i.item_id', $itemId)
            ->first();

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.',
            ], 404);
        }

        $item = $this->normalizeItem($item);

        return response()->json([
            'success' => true,
            'message' => 'Item retrieved successfully.',
            'data' => $item,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'item_code' => ['required', 'string', 'max:50', Rule::unique('items', 'item_code')],
            'item_description' => ['required', 'string', 'max:255'],
            'item_type_id' => ['required', 'integer', 'exists:item_types,item_type_id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,category_id'],
            'measurement_unit' => ['nullable', 'string', 'max:50'],
            'particular' => ['nullable', 'string'],
            'mg_dosage' => ['nullable', 'numeric', 'min:0'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:4096'],
            'remarks' => ['nullable', 'string'],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'shelf_life_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        unset($data['image']);

        $user = auth('api')->user();
        $imagePath = null;

        DB::beginTransaction();
        try {
            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('items', 'public');
            }

            $itemId = DB::table('items')->insertGetId([
                'item_code' => trim($data['item_code']),
                'item_description' => trim($data['item_description']),
                'item_type_id' => $data['item_type_id'],
                'category_id' => $data['category_id'] ?? null,
                'measurement_unit' => $data['measurement_unit'] ?? null,
                'particular' => $data['particular'] ?? null,
                'mg_dosage' => $data['mg_dosage'] ?? null,
                'image_url' => $imagePath,
                'remarks' => $data['remarks'] ?? null,
                'unit_value' => $data['unit_value'] ?? null,
                'reorder_level' => $data['reorder_level'] ?? 0,
                'shelf_life_days' => $data['shelf_life_days'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                'created_by' => $user?->user_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();

            return $this->show((int) $itemId);
        } catch (\Throwable $e) {
            DB::rollBack();

            if ($imagePath) {
                Storage::disk('public')->delete($imagePath);
            }

            return $this->buildItemSaveErrorResponse('create', $e);
        }
    }

    public function update(Request $request, int $itemId)
    {
        $existingItem = DB::table('items')
            ->select('item_id', 'image_url')
            ->where('item_id', $itemId)
            ->first();

        if (!$existingItem) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.',
            ], 404);
        }

        $data = $request->validate([
            'item_code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('items', 'item_code')->ignore($itemId, 'item_id')],
            'item_description' => ['sometimes', 'required', 'string', 'max:255'],
            'item_type_id' => ['sometimes', 'required', 'integer', 'exists:item_types,item_type_id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,category_id'],
            'measurement_unit' => ['nullable', 'string', 'max:50'],
            'particular' => ['nullable', 'string'],
            'mg_dosage' => ['nullable', 'numeric', 'min:0'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:4096'],
            'remarks' => ['nullable', 'string'],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'shelf_life_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        unset($data['image']);

        if (empty($data) && !$request->hasFile('image')) {
            return response()->json([
                'success' => false,
                'message' => 'No fields provided for update.',
            ], 422);
        }

        if (array_key_exists('item_code', $data)) {
            $data['item_code'] = trim($data['item_code']);
        }

        if (array_key_exists('item_description', $data)) {
            $data['item_description'] = trim($data['item_description']);
        }

        $data['updated_at'] = now();

        $newImagePath = null;
        $oldImagePath = $this->extractStoredImagePath($existingItem->image_url);

        DB::beginTransaction();
        try {
            if ($request->hasFile('image')) {
                $newImagePath = $request->file('image')->store('items', 'public');
                $data['image_url'] = $newImagePath;
            }

            DB::table('items')->where('item_id', $itemId)->update($data);
            DB::commit();

            if ($newImagePath && $oldImagePath && $oldImagePath !== $newImagePath) {
                Storage::disk('public')->delete($oldImagePath);
            }

            return $this->show($itemId);
        } catch (\Throwable $e) {
            DB::rollBack();

            if ($newImagePath) {
                Storage::disk('public')->delete($newImagePath);
            }

            return $this->buildItemSaveErrorResponse('update', $e);
        }
    }

    public function updateStatus(Request $request, int $itemId)
    {
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $updated = DB::table('items')
            ->where('item_id', $itemId)
            ->update([
                'is_active' => $data['is_active'],
                'updated_at' => now(),
            ]);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found or no changes applied.',
            ], 404);
        }

        return $this->show($itemId);
    }

    public function options()
    {
        $itemTypes = DB::table('item_types')
            ->select('item_type_id', 'type_name')
            ->orderBy('type_name')
            ->get();

        $categories = DB::table('categories')
            ->select('category_id', 'category_name')
            ->orderBy('category_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Item form options retrieved successfully.',
            'data' => [
                'item_types' => $itemTypes,
                'categories' => $categories,
            ],
        ]);
    }

    public function expectedExpiry(Request $request, int $itemId)
    {
        $data = $request->validate([
            'purchase_date' => ['required', 'date'],
        ]);

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

        if (!$item->shelf_life_days) {
            return response()->json([
                'success' => false,
                'message' => 'This item does not have a configured shelf life yet.',
                'error_type' => 'shelf_life_not_configured',
            ], 422);
        }

        $purchaseDate = Carbon::parse($data['purchase_date'])->startOfDay();
        $expectedExpiryDate = $purchaseDate->copy()->addDays((int) $item->shelf_life_days);

        return response()->json([
            'success' => true,
            'message' => 'Expected expiry date computed successfully.',
            'data' => [
                'item_id' => $item->item_id,
                'item_code' => $item->item_code,
                'item_description' => $item->item_description,
                'purchase_date' => $purchaseDate->toDateString(),
                'shelf_life_days' => (int) $item->shelf_life_days,
                'expected_expiry_date' => $expectedExpiryDate->toDateString(),
            ],
        ]);
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

    private function extractStoredImagePath(?string $storedValue): ?string
    {
        if (!$storedValue) {
            return null;
        }

        if (preg_match('#/storage/(.+)$#', $storedValue, $matches)) {
            return $matches[1];
        }

        if (preg_match('/^https?:\/\//i', $storedValue)) {
            return null;
        }

        $path = ltrim($storedValue, '/');

        return str_starts_with($path, 'storage/') ? substr($path, 8) : $path;
    }

    private function buildItemSaveErrorResponse(string $action, \Throwable $e)
    {
        $actionLabel = $action === 'create' ? 'create' : 'update';
        $message = "Unable to {$actionLabel} the item right now. Please try again.";
        $errorType = 'item_save_failed';

        if (str_contains($e->getMessage(), "Unknown column 'image'")) {
            $message = 'Unable to save the uploaded image because the server image field is not configured correctly.';
            $errorType = 'item_image_storage_misconfigured';
        } elseif (str_contains(strtolower($e->getMessage()), 'storage') || str_contains(strtolower($e->getMessage()), 'file')) {
            $message = 'Unable to save the uploaded image. Please check the file and try again.';
            $errorType = 'item_image_upload_failed';
        } elseif (str_contains(strtolower($e->getMessage()), 'duplicate') || str_contains(strtolower($e->getMessage()), 'unique')) {
            $message = 'The item code already exists. Please use a different item code.';
            $errorType = 'item_code_already_exists';
        }

        $response = [
            'success' => false,
            'message' => $message,
            'error_type' => $errorType,
        ];

        if (config('app.debug')) {
            $response['error'] = $e->getMessage();
        }

        return response()->json($response, 500);
    }
}
