<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = array_keys(config('maintenance.tables', []));
        foreach ($tables as $table) {
            // Only add deleted_at if configured for soft deletes and column missing
            $meta = config("maintenance.tables.$table", []);
            if (!($meta['soft_deletes'] ?? false)) {
                continue;
            }
            if (!Schema::hasTable($table)) {
                continue;
            }
            if (!Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $tableObj) {
                    $tableObj->timestamp('deleted_at')->nullable()->index();
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = array_keys(config('maintenance.tables', []));
        foreach ($tables as $table) {
            $meta = config("maintenance.tables.$table", []);
            if (!($meta['soft_deletes'] ?? false)) {
                continue;
            }
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $tableObj) {
                    $tableObj->dropColumn('deleted_at');
                });
            }
        }
    }
};
