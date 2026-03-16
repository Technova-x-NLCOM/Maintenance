<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
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
            DB::table('categories')->where('category_id', $categoryId)->delete();

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
}
