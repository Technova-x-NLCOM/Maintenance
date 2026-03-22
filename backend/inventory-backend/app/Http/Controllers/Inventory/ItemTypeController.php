<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ItemTypeController extends Controller
{
    public function index()
    {
        $types = DB::table('item_types')
            ->select('item_type_id', 'type_name', 'description')
            ->orderBy('type_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Item types retrieved successfully.',
            'data' => $types,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type_name' => ['required', 'string', 'max:50', Rule::unique('item_types', 'type_name')],
            'description' => ['nullable', 'string'],
        ]);

        $id = DB::table('item_types')->insertGetId([
            'type_name' => trim($data['type_name']),
            'description' => $data['description'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('item_types')->where('item_type_id', $id)->first();

        return response()->json([
            'success' => true,
            'message' => 'Item type created successfully.',
            'data' => $row,
        ], 201);
    }
}
