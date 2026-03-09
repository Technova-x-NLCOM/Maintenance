<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'image_url' => ['nullable', 'url', 'max:500'],
            'remarks' => ['nullable', 'string'],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user = auth('api')->user();

        DB::beginTransaction();
        try {
            $itemId = DB::table('items')->insertGetId([
                'item_code' => trim($data['item_code']),
                'item_description' => trim($data['item_description']),
                'item_type_id' => $data['item_type_id'],
                'category_id' => $data['category_id'] ?? null,
                'measurement_unit' => $data['measurement_unit'] ?? null,
                'particular' => $data['particular'] ?? null,
                'mg_dosage' => $data['mg_dosage'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'unit_value' => $data['unit_value'] ?? null,
                'reorder_level' => $data['reorder_level'] ?? 0,
                'is_active' => $data['is_active'] ?? true,
                'created_by' => $user?->user_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();

            return $this->show((int) $itemId);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to create item.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, int $itemId)
    {
        $exists = DB::table('items')->where('item_id', $itemId)->exists();
        if (!$exists) {
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
            'image_url' => ['nullable', 'url', 'max:500'],
            'remarks' => ['nullable', 'string'],
            'unit_value' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (empty($data)) {
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

        DB::beginTransaction();
        try {
            DB::table('items')->where('item_id', $itemId)->update($data);
            DB::commit();

            return $this->show($itemId);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to update item.',
                'error' => $e->getMessage(),
            ], 500);
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
}
