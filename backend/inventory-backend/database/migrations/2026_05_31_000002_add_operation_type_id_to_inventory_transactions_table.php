<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory_transactions', 'operation_type_id')) {
                $table->unsignedBigInteger('operation_type_id')->nullable()->after('batch_id');
                $table->index('operation_type_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('inventory_transactions', 'operation_type_id')) {
                $table->dropIndex(['operation_type_id']);
                $table->dropColumn('operation_type_id');
            }
        });
    }
};