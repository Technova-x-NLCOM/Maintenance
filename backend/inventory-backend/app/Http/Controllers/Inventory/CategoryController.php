<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function listCategoryItems(Request $request, int $categoryId)
    {
        $category = DB::table('categories')->where('category_id', $categoryId)->first();
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        $search = trim((string) $request->input('search', ''));

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.image_url',
                'i.is_active',
                'i.category_id',
                'it.type_name as item_type_name'
            )
            ->where('i.category_id', $categoryId)
            ->orderBy('i.item_description');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('it.type_name', 'like', "%{$search}%");
            });
        }

        $items = $query->get()->map(fn ($item) => $this->normalizeCategoryItem($item));

        return response()->json([
            'success' => true,
            'message' => 'Category items retrieved successfully.',
            'data' => $items,
        ]);
    }

    public function listAssignableItems(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $excludeCategoryId = $request->filled('exclude_category_id')
            ? (int) $request->input('exclude_category_id')
            : null;

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.image_url',
                'i.is_active',
                'i.category_id',
                'c.category_name',
                'it.type_name as item_type_name'
            )
            ->orderBy('i.item_description');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%")
                    ->orWhere('it.type_name', 'like', "%{$search}%")
                    ->orWhere('c.category_name', 'like', "%{$search}%");
            });
        }

        if ($excludeCategoryId) {
            $query->where(function ($builder) use ($excludeCategoryId) {
                $builder->whereNull('i.category_id')
                    ->orWhere('i.category_id', '!=', $excludeCategoryId);
            });
        }

        $items = $query->limit(200)->get()->map(fn ($item) => $this->normalizeCategoryItem($item));

        return response()->json([
            'success' => true,
            'message' => 'Assignable items retrieved successfully.',
            'data' => $items,
        ]);
    }

    public function assignItem(Request $request, int $categoryId)
    {
        $category = DB::table('categories')->where('category_id', $categoryId)->first();
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        $data = $request->validate([
            'item_id' => ['nullable', 'integer', 'exists:items,item_id', 'required_without:item_ids'],
            'item_ids' => ['nullable', 'array', 'min:1', 'required_without:item_id'],
            'item_ids.*' => ['integer', 'exists:items,item_id'],
        ]);

        $itemIds = [];
        if (!empty($data['item_ids'])) {
            $itemIds = array_map('intval', $data['item_ids']);
        } elseif (!empty($data['item_id'])) {
            $itemIds = [(int) $data['item_id']];
        }

        $itemIds = array_values(array_unique($itemIds));

        if (empty($itemIds)) {
            return response()->json([
                'success' => false,
                'message' => 'Please select at least one item to assign.',
                'error_type' => 'no_items_selected',
            ], 422);
        }

        $oldItems = DB::table('items')
            ->whereIn('item_id', $itemIds)
            ->get()
            ->keyBy('item_id');

        $affected = DB::table('items')
            ->whereIn('item_id', $itemIds)
            ->update([
                'category_id' => $categoryId,
                'updated_at' => now(),
            ]);

        $newItems = DB::table('items')
            ->whereIn('item_id', $itemIds)
            ->get()
            ->keyBy('item_id');

        foreach ($itemIds as $itemId) {
            AuditLogService::log(
                'items',
                (int) $itemId,
                'UPDATE',
                isset($oldItems[$itemId]) ? (array) $oldItems[$itemId] : null,
                isset($newItems[$itemId]) ? (array) $newItems[$itemId] : null,
                $request
            );
        }

        $message = count($itemIds) === 1
            ? 'Item assigned to category successfully.'
            : "{$affected} items assigned to category successfully.";

        return response()->json([
            'success' => true,
            'message' => $message,
            'assigned_count' => $affected,
        ]);
    }

    public function removeItem(int $categoryId, int $itemId)
    {
        $category = DB::table('categories')->where('category_id', $categoryId)->first();
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        $item = DB::table('items')
            ->select('item_id', 'category_id')
            ->where('item_id', $itemId)
            ->first();

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.',
            ], 404);
        }

        if ((int) ($item->category_id ?? 0) !== $categoryId) {
            return response()->json([
                'success' => false,
                'message' => 'This item is not assigned to the selected category.',
                'error_type' => 'item_not_in_category',
            ], 422);
        }

        $oldItem = DB::table('items')->where('item_id', $itemId)->first();

        DB::table('items')
            ->where('item_id', $itemId)
            ->update([
                'category_id' => null,
                'updated_at' => now(),
            ]);

        $newItem = DB::table('items')->where('item_id', $itemId)->first();
        AuditLogService::log(
            'items',
            $itemId,
            'UPDATE',
            $oldItem ? (array) $oldItem : null,
            $newItem ? (array) $newItem : null,
            request()
        );

        return response()->json([
            'success' => true,
            'message' => 'Item removed from category successfully.',
        ]);
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->input('search', ''));

        $query = DB::table('categories as c')
            ->leftJoin('categories as parent', 'c.parent_category_id', '=', 'parent.category_id')
            ->leftJoin('categories as children', 'children.parent_category_id', '=', 'c.category_id')
            ->leftJoin('items as i', 'i.category_id', '=', 'c.category_id')
            ->select(
                'c.category_id',
                'c.category_name',
                'c.parent_category_id',
                'parent.category_name as parent_category_name',
                'c.description',
                'c.created_at',
                DB::raw('COUNT(DISTINCT children.category_id) as child_count'),
                DB::raw('COUNT(DISTINCT i.item_id) as item_count')
            )
            ->groupBy(
                'c.category_id',
                'c.category_name',
                'c.parent_category_id',
                'parent.category_name',
                'c.description',
                'c.created_at'
            )
            ->orderBy('c.category_name');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('c.category_name', 'like', "%{$search}%")
                    ->orWhere('parent.category_name', 'like', "%{$search}%")
                    ->orWhere('c.description', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'message' => 'Categories retrieved successfully.',
            'data' => $query->get(),
        ]);
    }

    public function show(int $categoryId)
    {
        $category = DB::table('categories as c')
            ->leftJoin('categories as parent', 'c.parent_category_id', '=', 'parent.category_id')
            ->select(
                'c.category_id',
                'c.category_name',
                'c.parent_category_id',
                'parent.category_name as parent_category_name',
                'c.description',
                'c.created_at'
            )
            ->where('c.category_id', $categoryId)
            ->first();

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Category retrieved successfully.',
            'data' => $category,
        ]);
    }

    public function options()
    {
        $categories = DB::table('categories')
            ->select('category_id', 'category_name', 'parent_category_id')
            ->orderBy('category_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Category options retrieved successfully.',
            'data' => [
                'categories' => $categories,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_name' => ['required', 'string', 'max:100', Rule::unique('categories', 'category_name')],
            'parent_category_id' => ['nullable', 'integer', 'exists:categories,category_id'],
            'description' => ['nullable', 'string'],
        ]);

        try {
            $categoryId = DB::table('categories')->insertGetId([
                'category_name' => trim($data['category_name']),
                'parent_category_id' => $data['parent_category_id'] ?? null,
                'description' => $data['description'] ?? null,
                'created_at' => now(),
            ]);

            $newCategory = DB::table('categories')->where('category_id', $categoryId)->first();
            AuditLogService::log(
                'categories',
                (int) $categoryId,
                'INSERT',
                null,
                $newCategory ? (array) $newCategory : null,
                $request
            );

            return $this->show((int) $categoryId);
        } catch (\Throwable $e) {
            return $this->buildCategoryErrorResponse('create', $e);
        }
    }

    public function update(Request $request, int $categoryId)
    {
        $existingCategory = DB::table('categories')->where('category_id', $categoryId)->first();
        if (!$existingCategory) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        $data = $request->validate([
            'category_name' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('categories', 'category_name')->ignore($categoryId, 'category_id')],
            'parent_category_id' => ['nullable', 'integer', 'exists:categories,category_id'],
            'description' => ['nullable', 'string'],
        ]);

        if (empty($data)) {
            return response()->json([
                'success' => false,
                'message' => 'No fields provided for update.',
            ], 422);
        }

        if (array_key_exists('category_name', $data)) {
            $data['category_name'] = trim($data['category_name']);
        }

        if (array_key_exists('parent_category_id', $data)) {
            if ((int) $data['parent_category_id'] === $categoryId) {
                return response()->json([
                    'success' => false,
                    'message' => 'A category cannot be its own parent.',
                    'error_type' => 'invalid_parent_category',
                ], 422);
            }

            if ($data['parent_category_id'] && $this->isDescendant((int) $data['parent_category_id'], $categoryId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'You cannot assign a child category as the parent of this category.',
                    'error_type' => 'category_cycle_detected',
                ], 422);
            }
        }

        try {
            DB::table('categories')->where('category_id', $categoryId)->update($data);

            $updatedCategory = DB::table('categories')->where('category_id', $categoryId)->first();
            AuditLogService::log(
                'categories',
                $categoryId,
                'UPDATE',
                (array) $existingCategory,
                $updatedCategory ? (array) $updatedCategory : null,
                $request
            );

            return $this->show($categoryId);
        } catch (\Throwable $e) {
            return $this->buildCategoryErrorResponse('update', $e);
        }
    }

    public function destroy(int $categoryId)
    {
        $category = DB::table('categories')->where('category_id', $categoryId)->first();
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found.',
            ], 404);
        }

        $hasChildren = DB::table('categories')->where('parent_category_id', $categoryId)->exists();
        if ($hasChildren) {
            return response()->json([
                'success' => false,
                'message' => 'This category has child categories. Reassign or remove them before deleting.',
                'error_type' => 'category_has_children',
            ], 422);
        }

        $hasItems = DB::table('items')->where('category_id', $categoryId)->exists();
        if ($hasItems) {
            return response()->json([
                'success' => false,
                'message' => 'This category is still assigned to one or more items. Reassign those items before deleting.',
                'error_type' => 'category_has_items',
            ], 422);
        }

        try {
            $oldValues = (array) $category;
            DB::table('categories')->where('category_id', $categoryId)->delete();

            AuditLogService::log(
                'categories',
                $categoryId,
                'DELETE',
                $oldValues,
                null,
                request()
            );

            return response()->json([
                'success' => true,
                'message' => 'Category deleted successfully.',
            ]);
        } catch (\Throwable $e) {
            return $this->buildCategoryErrorResponse('delete', $e);
        }
    }

    private function isDescendant(int $candidateParentId, int $categoryId): bool
    {
        $currentParentId = DB::table('categories')
            ->where('category_id', $candidateParentId)
            ->value('parent_category_id');

        while ($currentParentId !== null) {
            if ((int) $currentParentId === $categoryId) {
                return true;
            }

            $currentParentId = DB::table('categories')
                ->where('category_id', $currentParentId)
                ->value('parent_category_id');
        }

        return false;
    }

    private function buildCategoryErrorResponse(string $action, \Throwable $e)
    {
        $message = match ($action) {
            'create' => 'Unable to create the category right now. Please try again.',
            'update' => 'Unable to update the category right now. Please try again.',
            'delete' => 'Unable to delete the category right now. Please try again.',
            default => 'Unable to save the category right now. Please try again.',
        };

        $errorType = 'category_operation_failed';
        $lower = strtolower($e->getMessage());

        if (str_contains($lower, 'duplicate') || str_contains($lower, 'unique')) {
            $message = 'That category name is already in use. Please choose a different name.';
            $errorType = 'category_name_already_exists';
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

    private function normalizeCategoryItem(object $item): object
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
