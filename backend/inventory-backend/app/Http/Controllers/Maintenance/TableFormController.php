<?php

namespace App\Http\Controllers\Maintenance;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Arr;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\QueryException;

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
        if ($table === 'users') {
            return $this->createUserRow($request);
        }
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
        if ($table === 'users') {
            return $this->updateUserRow($request, $id);
        }
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
     * Users: password must be hashed; role lives in user_roles, not users.role (column removed).
     */
    private function createUserRow(Request $request): JsonResponse
    {
        $password = $request->input('password');
        if (!is_string($password) || trim($password) === '') {
            return response()->json(['message' => 'Password is required for new users.'], 422);
        }

        $roleName = $this->normalizeUserRoleName($request->input('role'));
        $input = $request->all();
        $input['password_hash'] = Hash::make($password);
        unset($input['password']);

        $data = $this->sanitizePayload('users', $input);
        if (empty($data['password_hash'])) {
            return response()->json(['message' => 'Could not set password.'], 422);
        }

        if (Schema::hasColumn('users', 'created_at') && !array_key_exists('created_at', $data)) {
            $data['created_at'] = now();
        }
        if (Schema::hasColumn('users', 'updated_at') && !array_key_exists('updated_at', $data)) {
            $data['updated_at'] = now();
        }

        try {
            $id = DB::table('users')->insertGetId($data);
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'Duplicate') || str_contains($msg, 'UNIQUE')) {
                return response()->json(['message' => 'Username or email is already taken.'], 422);
            }
            \Log::error('User create failed: ' . $msg);
            return response()->json(['message' => 'Could not create user.'], 500);
        }

        $roleId = DB::table('roles')->where('role_name', $roleName)->value('role_id');
        if ($roleId) {
            DB::table('user_roles')->insert([
                'user_id' => $id,
                'role_id' => $roleId,
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $auditPayload = $data;
        unset($auditPayload['password_hash']);
        $this->logAudit('users', $id, 'INSERT', null, $auditPayload, $request);

        return response()->json(['id' => $id], 201);
    }

    private function updateUserRow(Request $request, $id): JsonResponse
    {
        $pk = $this->tables['users']['primary_key'];
        $input = $request->all();

        $password = $request->input('password');
        if (is_string($password) && trim($password) !== '') {
            $input['password_hash'] = Hash::make($password);
        } else {
            unset($input['password_hash']);
        }
        unset($input['password']);

        $data = $this->sanitizePayload('users', $input);
        if (!is_string($password) || trim($password) === '') {
            unset($data['password_hash']);
        }

        $oldValues = (array) DB::table('users')->where($pk, $id)->first();
        if (empty($oldValues)) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if (Schema::hasColumn('users', 'updated_at')) {
            $data['updated_at'] = now();
        }

        try {
            DB::table('users')->where($pk, $id)->update($data);
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'Duplicate') || str_contains($msg, 'UNIQUE')) {
                return response()->json(['message' => 'Username or email is already taken.'], 422);
            }
            \Log::error('User update failed: ' . $msg);
            return response()->json(['message' => 'Could not update user.'], 500);
        }

        $roleName = $request->has('role') ? $this->normalizeUserRoleName($request->input('role')) : null;
        if ($roleName !== null) {
            $roleId = DB::table('roles')->where('role_name', $roleName)->value('role_id');
            if ($roleId) {
                DB::table('user_roles')->where('user_id', $id)->delete();
                DB::table('user_roles')->insert([
                    'user_id' => $id,
                    'role_id' => $roleId,
                    'is_primary' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        $auditPayload = $data;
        unset($auditPayload['password_hash']);
        $this->logAudit('users', $id, 'UPDATE', $oldValues, $auditPayload, $request);

        return response()->json(['status' => 'ok']);
    }

    private function normalizeUserRoleName(mixed $role): string
    {
        $name = is_string($role) ? strtolower(trim($role)) : '';
        if ($name === 'super_admin') {
            return 'super_admin';
        }
        return 'inventory_manager';
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
