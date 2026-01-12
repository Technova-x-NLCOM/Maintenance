<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;

class MaintenanceController extends Controller
{
    private array $tables;

    public function __construct()
    {
        $this->tables = config('maintenance.tables', []);
    }

    public function listTables(): JsonResponse
    {
        $list = [];
        foreach ($this->tables as $name => $meta) {
            $list[] = [
                'name' => $name,
                'primary_key' => $meta['primary_key'],
                'soft_deletes' => (bool)($meta['soft_deletes'] ?? false),
            ];
        }
        return response()->json($list);
    }

    public function schema(string $table): JsonResponse
    {
        $this->assertAllowedTable($table);

        $columns = Schema::getColumnListing($table);
        return response()->json([
            'table' => $table,
            'columns' => $columns,
            'primary_key' => $this->tables[$table]['primary_key'],
            'soft_deletes' => (bool)($this->tables[$table]['soft_deletes'] ?? false),
        ]);
    }

    public function listRows(Request $request, string $table): JsonResponse
    {
        $this->assertAllowedTable($table);
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        $showDeleted = filter_var($request->query('showDeleted', 'false'), FILTER_VALIDATE_BOOLEAN);

        $query = DB::table($table);
        if ($soft) {
            if (!$showDeleted) {
                $query->whereNull('deleted_at');
            }
        }

        // Basic pagination
        $perPage = (int)$request->query('perPage', 50);
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

    public function create(Request $request, string $table): JsonResponse
    {
        $this->assertAllowedTable($table);
        $data = $this->sanitizePayload($table, $request->all());

        // Remove auto timestamps if present to let DB defaults apply
        foreach (['created_at', 'updated_at'] as $ts) {
            if (array_key_exists($ts, $data) && $data[$ts] === null) {
                unset($data[$ts]);
            }
        }

        $id = DB::table($table)->insertGetId($data);
        return response()->json(['id' => $id], 201);
    }

    public function update(Request $request, string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        if (is_array($pk)) {
            return response()->json(['error' => 'Composite keys must be provided via query string'], 400);
        }
        $data = $this->sanitizePayload($table, $request->all());
        DB::table($table)->where($pk, $id)->update($data);
        return response()->json(['status' => 'ok']);
    }

    public function delete(string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        if (is_array($pk)) {
            return response()->json(['error' => 'Composite keys must be provided via query string'], 400);
        }
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        if ($soft) {
            DB::table($table)->where($pk, $id)->update(['deleted_at' => now()]);
        } else {
            DB::table($table)->where($pk, $id)->delete();
        }
        return response()->json(['status' => 'ok']);
    }

    public function restore(string $table, $id): JsonResponse
    {
        $this->assertAllowedTable($table);
        $pk = $this->tables[$table]['primary_key'];
        $soft = (bool)($this->tables[$table]['soft_deletes'] ?? false);
        if (!$soft) {
            return response()->json(['error' => 'Soft deletes not enabled for this table'], 400);
        }
        if (is_array($pk)) {
            return response()->json(['error' => 'Composite keys must be provided via query string'], 400);
        }
        DB::table($table)->where($pk, $id)->update(['deleted_at' => null]);
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
        // Only keep known columns, exclude PK if auto-increment
        $pk = $this->tables[$table]['primary_key'];
        $filtered = Arr::only($input, $columns);
        if (!is_array($pk)) {
            unset($filtered[$pk]);
        }
        return $filtered;
    }
}
