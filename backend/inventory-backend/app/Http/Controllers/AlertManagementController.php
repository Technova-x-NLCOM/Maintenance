<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Models\AlertHistory;
use App\Models\UserAlertSettings;
use App\Models\AlertEscalationRule;

class AlertManagementController extends Controller
{
    /**
     * Get alerts with filtering and search
     */
    public function getAlerts(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'nullable|in:expiry,low_stock,system',
            'severity' => 'nullable|in:critical,warning,info',
            'status' => 'nullable|in:pending,acknowledged,resolved,escalated',
            'search' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $query = AlertHistory::with(['creator', 'acknowledger', 'resolver']);

        // Apply filters
        if ($request->filled('type')) {
            $query->where('alert_type', $request->type);
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->severity);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Apply search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('message', 'LIKE', "%{$search}%")
                  ->orWhere('alert_reference', 'LIKE', "%{$search}%");
            });
        }

        // Order by severity and creation date
        $query->orderByRaw("FIELD(severity, 'critical', 'warning', 'info')")
              ->orderBy('created_at', 'desc');

        $perPage = $request->get('per_page', 20);
        $alerts = $query->paginate($perPage);

        return response()->json($alerts);
    }

    /**
     * Bulk acknowledge alerts
     */
    public function bulkAcknowledge(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'alert_ids' => 'required|array',
            'alert_ids.*' => 'integer|exists:alert_history,history_id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = auth('api')->user();
        $alertIds = $request->alert_ids;

        $updated = AlertHistory::whereIn('history_id', $alertIds)
            ->where('status', 'pending')
            ->update([
                'status' => 'acknowledged',
                'acknowledged_by' => $user->user_id,
                'acknowledged_at' => now()
            ]);

        return response()->json([
            'message' => "Successfully acknowledged {$updated} alerts",
            'updated_count' => $updated
        ]);
    }

    /**
     * Bulk resolve alerts
     */
    public function bulkResolve(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'alert_ids' => 'required|array',
            'alert_ids.*' => 'integer|exists:alert_history,history_id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = auth('api')->user();
        $alertIds = $request->alert_ids;

        $updated = AlertHistory::whereIn('history_id', $alertIds)
            ->whereIn('status', ['pending', 'acknowledged'])
            ->update([
                'status' => 'resolved',
                'resolved_by' => $user->user_id,
                'resolved_at' => now()
            ]);

        return response()->json([
            'message' => "Successfully resolved {$updated} alerts",
            'updated_count' => $updated
        ]);
    }

    /**
     * Get alert analytics
     */
    public function getAnalytics(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'period' => 'nullable|in:7d,30d,90d,1y',
            'timezone' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $period = $request->get('period', '30d');
        $days = match($period) {
            '7d' => 7,
            '30d' => 30,
            '90d' => 90,
            '1y' => 365,
            default => 30
        };

        $startDate = now()->subDays($days);

        // Alert counts by type and severity
        $alertsByType = AlertHistory::where('created_at', '>=', $startDate)
            ->select('alert_type', 'severity', DB::raw('COUNT(*) as count'))
            ->groupBy('alert_type', 'severity')
            ->get();

        // Alert resolution times
        $resolutionTimes = AlertHistory::where('created_at', '>=', $startDate)
            ->whereNotNull('resolved_at')
            ->select(
                'alert_type',
                'severity',
                DB::raw('AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_resolution_minutes'),
                DB::raw('COUNT(*) as resolved_count')
            )
            ->groupBy('alert_type', 'severity')
            ->get();

        // Daily alert trends
        $dailyTrends = AlertHistory::where('created_at', '>=', $startDate)
            ->select(
                DB::raw('DATE(created_at) as date'),
                'severity',
                DB::raw('COUNT(*) as count')
            )
            ->groupBy(DB::raw('DATE(created_at)'), 'severity')
            ->orderBy('date')
            ->get();

        // Top alert messages
        $topAlerts = AlertHistory::where('created_at', '>=', $startDate)
            ->select('message', 'alert_type', 'severity', DB::raw('COUNT(*) as count'))
            ->groupBy('message', 'alert_type', 'severity')
            ->orderBy('count', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'period' => $period,
            'alerts_by_type' => $alertsByType,
            'resolution_times' => $resolutionTimes,
            'daily_trends' => $dailyTrends,
            'top_alerts' => $topAlerts,
            'summary' => [
                'total_alerts' => AlertHistory::where('created_at', '>=', $startDate)->count(),
                'resolved_alerts' => AlertHistory::where('created_at', '>=', $startDate)->where('status', 'resolved')->count(),
                'pending_alerts' => AlertHistory::where('status', 'pending')->count(),
                'critical_alerts' => AlertHistory::where('created_at', '>=', $startDate)->where('severity', 'critical')->count()
            ]
        ]);
    }

    /**
     * Get user alert settings
     */
    public function getUserSettings()
    {
        $user = auth('api')->user();
        $settings = UserAlertSettings::getForUser($user->user_id);
        
        return response()->json($settings);
    }

    /**
     * Update user alert settings
     */
    public function updateUserSettings(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'alert_frequency' => 'required|in:immediate,daily,weekly',
            'expiry_warning_days' => 'required|integer|min:1|max:365',
            'critical_expiry_days' => 'required|integer|min:1|max:30',
            'warning_expiry_days' => 'required|integer|min:1|max:60',
            'email_notifications' => 'required|boolean',
            'push_notifications' => 'required|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $user = auth('api')->user();
        $settings = UserAlertSettings::getForUser($user->user_id);
        
        $settings->update($request->all());

        return response()->json([
            'message' => 'Alert settings updated successfully',
            'settings' => $settings
        ]);
    }
}