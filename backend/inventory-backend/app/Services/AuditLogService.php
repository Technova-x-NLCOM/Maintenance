<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuditLogService
{
    public static function log(
        string $tableName,
        int $recordId,
        string $action,
        ?array $oldValues,
        ?array $newValues,
        ?Request $request = null,
        ?int $performedBy = null
    ): void {
        try {
            if (!in_array($action, ['INSERT', 'UPDATE', 'DELETE'], true)) {
                $action = 'UPDATE';
            }

            $userId = $performedBy;
            if ($userId === null) {
                $user = auth('api')->user();
                $userId = $user?->user_id ?? auth()->id();
            }

            DB::table('audit_log')->insert([
                'table_name' => $tableName,
                'record_id' => $recordId,
                'action' => $action,
                'old_values' => $oldValues ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
                'new_values' => $newValues ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
                'performed_by' => $userId,
                'ip_address' => $request?->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Audit log failed: ' . $e->getMessage());
        }
    }
}
