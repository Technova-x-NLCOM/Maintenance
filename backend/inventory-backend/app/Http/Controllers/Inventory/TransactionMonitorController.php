<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionMonitorController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 20), 100);

        $query = DB::table('inventory_transactions as t')
            ->join('items as i', 't.item_id', '=', 'i.item_id')
            ->leftJoin('users as u', 't.performed_by', '=', 'u.user_id')
            ->leftJoin('inventory_batches as b', 't.batch_id', '=', 'b.batch_id')
            ->leftJoin('locations as bl', 'b.location_id', '=', 'bl.location_id')
            ->leftJoin('locations as fl', 't.from_location_id', '=', 'fl.location_id')
            ->leftJoin('locations as tl', 't.to_location_id', '=', 'tl.location_id')
            ->select(
                't.transaction_id',
                't.transaction_type',
                't.quantity',
                't.reference_number',
                't.transaction_date',
                't.reason',
                't.notes',
                't.destination',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                'b.batch_number',
                'bl.location_name as batch_location_name',
                'fl.location_name as from_location_name',
                'tl.location_name as to_location_name',
                DB::raw("CONCAT(u.first_name, ' ', u.last_name) as performed_by_name"),
                't.created_at'
            )
            ->orderByDesc('t.transaction_date');

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('i.item_code', 'like', "%{$s}%")
                  ->orWhere('i.item_description', 'like', "%{$s}%")
                  ->orWhere('t.reference_number', 'like', "%{$s}%")
                                    ->orWhere('t.destination', 'like', "%{$s}%")
                                    ->orWhere('bl.location_name', 'like', "%{$s}%")
                                    ->orWhere('fl.location_name', 'like', "%{$s}%")
                                    ->orWhere('tl.location_name', 'like', "%{$s}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('t.transaction_type', strtoupper($request->input('type')));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('t.transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('t.transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('location_id')) {
            $locationId = (int) $request->input('location_id');
            $query->where(function ($builder) use ($locationId) {
                $builder->where('b.location_id', $locationId)
                    ->orWhere('t.from_location_id', $locationId)
                    ->orWhere('t.to_location_id', $locationId);
            });
        }

        $results = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Transactions retrieved successfully.',
            'data' => $results,
        ]);
    }

    public function stockReport(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 50), 500);

        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', 'location_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id', 'location_id');

        $inSubquery = DB::table('inventory_transactions')
            ->select('item_id', DB::raw('COALESCE(to_location_id, from_location_id) as location_id'), DB::raw('COALESCE(SUM(quantity), 0) as total_in'))
            ->where('transaction_type', 'IN')
            ->groupBy('item_id', DB::raw('COALESCE(to_location_id, from_location_id)'));

        $outSubquery = DB::table('inventory_transactions')
            ->select('item_id', DB::raw('from_location_id as location_id'), DB::raw('COALESCE(SUM(quantity), 0) as total_out'))
            ->where('transaction_type', 'OUT')
            ->groupBy('item_id', 'from_location_id');

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', fn($j) => $j->on('i.item_id', '=', 's.item_id'))
            ->leftJoinSub($inSubquery, 'tin', function ($join) {
                $join->on('i.item_id', '=', 'tin.item_id')
                    ->on('s.location_id', '=', 'tin.location_id');
            })
            ->leftJoinSub($outSubquery, 'tout', function ($join) {
                $join->on('i.item_id', '=', 'tout.item_id')
                    ->on('s.location_id', '=', 'tout.location_id');
            })
            ->leftJoin('locations as l', 's.location_id', '=', 'l.location_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'it.type_name as item_type_name',
                'c.category_name',
                'l.location_id',
                'l.location_code',
                'l.location_name',
                'i.measurement_unit',
                'i.reorder_level',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                DB::raw('COALESCE(tin.total_in, 0) as total_in'),
                DB::raw('COALESCE(tout.total_out, 0) as total_out'),
                'i.is_active'
            )
            ->where('i.is_active', true)
            ->orderBy('l.location_name')
            ->orderBy('i.item_description');

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('i.item_code', 'like', "%{$s}%")
                  ->orWhere('i.item_description', 'like', "%{$s}%")
                  ->orWhere('c.category_name', 'like', "%{$s}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('i.category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('s.location_id', (int) $request->input('location_id'));
        }

        $stockStatus = $request->input('stock_status');

        if ($stockStatus === 'out_of_stock') {
            $query->whereRaw('COALESCE(s.current_stock, 0) = 0');
        }

        if ($stockStatus === 'low_stock' || $request->input('low_stock') === '1') {
            $query->whereRaw('COALESCE(s.current_stock, 0) <= i.reorder_level');
        }

        $results = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Stock report retrieved successfully.',
            'data' => $results,
        ]);
    }

    public function storageInventory(Request $request)
    {
        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', 'location_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id', 'location_id');

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', function ($join) {
                $join->on('i.item_id', '=', 's.item_id');
            })
            ->leftJoin('locations as l', 's.location_id', '=', 'l.location_id')
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'it.type_name as item_type_name',
                'c.category_name',
                'l.location_id',
                'l.location_code',
                'l.location_name',
                'l.location_type',
                'i.measurement_unit',
                'i.reorder_level',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                'i.is_active'
            )
            ->where('i.is_active', true)
            ->orderBy('l.location_name')
            ->orderBy('i.item_description');

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('i.item_code', 'like', "%{$s}%")
                  ->orWhere('i.item_description', 'like', "%{$s}%")
                  ->orWhere('c.category_name', 'like', "%{$s}%")
                  ->orWhere('l.location_code', 'like', "%{$s}%")
                  ->orWhere('l.location_name', 'like', "%{$s}%");
            });
        }

        if ($request->filled('location_id')) {
            $query->where('s.location_id', (int) $request->input('location_id'));
        }

        if ($request->filled('category_id')) {
            $query->where('i.category_id', (int) $request->input('category_id'));
        }

        $stockStatus = $request->input('stock_status');
        if ($stockStatus === 'out_of_stock') {
            $query->whereRaw('COALESCE(s.current_stock, 0) = 0');
        }
        if ($stockStatus === 'low_stock') {
            $query->whereRaw('COALESCE(s.current_stock, 0) <= i.reorder_level');
        }

        $rows = $query->get();

        $locations = $rows
            ->groupBy(fn ($row) => $row->location_id ? (string) $row->location_id : 'unassigned')
            ->map(function ($group, $key) {
                $first = $group->first();
                $items = $group->map(function ($row) {
                    return [
                        'item_id' => $row->item_id,
                        'item_code' => $row->item_code,
                        'item_description' => $row->item_description,
                        'item_type_name' => $row->item_type_name,
                        'category_name' => $row->category_name,
                        'measurement_unit' => $row->measurement_unit,
                        'reorder_level' => (int) $row->reorder_level,
                        'current_stock' => (float) $row->current_stock,
                        'is_low_stock' => (float) $row->current_stock <= (int) $row->reorder_level,
                    ];
                })->values();

                $totalStock = $items->sum('current_stock');
                $lowStockCount = $items->filter(fn ($item) => $item['is_low_stock'])->count();

                return [
                    'location_id' => $first->location_id,
                    'location_code' => $first->location_code,
                    'location_name' => $first->location_name ?: 'Unassigned Storage',
                    'location_type' => $first->location_type,
                    'item_count' => $items->count(),
                    'total_stock' => $totalStock,
                    'low_stock_count' => $lowStockCount,
                    'items' => $items,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Storage inventory retrieved successfully.',
            'data' => [
                'locations' => $locations,
                'location_count' => $locations->count(),
                'total_items' => $locations->sum('item_count'),
                'total_stock' => $locations->sum('total_stock'),
            ],
        ]);
    }
}
