<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuditExportController extends Controller
{
    /**
     * Record an export action (Excel or PDF download) in the audit log.
     *
     * Expected JSON body:
     *   {
     *     "report_type": "stock_report" | "transaction_history",
     *     "format":      "excel" | "pdf",
     *     "row_count":   123
     *   }
     */
    public function log(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report_type' => 'required|string|in:stock_report,transaction_history',
            'format'      => 'required|string|in:excel,pdf',
            'row_count'   => 'nullable|integer|min:0',
        ]);

        $user   = auth('api')->user();
        $userId = $user?->user_id ?? auth()->id();

        $reportLabels = [
            'stock_report'         => 'Stock Report',
            'transaction_history'  => 'Transaction History',
        ];

        $newValues = [
            'report_type'  => $validated['report_type'],
            'report_label' => $reportLabels[$validated['report_type']] ?? $validated['report_type'],
            'format'       => strtoupper($validated['format']),
            'row_count'    => $validated['row_count'] ?? null,
        ];

        try {
            DB::table('audit_log')->insert([
                'table_name'   => 'export_log',
                'record_id'    => 0,
                'action'       => 'INSERT',
                'old_values'   => null,
                'new_values'   => json_encode($newValues, JSON_UNESCAPED_UNICODE),
                'performed_by' => $userId,
                'ip_address'   => $request->ip(),
                'created_at'   => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Export audit log failed: ' . $e->getMessage());
            // Non-fatal — the download already happened; just return success.
        }

        return response()->json(['status' => 'logged'], 201);
    }
}
