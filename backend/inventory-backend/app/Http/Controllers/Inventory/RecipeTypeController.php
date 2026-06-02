<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\RecipeType;

class RecipeTypeController extends Controller
{
    public function index()
    {
        return response()->json(RecipeType::orderBy('name')->get());
    }

    public function options()
    {
        $list = RecipeType::orderBy('name')->get(['recipe_type_id as id', 'name as label']);
        return response()->json($list);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'description' => 'nullable|string',
        ]);

        $recipeType = RecipeType::create($data);
        return response()->json($recipeType, 201);
    }

    public function show($id)
    {
        $rt = RecipeType::findOrFail($id);
        return response()->json($rt);
    }

    public function update(Request $request, $id)
    {
        $rt = RecipeType::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'description' => 'nullable|string',
        ]);

        $rt->update($data);
        return response()->json($rt);
    }

    public function destroy($id)
    {
        $rt = RecipeType::findOrFail($id);
        $rt->delete();
        return response()->json(['deleted' => true]);
    }
}
