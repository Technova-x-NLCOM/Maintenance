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
        // Pull relations mapping from config, if any
        $relations = $this->tables[$table]['relations'] ?? [];

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
            'columns' => $columns,
            'primary_key' => $this->tables[$table]['primary_key'],
            'soft_deletes' => (bool)($this->tables[$table]['soft_deletes'] ?? false),
            'relations' => $relations,
            'lookups' => $lookups,
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

    /**
     * Soft delete or hard delete a row
     */
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

    /**
     * Restore a soft-deleted row
     */
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
}
