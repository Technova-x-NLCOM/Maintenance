<?php

namespace App\Http\Controllers\Maintenance;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class MaintenanceHomeController extends Controller
{
    private array $tables;

    public function __construct()
    {
        $this->tables = config('maintenance.tables', []);
    }

    /**
     * List all maintainable tables
     */
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
}
