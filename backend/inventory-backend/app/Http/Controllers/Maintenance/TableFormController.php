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

        // Remove auto timestamps if present to let DB defaults apply
        foreach (['created_at', 'updated_at'] as $ts) {
            if (array_key_exists($ts, $data) && $data[$ts] === null) {
                unset($data[$ts]);
            }
        }

        $id = DB::table($table)->insertGetId($data);
        return response()->json(['id' => $id], 201);
    }

    /**
     * Update an existing row
     */
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
