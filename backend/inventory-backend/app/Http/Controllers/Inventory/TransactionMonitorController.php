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
                  ->orWhere('t.destination', 'like', "%{$s}%");
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
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        $inSubquery = DB::table('inventory_transactions')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as total_in'))
            ->where('transaction_type', 'IN')
            ->groupBy('item_id');

        $outSubquery = DB::table('inventory_transactions')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as total_out'))
            ->where('transaction_type', 'OUT')
            ->groupBy('item_id');

        $query = DB::table('items as i')
            ->leftJoin('item_types as it', 'i.item_type_id', '=', 'it.item_type_id')
            ->leftJoin('categories as c', 'i.category_id', '=', 'c.category_id')
            ->leftJoinSub($stockSubquery, 's', fn($j) => $j->on('i.item_id', '=', 's.item_id'))
            ->leftJoinSub($inSubquery, 'tin', fn($j) => $j->on('i.item_id', '=', 'tin.item_id'))
            ->leftJoinSub($outSubquery, 'tout', fn($j) => $j->on('i.item_id', '=', 'tout.item_id'))
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'it.type_name as item_type_name',
                'c.category_name',
                'i.measurement_unit',
                'i.reorder_level',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
                DB::raw('COALESCE(tin.total_in, 0) as total_in'),
                DB::raw('COALESCE(tout.total_out, 0) as total_out'),
                'i.is_active'
            )
            ->where('i.is_active', true)
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
}
