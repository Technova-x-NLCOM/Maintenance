<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardKpiController extends Controller
{
    public function kpi()
    {
        $today          = now()->toDateString();
        $thisMonthStart = now()->startOfMonth()->toDateString();

        // ── 1. Out-of-stock items ─────────────────────────────────────────────
        $outOfStock = DB::table('items as i')
            ->leftJoin('inventory_batches as ib', function ($join) {
                $join->on('i.item_id', '=', 'ib.item_id')->where('ib.status', 'active');
            })
            ->where('i.is_active', true)
            ->groupBy('i.item_id')
            ->havingRaw('COALESCE(SUM(ib.quantity), 0) = 0')
            ->get(['i.item_id'])
            ->count();

        // ── 2. Below reorder level (but not zero) ────────────────────────────
        $belowReorder = DB::table('items as i')
            ->leftJoin('inventory_batches as ib', function ($join) {
                $join->on('i.item_id', '=', 'ib.item_id')->where('ib.status', 'active');
            })
            ->where('i.is_active', true)
            ->where('i.reorder_level', '>', 0)
            ->groupBy('i.item_id', 'i.reorder_level')
            ->havingRaw('COALESCE(SUM(ib.quantity), 0) > 0 AND COALESCE(SUM(ib.quantity), 0) < i.reorder_level')
            ->get(['i.item_id'])
            ->count();

        // ── 3. Expiring ≤ 7 days (critical) ─────────────────────────────────
        $expiringCritical = (int) DB::table('inventory_batches')
            ->where('status', 'active')
            ->where('quantity', '>', 0)
            ->whereNotNull('expiry_date')
            ->whereRaw('expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)')
            ->count();

        // ── 4. Expiring 8–30 days (warning) ──────────────────────────────────
        $expiringWarning = (int) DB::table('inventory_batches')
            ->where('status', 'active')
            ->where('quantity', '>', 0)
            ->whereNotNull('expiry_date')
            ->whereRaw('expiry_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 8 DAY) AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)')
            ->count();

        // ── 5–7. Schedule KPIs ────────────────────────────────────────────────
        $scheduledToday  = 0;
        $shortfallToday  = 0;
        $overdueSchedules = 0;
        $upcomingPlans   = [];

        if (Schema::hasTable('distribution_plan_schedules') && Schema::hasTable('distribution_templates')) {
            $scheduledToday = (int) DB::table('distribution_plan_schedules')
                ->whereDate('planned_date', $today)
                ->whereIn('status', ['planned', 'checked_pre'])
                ->count();

            // Shortfall approximation: planned today, no auto_allocation_ref
            $shortfallToday = (int) DB::table('distribution_plan_schedules')
                ->whereDate('planned_date', $today)
                ->where('status', 'planned')
                ->when(
                    Schema::hasColumn('distribution_plan_schedules', 'auto_allocation_ref'),
                    fn ($q) => $q->whereNull('auto_allocation_ref')
                )
                ->count();

            // Overdue: planned_date < today, still pending
            $overdueSchedules = (int) DB::table('distribution_plan_schedules')
                ->whereDate('planned_date', '<', $today)
                ->whereIn('status', ['planned', 'checked_pre'])
                ->when(
                    Schema::hasColumn('distribution_plan_schedules', 'is_deleted'),
                    fn ($q) => $q->where('is_deleted', false)
                )
                ->count();

            // Upcoming 14 days
            $upcomingRows = DB::table('distribution_plan_schedules as dps')
                ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
                ->whereBetween('dps.planned_date', [$today, now()->addDays(13)->toDateString()])
                ->whereNotIn('dps.status', ['cancelled'])
                ->when(
                    Schema::hasColumn('distribution_plan_schedules', 'is_deleted'),
                    fn ($q) => $q->where('dps.is_deleted', false)
                )
                ->orderBy('dps.planned_date')
                ->orderBy('dps.plan_id')
                ->limit(14)
                ->get([
                    'dps.plan_id',
                    'dps.week_label',
                    'dps.planned_date',
                    'dps.status',
                    'dps.target_unit_count',
                    'dt.template_name',
                ]);

            $hasAutoAllocAt = Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at');

            if ($hasAutoAllocAt) {
                // Re-fetch with auto_allocated_at column
                $upcomingRows = DB::table('distribution_plan_schedules as dps')
                    ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
                    ->whereBetween('dps.planned_date', [$today, now()->addDays(13)->toDateString()])
                    ->whereNotIn('dps.status', ['cancelled'])
                    ->when(
                        Schema::hasColumn('distribution_plan_schedules', 'is_deleted'),
                        fn ($q) => $q->where('dps.is_deleted', false)
                    )
                    ->orderBy('dps.planned_date')
                    ->orderBy('dps.plan_id')
                    ->limit(14)
                    ->get([
                        'dps.plan_id',
                        'dps.week_label',
                        'dps.planned_date',
                        'dps.status',
                        'dps.target_unit_count',
                        'dps.auto_allocated_at',
                        'dt.template_name',
                    ]);
            }

            $upcomingPlans = $upcomingRows->map(fn ($p) => [
                'plan_id'           => (int) $p->plan_id,
                'week_label'        => (string) $p->week_label,
                'planned_date'      => (string) $p->planned_date,
                'status'            => (string) $p->status,
                'target_unit_count' => (int) $p->target_unit_count,
                'auto_allocated'    => $hasAutoAllocAt && !empty($p->auto_allocated_at),
                'template_name'     => (string) $p->template_name,
            ])->values()->all();
        }

        // ── 8. Auto-allocations this month ────────────────────────────────────
        $autoAllocationsMonth = 0;
        if (
            Schema::hasTable('distribution_plan_schedules') &&
            Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at')
        ) {
            $autoAllocationsMonth = (int) DB::table('distribution_plan_schedules')
                ->whereNotNull('auto_allocated_at')
                ->whereDate('auto_allocated_at', '>=', $thisMonthStart)
                ->count();
        }

        // ── 9. Total active stock ─────────────────────────────────────────────
        $totalActiveStock = (int) DB::table('inventory_batches')
            ->where('status', 'active')
            ->sum('quantity');

        // ── 10. IN / OUT quantities this month ───────────────────────────────
        $inThisMonth = (int) DB::table('inventory_transactions')
            ->where('transaction_type', 'IN')
            ->whereDate('transaction_date', '>=', $thisMonthStart)
            ->sum('quantity');

        $outThisMonth = (int) DB::table('inventory_transactions')
            ->where('transaction_type', 'OUT')
            ->whereDate('transaction_date', '>=', $thisMonthStart)
            ->sum('quantity');

        // ── 11. Discrepancy KPIs (this month) ────────────────────────────────
        // DISCREPANCY transactions: quantity > 0 = surplus, quantity < 0 = shortage
        $discrepancyThisMonth = (int) DB::table('inventory_transactions')
            ->where('transaction_type', 'DISCREPANCY')
            ->whereDate('transaction_date', '>=', $thisMonthStart)
            ->count();

        $shortageVarianceMonth = (int) abs(
            DB::table('inventory_transactions')
                ->where('transaction_type', 'DISCREPANCY')
                ->where('quantity', '<', 0)
                ->whereDate('transaction_date', '>=', $thisMonthStart)
                ->sum('quantity') ?? 0
        );

        $surplusVarianceMonth = (int) (
            DB::table('inventory_transactions')
                ->where('transaction_type', 'DISCREPANCY')
                ->where('quantity', '>', 0)
                ->whereDate('transaction_date', '>=', $thisMonthStart)
                ->sum('quantity') ?? 0
        );

        // ── 12. Discrepancy trend — last 6 calendar months ───────────────────
        // Returns array of { month, surplus, shortage } for the bar chart.
        $discrepancyTrend = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = now()->copy()->subMonths($i)->startOfMonth()->toDateString();
            $monthEnd   = now()->copy()->subMonths($i)->endOfMonth()->toDateString();
            $label      = now()->copy()->subMonths($i)->format('M Y');

            $surplus = (int) (DB::table('inventory_transactions')
                ->where('transaction_type', 'DISCREPANCY')
                ->where('quantity', '>', 0)
                ->whereDate('transaction_date', '>=', $monthStart)
                ->whereDate('transaction_date', '<=', $monthEnd)
                ->sum('quantity') ?? 0);

            $shortage = (int) abs(DB::table('inventory_transactions')
                ->where('transaction_type', 'DISCREPANCY')
                ->where('quantity', '<', 0)
                ->whereDate('transaction_date', '>=', $monthStart)
                ->whereDate('transaction_date', '<=', $monthEnd)
                ->sum('quantity') ?? 0);

            $discrepancyTrend[] = [
                'month'    => $label,
                'surplus'  => $surplus,
                'shortage' => $shortage,
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'out_of_stock_items'       => (int) $outOfStock,
                'below_reorder_items'      => (int) $belowReorder,
                'expiring_critical'        => $expiringCritical,
                'expiring_warning'         => $expiringWarning,
                'scheduled_today'          => $scheduledToday,
                'shortfall_today'          => $shortfallToday,
                'overdue_schedules'        => $overdueSchedules,
                'total_active_stock'       => $totalActiveStock,
                'in_this_month'            => $inThisMonth,
                'out_this_month'           => $outThisMonth,
                'auto_allocations_month'   => $autoAllocationsMonth,
                'upcoming_plans'           => $upcomingPlans,
                // Discrepancy
                'discrepancy_this_month'   => $discrepancyThisMonth,
                'shortage_variance_month'  => $shortageVarianceMonth,
                'surplus_variance_month'   => $surplusVarianceMonth,
                'discrepancy_trend'        => $discrepancyTrend,
            ],
        ]);
    }
}
