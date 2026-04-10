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
        $user = auth('api')->user();
        $list = [];
        foreach ($this->tables as $name => $meta) {
            if ($name === 'audit_log' && (!$user || !$user->hasPermission('view_audit'))) {
                continue;
            }

            $list[] = [
                'name' => $name,
                'primary_key' => $meta['primary_key'],
                'soft_deletes' => (bool)($meta['soft_deletes'] ?? false),
            ];
        }
        return response()->json($list);
    }
}
