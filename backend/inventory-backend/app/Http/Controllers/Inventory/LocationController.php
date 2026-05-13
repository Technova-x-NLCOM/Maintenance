<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LocationController extends Controller
{
    public function options(Request $request)
    {
        $query = DB::table('locations')
            ->select(
                'location_id',
                'location_code',
                'location_name',
                'location_type',
                'is_active'
            )
            ->where('is_active', true)
            ->orderBy('location_name');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('location_code', 'like', "%{$search}%")
                    ->orWhere('location_name', 'like', "%{$search}%")
                    ->orWhere('location_type', 'like', "%{$search}%");
            });
        }

        $locations = $query->limit(300)->get()->map(function ($location) {
            $location->display_name = trim(($location->location_code ? $location->location_code . ' - ' : '') . $location->location_name);
            return $location;
        });

        return response()->json([
            'success' => true,
            'message' => 'Location options retrieved successfully.',
            'data' => $locations,
        ]);
    }
}