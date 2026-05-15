<?php

namespace App\Http\Controllers\Maintenance;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Arr;
use Illuminate\Http\JsonResponse;

class TableFormController extends Controller
{
    private array $tables;

    public function __construct()
    {
        $this->tables = config('maintenance.tables', []);
    }

    /**
     * Create a new row
     */
    public function create(Request $request, string $table): JsonResponse
    {
        $this->assertAllowedTable($table);
        $data = $this->sanitizePayload($table, $request->all());
        // Auto-generate `location_code` for `locations` table when not provided.
        if ($table === 'locations' && (!array_key_exists('location_code', $data) || !$data['location_code'])) {
            try {
                $max = DB::table('locations')
                    ->selectRaw("MAX(CAST(REPLACE(location_code, 'LOCATION-', '') AS UNSIGNED)) as maxnum")
                    ->value('maxnum');
                $next = ((int)$max) + 1;
            } catch (\Exception $e) {
                // Fallback: use count if query fails
                $next = DB::table('locations')->count() + 1;
            }
            $data['location_code'] = 'LOCATION-' . str_pad($next, 3, '0', STR_PAD_LEFT);
        }
        // Ensure timestamps are set when columns exist
        if (Schema::hasColumn($table, 'created_at') && !array_key_exists('created_at', $data)) {
            $data['created_at'] = now();
        }
        if (Schema::hasColumn($table, 'updated_at') && !array_key_exists('updated_at', $data)) {
            $data['updated_at'] = now();
        }

        // When creating RBAC user-role assignments via the generic maintenance form,
        // the frontend may omit `is_primary`. Keep a consistent single-primary role per user.
        if ($table === 'user_roles') {
            $this->applyUserRolesPrimaryRulesOnCreate($data);
        }

        // Insert row (avoid insertGetId for composite PK tables)
        $pk = $this->tables[$table]['primary_key'];
        if (is_array($pk)) {
            DB::table($table)->insert($data);
            // Log audit for composite key
            $this->logAudit($table, 0, 'INSERT', null, $data, $request);
            return response()->json(['status' => 'created'], 201);
        }
        if ($table === 'locations') {
            // Insert with retry to avoid race-condition on unique location_code
            $attempts = 0;
            $insertedId = null;
            while ($attempts < 5) {
                $attempts++;
                try {
                    DB::beginTransaction();
                    // regenerate code to reduce collision window
                    $max = DB::table('locations')
                        ->selectRaw("MAX(CAST(REPLACE(location_code, 'LOCATION-', '') AS UNSIGNED)) as maxnum")
                        ->lockForUpdate()
                        ->value('maxnum');
                    $next = ((int)$max) + 1;
                    $data['location_code'] = 'LOCATION-' . str_pad($next, 3, '0', STR_PAD_LEFT);

                    $insertedId = DB::table($table)->insertGetId($data);
                    // Log audit
                    $this->logAudit($table, $insertedId, 'INSERT', null, $data, $request);
                    DB::commit();
                    break;
                } catch (\Exception $e) {
                    DB::rollBack();
                    // If duplicate key, retry; otherwise rethrow
                    $msg = strtolower($e->getMessage());
                    if (strpos($msg, 'duplicate') !== false || strpos($msg, 'unique') !== false) {
                        // small sleep to reduce collision
                        usleep(100000);
                        continue;
                    }
                    throw $e;
                }
            }

            if ($insertedId === null) {
                abort(500, 'Failed to create location after several attempts');
            }

            // Return id and generated code for frontend convenience
            $created = DB::table('locations')->where('location_id', $insertedId)->first();
            return response()->json(['id' => $insertedId, 'location_code' => $created->location_code ?? null], 201);
        }

        $id = DB::table($table)->insertGetId($data);

        // Log audit
        $this->logAudit($table, $id, 'INSERT', null, $data, $request);

        return response()->json(['id' => $id], 201);
    }

    /**
     * Update an existing row
     */
    public function update(Request $request, string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        $data = $this->sanitizePayload($table, $request->all());
        
        // Get old values for audit log
        $oldValues = $this->fetchOldValues($table, $pk, $id, $request);
        
        // Always update updated_at when present
        if (Schema::hasColumn($table, 'updated_at')) {
            $data['updated_at'] = now();
        }
        
        if (is_array($pk)) {
            // Handle composite primary key - expect keys in the payload or query parameters
            $query = DB::table($table);
            foreach ($pk as $key) {
                $value = $request->query($key) ?? $request->input($key);
                if ($value !== null) {
                    $query->where($key, $value);
                }
            }
            // If no query params provided, try to use the id for the first key
            if (!$request->query() && !$request->has($pk[0])) {
                $query->where($pk[0], $id);
            }
            $query->update($data);
            // Log audit for composite key
            $this->logAudit($table, $id, 'UPDATE', $oldValues, $data, $request);
        } else {
            DB::table($table)->where($pk, $id)->update($data);
            // Log audit
            $this->logAudit($table, $id, 'UPDATE', $oldValues, $data, $request);
        }
        return response()->json(['status' => 'ok']);
    }

    private function assertAllowedTable(string $table): void
    {
        if (!array_key_exists($table, $this->tables)) {
            abort(404, 'Table not allowed');
        }

        if ($table === 'audit_log') {
            $user = auth('api')->user();
            if (!$user || (!$user->hasRole('super_admin') && !$user->hasPermission('view_audit'))) {
                abort(403, 'Insufficient permission to access audit logs');
            }
        }
    }

    private function sanitizePayload(string $table, array $input): array
    {
        $columns = Schema::getColumnListing($table);
        // Only keep known columns, exclude PK if auto-increment (single key only)
        $pk = $this->tables[$table]['primary_key'];
        $filtered = Arr::only($input, $columns);
        
        // Only remove single primary key (auto-increment), keep composite keys
        if (!is_array($pk)) {
            unset($filtered[$pk]);
        }
        
        // Remove timestamp fields that are auto-managed
        unset($filtered['created_at']);
        unset($filtered['updated_at']);
        unset($filtered['deleted_at']);
        
        return $filtered;
    }

    /**
     * Ensure the created `user_roles` row keeps the user's primary role consistent.
     *
     * Rules:
     * - If `is_primary` is omitted:
     *   - Set it to `true` only when the user currently has no primary role.
     * - If `is_primary` is provided:
     *   - When true: unset other primary rows for the same user.
     *   - When false: if the user currently has no primary role, keep this row primary.
     */
    private function applyUserRolesPrimaryRulesOnCreate(array &$data): void
    {
        if (!array_key_exists('user_id', $data)) return;

        $userId = (int)$data['user_id'];

        $hasPrimary = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('is_primary', true)
            ->exists();

        if (!array_key_exists('is_primary', $data)) {
            $data['is_primary'] = !$hasPrimary;
            return;
        }

        $incoming = $data['is_primary'];
        $isPrimary = is_bool($incoming) ? $incoming : filter_var($incoming, FILTER_VALIDATE_BOOLEAN);

        if ($isPrimary) {
            // Enforce single primary role.
            DB::table('user_roles')
                ->where('user_id', $userId)
                ->update(['is_primary' => false]);
            $data['is_primary'] = true;
            return;
        }

        // If user currently has no primary role, keep this one primary.
        $data['is_primary'] = $hasPrimary ? false : true;
    }

    /**
     * Log an audit entry
     */
    private function logAudit(string $table, $recordId, string $action, ?array $oldValues, ?array $newValues, Request $request): void
    {
        try {
            $user = auth('api')->user();
            DB::table('audit_log')->insert([
                'table_name' => $table,
                'record_id' => is_numeric($recordId) ? (int)$recordId : 0,
                'action' => $action,
                'old_values' => $oldValues !== null ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
                'new_values' => $newValues !== null ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
                'performed_by' => $user ? $user->user_id : null,
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Silently fail - don't break the main operation if audit logging fails
            \Log::error('Audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Fetch the original row before update so audit logs can include old values.
     */
    private function fetchOldValues(string $table, mixed $pk, mixed $id, Request $request): ?array
    {
        if (!is_array($pk)) {
            $row = DB::table($table)->where($pk, $id)->first();
            return $row ? (array) $row : null;
        }

        $query = DB::table($table);
        foreach ($pk as $key) {
            $value = $request->query($key) ?? $request->input($key);
            if ($value !== null) {
                $query->where($key, $value);
            }
        }

        if (!$request->query() && !$request->has($pk[0])) {
            $query->where($pk[0], $id);
        }

        $row = $query->first();
        return $row ? (array) $row : null;
    }
}
