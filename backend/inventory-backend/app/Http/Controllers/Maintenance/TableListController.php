<?php

namespace App\Http\Controllers\Maintenance;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\JsonResponse;

class TableListController extends Controller
{
    private array $tables;

    public function __construct()
    {
        $this->tables = config('maintenance.tables', []);
    }

    /**
     * Get table schema
     */
    public function schema(string $table): JsonResponse
    {
        $this->assertAllowedTable($table);

        $columns = Schema::getColumnListing($table);
        
        // Get hidden columns from config
        $hiddenColumns = $this->tables[$table]['hidden_columns'] ?? [];
        
        // Filter out hidden columns
        $visibleColumns = array_values(array_filter($columns, function($col) use ($hiddenColumns) {
            return !in_array($col, $hiddenColumns);
        }));
        
        // Pull relations mapping from config, if any
        $relations = $this->tables[$table]['relations'] ?? [];

        // Get column details including nullable information and enum values
        $columnDetails = [];
        $enumValues = [];
        foreach ($visibleColumns as $col) {
            $columnInfo = DB::select("SHOW COLUMNS FROM `{$table}` WHERE Field = ?", [$col])[0] ?? null;
            $type = $columnInfo->Type ?? 'text';
            $columnDetails[$col] = [
                'nullable' => $columnInfo ? ($columnInfo->Null === 'YES') : true,
                'type' => $type,
            ];
            
            // Extract ENUM values if the column is an ENUM type
            if (preg_match("/^enum\((.+)\)$/i", $type, $matches)) {
                // Parse enum values: 'value1','value2','value3'
                preg_match_all("/'([^']+)'/", $matches[1], $enumMatches);
                if (!empty($enumMatches[1])) {
                    $enumValues[$col] = $enumMatches[1];
                }
            }
        }

        // Build simple lookup maps for foreign keys to display labels
        $lookups = [];
        foreach ($relations as $col => $rel) {
            $refTable = $rel['ref_table'] ?? null;
            $refKey = $rel['ref_key'] ?? null;
            $labelCol = $rel['label_column'] ?? null;
            if ($refTable && $refKey && $labelCol && Schema::hasTable($refTable)) {
                try {
                    $rows = DB::table($refTable)->select([$refKey, $labelCol])->get();
                    $map = [];
                    foreach ($rows as $r) {
                        $map[$r->{$refKey}] = $r->{$labelCol};
                    }
                    $lookups[$col] = $map;
                } catch (\Throwable $e) {
                    // Skip lookup if any error occurs
                }
            }
        }

        return response()->json([
            'table' => $table,
            'columns' => $visibleColumns,
            'primary_key' => $this->tables[$table]['primary_key'],
            'soft_deletes' => (bool)($this->tables[$table]['soft_deletes'] ?? false),
            'relations' => $relations,
            'lookups' => $lookups,
            'column_details' => $columnDetails,
            'enum_values' => $enumValues,
        ]);
    }

    /**
     * List rows from a table
     */
    public function listRows(Request $request, string $table): JsonResponse
    {
        $this->assertAllowedTable($table);
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        $showDeleted = filter_var($request->query('showDeleted', 'false'), FILTER_VALIDATE_BOOLEAN);
        $pk = $this->tables[$table]['primary_key'];
        $search = $request->query('search');

        $query = DB::table($table);
        if ($table === 'audit_log') {
            $query = DB::table('audit_log as al')
                ->leftJoin('users as u', 'al.performed_by', '=', 'u.user_id')
                ->select(
                    'al.*',
                    DB::raw("TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as performed_by_name")
                );
        }
        if ($soft) {
            if (!$showDeleted) {
                $query->whereNull('deleted_at');
            }
        }

        // Apply search filter across all columns
        if ($search && trim($search) !== '') {
            $columns = Schema::getColumnListing($table);
            $searchTerm = '%' . trim($search) . '%';
            if ($table === 'audit_log') {
                $query->where(function ($q) use ($columns, $searchTerm) {
                    foreach ($columns as $col) {
                        $q->orWhere('al.' . $col, 'LIKE', $searchTerm);
                    }
                    $q->orWhereRaw(
                        "TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE ?",
                        [$searchTerm]
                    );
                });
            } else {
                $query->where(function ($q) use ($columns, $searchTerm) {
                    foreach ($columns as $col) {
                        $q->orWhere($col, 'LIKE', $searchTerm);
                    }
                });
            }
        }

        // Sort descending by primary key to show latest first
        if (is_string($pk)) {
            $query->orderBy($table === 'audit_log' ? 'al.' . $pk : $pk, 'desc');
        }

        // Basic pagination
        $perPage = (int)$request->query('perPage', 15);
        $page = max(1, (int)$request->query('page', 1));
        $offset = ($page - 1) * $perPage;

        $totalQuery = clone $query;
        $total = $totalQuery->count();

        $rows = $query->offset($offset)->limit($perPage)->get();
        return response()->json([
            'data' => $rows,
            'page' => $page,
            'perPage' => $perPage,
            'total' => $total,
        ]);
    }

    /**
     * Soft delete or hard delete a row
     */
    public function delete(Request $request, string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        
        // Get old values for audit log
        $oldValues = $this->fetchOldValues($table, $pk, $id, $request);
        
        if (is_array($pk)) {
            // Handle composite primary key - expect keys as query parameters
            $query = DB::table($table);
            foreach ($pk as $key) {
                $value = $request->query($key);
                if ($value !== null) {
                    $query->where($key, $value);
                }
            }
            // If no query params provided, try to use the id for the first key
            if (!$request->query()) {
                $query->where($pk[0], $id);
            }
            
            if ($soft) {
                $query->update(['deleted_at' => now()]);
            } else {
                $query->delete();
            }
        } else {
            if ($soft) {
                DB::table($table)->where($pk, $id)->update(['deleted_at' => now()]);
            } else {
                DB::table($table)->where($pk, $id)->delete();
            }
        }
        
        // Log audit
        $this->logAudit($table, $id, 'DELETE', $oldValues, null, $request);
        
        return response()->json(['status' => 'ok']);
    }

    /**
     * Restore a soft-deleted row
     */
    public function restore(Request $request, string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        if (!$soft) {
            return response()->json(['error' => 'Soft deletes not enabled for this table'], 400);
        }
        
        // Get old values for audit log
        $oldValues = $this->fetchOldValues($table, $pk, $id, $request);
        
        if (is_array($pk)) {
            // Handle composite primary key - expect keys as query parameters
            $query = DB::table($table);
            foreach ($pk as $key) {
                $value = $request->query($key);
                if ($value !== null) {
                    $query->where($key, $value);
                }
            }
            // If no query params provided, try to use the id for the first key
            if (!$request->query()) {
                $query->where($pk[0], $id);
            }
            $query->update(['deleted_at' => null]);
        } else {
            DB::table($table)->where($pk, $id)->update(['deleted_at' => null]);
        }
        
        // Log audit (UPDATE action for restore)
        $this->logAudit($table, $id, 'UPDATE', $oldValues, ['deleted_at' => null], $request);
        
        return response()->json(['status' => 'ok']);
    }

    private function assertAllowedTable(string $table): void
    {
        if (!array_key_exists($table, $this->tables)) {
            abort(404, 'Table not allowed');
        }

        if ($table === 'audit_log') {
            $user = auth('api')->user();
            if (!$user || !$user->hasPermission('view_audit')) {
                abort(403, 'Insufficient permission to access audit logs');
            }
        }
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
     * Fetch the original row before delete/restore so audit logs can include old values.
     */
    private function fetchOldValues(string $table, mixed $pk, mixed $id, Request $request): ?array
    {
        if (!is_array($pk)) {
            $row = DB::table($table)->where($pk, $id)->first();
            return $row ? (array) $row : null;
        }

        $query = DB::table($table);
        foreach ($pk as $key) {
            $value = $request->query($key);
            if ($value !== null) {
                $query->where($key, $value);
            }
        }

        if (!$request->query()) {
            $query->where($pk[0], $id);
        }

        $row = $query->first();
        return $row ? (array) $row : null;
    }
}
