<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminController extends Controller
{
    /**
     * Fast dashboard preview payload for UI cards/lists.
     */
    public function dashboardPreview()
    {
        try {
            $expiryAlertDays = $this->getExpiryAlertDays();
            $totalItemTypes = DB::table('item_types')->count();

            $inventoryValue = (float) DB::table('inventory_batches as ib')
                ->join('items as i', 'ib.item_id', '=', 'i.item_id')
                ->where('ib.status', 'active')
                ->selectRaw('COALESCE(SUM(ib.quantity * COALESCE(i.unit_value, 0)), 0) as total_value')
                ->value('total_value');

            $sectionCards = DB::table('item_types as it')
                ->leftJoin('items as i', function ($join) {
                    $join->on('it.item_type_id', '=', 'i.item_type_id')
                        ->where('i.is_active', 1);
                })
                ->select(
                    'it.type_name',
                    DB::raw('COUNT(i.item_id) as item_count')
                )
                ->groupBy('it.item_type_id', 'it.type_name')
                ->orderByDesc('item_count')
                ->limit(8)
                ->get()
                ->map(function ($row) {
                    return [
                        'title' => ucwords(str_replace('_', ' ', $row->type_name ?? 'Uncategorized')),
                        'count' => (int) $row->item_count,
                        'subtitle' => ((int) $row->item_count === 1) ? 'item' : 'items',
                    ];
                })
                ->values();

            $expiryRows = DB::table('expiry_alerts as ea')
                ->join('inventory_batches as ib', 'ea.batch_id', '=', 'ib.batch_id')
                ->join('items as i', 'ib.item_id', '=', 'i.item_id')
                ->where('ea.status', 'pending')
                ->where('ea.days_until_expiry', '<=', $expiryAlertDays)
                ->select(
                    'i.item_description as itemName',
                    DB::raw("CONCAT('Batch #', COALESCE(ib.batch_number, ea.batch_id)) as batchLabel"),
                    DB::raw('COALESCE(ea.days_until_expiry, 0) as daysLeft')
                )
                ->orderBy('ea.days_until_expiry', 'asc')
                ->limit(4)
                ->get();

            $recentTransactions = DB::table('inventory_transactions as tx')
                ->leftJoin('items as i', 'tx.item_id', '=', 'i.item_id')
                ->leftJoin('users as u', 'tx.performed_by', '=', 'u.user_id')
                ->select(
                    DB::raw("DATE_FORMAT(tx.transaction_date, '%b %e') as dateLabel"),
                    DB::raw('COALESCE(i.item_description, CONCAT("Item #", tx.item_id)) as itemName'),
                    DB::raw('UPPER(tx.transaction_type) as type'),
                    DB::raw('CONCAT(FORMAT(COALESCE(tx.quantity, 0), 0), " pcs") as quantityLabel'),
                    DB::raw('COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, ""))), ""), CONCAT("User #", tx.performed_by)) as performedBy'),
                    DB::raw('COALESCE(tx.destination, "N/A") as destination')
                )
                ->orderByDesc('tx.transaction_date')
                ->limit(5)
                ->get();

            return response()->json([
                'totalItemTypesCount' => $totalItemTypes,
                'inventoryValue' => $inventoryValue,
                'sectionCards' => $sectionCards,
                'expiryRows' => $expiryRows,
                'recentTransactions' => $recentTransactions,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'totalItemTypesCount' => 0,
                'inventoryValue' => 0,
                'sectionCards' => [],
                'expiryRows' => [],
                'recentTransactions' => [],
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get dashboard statistics for super admin
     */
    public function stats()
    {
        try {
            $expiryAlertDays = $this->getExpiryAlertDays();
            // Total and active users
            $totalUsers = DB::table('users')->count();
            $activeUsers = DB::table('users')->where('is_active', 1)->count();

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
                ->where('days_until_expiry', '<=', $expiryAlertDays)
                ->count();

            // Total categories
            $totalCategories = DB::table('categories')->count();

            // Items expiring within 30 days
            $expiringItems = 0;
            try {
                $expiringItems = DB::table('inventory_batches')
                    ->where('status', 'active')
                    ->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '>=', now()->toDateString())
                    ->whereDate('expiry_date', '<=', now()->addDays($expiryAlertDays)->toDateString())
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
        $expiryAlertDays = $this->getExpiryAlertDays();
        $alerts = [];

        // Expiry alerts
        $expiryAlerts = DB::table('expiry_alerts as ea')
            ->join('inventory_batches as ib', 'ea.batch_id', '=', 'ib.batch_id')
            ->join('items as i', 'ib.item_id', '=', 'i.item_id')
            ->where('ea.status', 'pending')
            ->where('ea.days_until_expiry', '<=', $expiryAlertDays)
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

    private function getExpiryAlertDays(): int
    {
        try {
            $value = DB::table('system_settings')
                ->where('setting_key', 'expiry_alert_days')
                ->value('setting_value');

            $days = (int) $value;
            return $days > 0 ? $days : 30;
        } catch (\Throwable $e) {
            return 30;
        }
    }
}
