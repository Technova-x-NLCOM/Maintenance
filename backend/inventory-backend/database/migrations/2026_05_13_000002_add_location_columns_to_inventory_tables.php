<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_batches') && !Schema::hasColumn('inventory_batches', 'location_id')) {
            Schema::table('inventory_batches', function (Blueprint $table) {
                $table->unsignedBigInteger('location_id')->nullable()->after('item_id');
                $table->index('location_id');
                $table->foreign('location_id')
                    ->references('location_id')
                    ->on('locations')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('inventory_transactions')) {
            Schema::table('inventory_transactions', function (Blueprint $table) {
                if (!Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                    $table->unsignedBigInteger('from_location_id')->nullable()->after('approved_by');
                    $table->index('from_location_id');
                    $table->foreign('from_location_id')
                        ->references('location_id')
                        ->on('locations')
                        ->nullOnDelete();
                }

                if (!Schema::hasColumn('inventory_transactions', 'to_location_id')) {
                    $table->unsignedBigInteger('to_location_id')->nullable()->after('from_location_id');
                    $table->index('to_location_id');
                    $table->foreign('to_location_id')
                        ->references('location_id')
                        ->on('locations')
                        ->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('inventory_transactions')) {
            Schema::table('inventory_transactions', function (Blueprint $table) {
                if (Schema::hasColumn('inventory_transactions', 'to_location_id')) {
                    $table->dropForeign(['to_location_id']);
                    $table->dropIndex(['to_location_id']);
                    $table->dropColumn('to_location_id');
                }

                if (Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                    $table->dropForeign(['from_location_id']);
                    $table->dropIndex(['from_location_id']);
                    $table->dropColumn('from_location_id');
                }
            });
        }

        if (Schema::hasTable('inventory_batches') && Schema::hasColumn('inventory_batches', 'location_id')) {
            Schema::table('inventory_batches', function (Blueprint $table) {
                $table->dropForeign(['location_id']);
                $table->dropIndex(['location_id']);
                $table->dropColumn('location_id');
            });
        }
    }
};