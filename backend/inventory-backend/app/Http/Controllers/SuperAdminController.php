<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminController extends Controller
{
    /**
     * Get dashboard statistics for super admin
     */
    public function stats()
    {
        // Total and active users
        $totalUsers = DB::table('users')->count();
        $activeUsers = DB::table('users')->where('is_active', true)->count();

        // Total items
        $totalItems = DB::table('items')->where('is_active', true)->count();

        // Low stock items (below reorder level)
        $lowStockItems = DB::table('items as i')
            ->leftJoin('inventory_batches as ib', function ($join) {
                $join->on('i.item_id', '=', 'ib.item_id')
                    ->where('ib.status', '=', 'active');
            })
            ->where('i.is_active', true)
            ->groupBy('i.item_id', 'i.reorder_level')
            ->havingRaw('COALESCE(SUM(ib.quantity), 0) <= i.reorder_level AND i.reorder_level > 0')
            ->count();

        // Total transactions this month
        $totalTransactions = DB::table('inventory_transactions')
            ->whereMonth('transaction_date', now()->month)
            ->whereYear('transaction_date', now()->year)
            ->count();

        // Pending alerts
        $pendingAlerts = DB::table('expiry_alerts')
            ->where('status', 'pending')
            ->count();

        // Total categories
        $totalCategories = DB::table('categories')->count();

        // Items expiring within 30 days
        $expiringItems = DB::table('inventory_batches')
            ->where('status', 'active')
            ->whereNotNull('expiry_date')
            ->whereRaw('DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 30')
            ->count();

        return response()->json([
            'totalUsers' => $totalUsers,
            'activeUsers' => $activeUsers,
            'totalItems' => $totalItems,
            'lowStockItems' => $lowStockItems,
            'totalTransactions' => $totalTransactions,
            'pendingAlerts' => $pendingAlerts,
            'totalCategories' => $totalCategories,
            'expiringItems' => $expiringItems,
        ]);
    }

    /**
     * Get recent audit log activity
     */
    public function activity(Request $request)
    {
        $limit = $request->input('limit', 10);

        $activity = DB::table('audit_log as al')
            ->leftJoin('users as u', 'al.performed_by', '=', 'u.user_id')
            ->select(
                'al.log_id',
                'al.table_name',
                'al.record_id',
                'al.action',
                'al.performed_by',
                DB::raw("CONCAT(u.first_name, ' ', u.last_name) as performed_by_name"),
                'al.ip_address',
                'al.created_at'
            )
            ->orderBy('al.created_at', 'desc')
            ->limit($limit)
            ->get();

        return response()->json($activity);
    }

    /**
     * Get system alerts (expiry alerts + low stock)
     */
    public function alerts()
    {
        $alerts = [];

        // Expiry alerts
        $expiryAlerts = DB::table('expiry_alerts as ea')
            ->join('inventory_batches as ib', 'ea.batch_id', '=', 'ib.batch_id')
            ->join('items as i', 'ib.item_id', '=', 'i.item_id')
            ->where('ea.status', 'pending')
            ->select(
                'ea.alert_id',
                DB::raw("'expiry' as type"),
                DB::raw("CONCAT(i.item_description, ' (Batch: ', ib.batch_number, ') expires in ', ea.days_until_expiry, ' days') as message"),
                DB::raw("CASE 
                    WHEN ea.days_until_expiry <= 7 THEN 'critical'
                    WHEN ea.days_until_expiry <= 14 THEN 'warning'
                    ELSE 'info'
                END as severity"),
                'ea.created_at',
                DB::raw('false as acknowledged')
            )
            ->orderBy('ea.days_until_expiry', 'asc')
            ->limit(10)
            ->get();

        foreach ($expiryAlerts as $alert) {
            $alerts[] = $alert;
        }

        // Low stock alerts (generated dynamically)
        $lowStockItems = DB::table('items as i')
            ->leftJoin('inventory_batches as ib', function ($join) {
                $join->on('i.item_id', '=', 'ib.item_id')
                    ->where('ib.status', '=', 'active');
            })
            ->where('i.is_active', true)
            ->where('i.reorder_level', '>', 0)
            ->groupBy('i.item_id', 'i.item_description', 'i.reorder_level')
            ->havingRaw('COALESCE(SUM(ib.quantity), 0) <= i.reorder_level')
            ->select(
                'i.item_id',
                'i.item_description',
                'i.reorder_level',
                DB::raw('COALESCE(SUM(ib.quantity), 0) as current_stock')
            )
            ->limit(10)
            ->get();

        foreach ($lowStockItems as $item) {
            $alerts[] = (object)[
                'alert_id' => 'low_stock_' . $item->item_id,
                'type' => 'low_stock',
                'message' => "{$item->item_description} is low on stock ({$item->current_stock}/{$item->reorder_level})",
                'severity' => $item->current_stock == 0 ? 'critical' : 'warning',
                'created_at' => now()->toDateTimeString(),
                'acknowledged' => false,
            ];
        }

        // Sort by severity (critical first)
        usort($alerts, function ($a, $b) {
            $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];
            return ($severityOrder[$a->severity] ?? 3) - ($severityOrder[$b->severity] ?? 3);
        });

        return response()->json(array_slice($alerts, 0, 15));
    }

    /**
     * Acknowledge an alert
     */
    public function acknowledgeAlert(Request $request, $alertId)
    {
        $user = auth('api')->user();

        $updated = DB::table('expiry_alerts')
            ->where('alert_id', $alertId)
            ->update([
                'status' => 'acknowledged',
                'acknowledged_by' => $user->user_id,
                'acknowledged_at' => now(),
            ]);

        if ($updated) {
            return response()->json(['message' => 'Alert acknowledged']);
        }

        return response()->json(['message' => 'Alert not found'], 404);
    }
}
