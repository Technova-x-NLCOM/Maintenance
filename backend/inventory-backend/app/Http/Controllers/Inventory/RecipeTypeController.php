<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\RecipeType;

class RecipeTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = RecipeType::orderBy('name');

        if ($search = $request->query('search')) {
            $query->where('name', 'like', '%' . $search . '%');
        }

        $perPage  = (int) $request->query('per_page', 10);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Recipe types retrieved successfully.',
            'data'    => $paginated,
        ]);
    }

    public function options()
    {
        $list = RecipeType::orderBy('name')->get(['recipe_type_id', 'name']);

        return response()->json([
            'success' => true,
            'message' => 'Recipe type options retrieved.',
            'data'    => $list,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:150|unique:recipe_types,name',
            'description' => 'nullable|string|max:1000',
        ]);

        $recipeType = RecipeType::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Recipe type created successfully.',
            'data'    => $recipeType,
        ], 201);
    }

    public function show($id)
    {
        $rt = RecipeType::findOrFail($id);

        return response()->json([
            'success' => true,
            'message' => 'Recipe type retrieved.',
            'data'    => $rt,
        ]);
    }

    public function update(Request $request, $id)
    {
        $rt = RecipeType::findOrFail($id);

        $data = $request->validate([
            'name'        => 'required|string|max:150|unique:recipe_types,name,' . $id . ',recipe_type_id',
            'description' => 'nullable|string|max:1000',
        ]);

        $rt->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Recipe type updated successfully.',
            'data'    => $rt,
        ]);
    }

    public function destroy($id)
    {
        $rt = RecipeType::findOrFail($id);

        // Prevent deletion if batches are referencing this recipe type
        if ($rt->inventoryBatches()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete: this recipe type is used by one or more batches.',
            ], 422);
        }

        $rt->delete();

        return response()->json([
            'success' => true,
            'message' => 'Recipe type deleted successfully.',
        ]);
    }
}
