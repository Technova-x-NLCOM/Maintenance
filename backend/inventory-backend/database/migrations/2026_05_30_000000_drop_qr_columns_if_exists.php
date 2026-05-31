<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = [
            'inventory_batches',
            'inventory_transactions',
            'items',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                // Drop columns only if they exist to make this migration safe
                if (Schema::hasColumn($table, 'qr_payload') || Schema::hasColumn($table, 'qr_label')) {
                    Schema::table($table, function (Blueprint $tableBlueprint) use ($table) {
                        if (Schema::hasColumn($table, 'qr_payload')) {
                            $tableBlueprint->dropColumn('qr_payload');
                        }
                        if (Schema::hasColumn($table, 'qr_label')) {
                            $tableBlueprint->dropColumn('qr_label');
                        }
                    });
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'inventory_batches',
            'inventory_transactions',
            'items',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function (Blueprint $tableBlueprint) use ($table) {
                    if (!Schema::hasColumn($table, 'qr_payload')) {
                        $tableBlueprint->text('qr_payload')->nullable();
                    }
                    if (!Schema::hasColumn($table, 'qr_label')) {
                        $tableBlueprint->string('qr_label', 255)->nullable();
                    }
                });
            }
        }
    }
};
