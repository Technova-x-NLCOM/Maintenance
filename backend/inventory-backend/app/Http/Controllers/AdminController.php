<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /**
     * Get dashboard statistics for admin
     */
    public function stats()
    {
        try {
            // Total and active users (excluding super admins)
            $superAdminUserIds = [];
            try {
                $superAdminUserIds = DB::table('user_roles')
                    ->join('roles', 'user_roles.role_id', '=', 'roles.role_id')
                    ->where('roles.role_name', 'Super Admin')
                    ->pluck('user_roles.user_id')
                    ->toArray();
            } catch (\Exception $e) {
                $superAdminUserIds = [];
            }

            if (count($superAdminUserIds) > 0) {
                $totalUsers = DB::table('users')
                    ->whereNotIn('user_id', $superAdminUserIds)
                    ->count();
                
                $activeUsers = DB::table('users')
                    ->where('is_active', 1)
                    ->whereNotIn('user_id', $superAdminUserIds)
                    ->count();
            } else {
                $totalUsers = DB::table('users')->count();
                $activeUsers = DB::table('users')->where('is_active', 1)->count();
            }

            // Total items
            $totalItems = DB::table('items')->where('is_active', 1)->count();

            // Low stock items - simplified query
            $lowStockItems = 0;
            try {
                $lowStockItems = DB::table('items as i')
                    ->leftJoin('inventory_batches as ib', function ($join) {
                        $join->on('i.item_id', '=', 'ib.item_id')
                            ->where('ib.status', '=', 'active');
                    })
                    ->where('i.is_active', 1)
                    ->where('i.reorder_level', '>', 0)
                    ->groupBy('i.item_id', 'i.reorder_level')
                    ->havingRaw('COALESCE(SUM(ib.quantity), 0) <= i.reorder_level')
                    ->get()
                    ->count();
            } catch (\Exception $e) {
                $lowStockItems = 0;
            }

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
            $expiringItems = 0;
            try {
                $expiringItems = DB::table('inventory_batches')
                    ->where('status', 'active')
                    ->whereNotNull('expiry_date')
                    ->whereRaw('expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)')
                    ->count();
            } catch (\Exception $e) {
                $expiringItems = 0;
            }

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
        } catch (\Exception $e) {
            return response()->json([
                'totalUsers' => 0,
                'activeUsers' => 0,
                'totalItems' => 0,
                'lowStockItems' => 0,
                'totalTransactions' => 0,
                'pendingAlerts' => 0,
                'totalCategories' => 0,
                'expiringItems' => 0,
                'error' => $e->getMessage()
            ], 500);
        }
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

        // Low stock alerts
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
            // Create user-friendly message based on stock level
            $currentStock = (int) $item->current_stock;
            $reorderLevel = (int) $item->reorder_level;
            
            if ($currentStock == 0) {
                $message = "{$item->item_description} is OUT OF STOCK! Please restock immediately.";
                $severity = 'critical';
            } else if ($currentStock < $reorderLevel) {
                $message = "{$item->item_description} is running low. Only {$currentStock} left (minimum should be {$reorderLevel}).";
                $severity = 'warning';
            } else {
                // Stock equals reorder level - needs attention soon
                $message = "{$item->item_description} has reached minimum stock level ({$currentStock}). Consider restocking soon.";
                $severity = 'info';
            }
            
            $alerts[] = (object)[
                'alert_id' => 'low_stock_' . $item->item_id,
                'type' => 'low_stock',
                'message' => $message,
                'severity' => $severity,
                'created_at' => now()->toDateTimeString(),
                'acknowledged' => false,
            ];
        }

        // Sort by severity
        usort($alerts, function ($a, $b) {
            $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];
            return ($severityOrder[$a->severity] ?? 3) - ($severityOrder[$b->severity] ?? 3);
        });

        return response()->json(array_slice($alerts, 0, 15));
    }
}
