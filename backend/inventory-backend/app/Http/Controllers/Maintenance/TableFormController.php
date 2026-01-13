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
        // Ensure timestamps are set when columns exist
        if (Schema::hasColumn($table, 'created_at') && !array_key_exists('created_at', $data)) {
            $data['created_at'] = now();
        }
        if (Schema::hasColumn($table, 'updated_at') && !array_key_exists('updated_at', $data)) {
            $data['updated_at'] = now();
        }

        // Insert row (avoid insertGetId for composite PK tables)
        $pk = $this->tables[$table]['primary_key'];
        if (is_array($pk)) {
            DB::table($table)->insert($data);
            // Log audit for composite key
            $this->logAudit($table, 0, 'INSERT', null, $data, $request);
            return response()->json(['status' => 'created'], 201);
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
        $oldValues = null;
        if (!is_array($pk)) {
            $oldValues = (array) DB::table($table)->where($pk, $id)->first();
        }
        
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
                'old_values' => $oldValues ? json_encode($oldValues) : null,
                'new_values' => $newValues ? json_encode($newValues) : null,
                'performed_by' => $user ? $user->user_id : null,
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Silently fail - don't break the main operation if audit logging fails
            \Log::error('Audit log failed: ' . $e->getMessage());
        }
    }
}
