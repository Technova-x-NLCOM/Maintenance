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
        // Add location_id to inventory_transactions table (inventory_batches already has it)
        if (!Schema::hasColumn('inventory_transactions', 'location_id')) {
            Schema::table('inventory_transactions', function (Blueprint $table) {
                $table->unsignedBigInteger('location_id')->nullable()->after('batch_id');
                
                $table->foreign('location_id')
                    ->references('location_id')
                    ->on('locations')
                    ->onDelete('set null');
                    
                $table->index('location_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('inventory_transactions', 'location_id')) {
            Schema::table('inventory_transactions', function (Blueprint $table) {
                $table->dropForeign(['location_id']);
                $table->dropIndex(['location_id']);
                $table->dropColumn('location_id');
            });
        }
    }
};