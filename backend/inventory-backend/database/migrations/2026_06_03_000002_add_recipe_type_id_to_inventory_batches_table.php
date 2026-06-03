<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (Schema::hasTable('inventory_batches')) {
            Schema::table('inventory_batches', function (Blueprint $table) {
                if (!Schema::hasColumn('inventory_batches', 'recipe_type_id')) {
                    $table->unsignedBigInteger('recipe_type_id')->nullable()->after('batch_number');
                    $table->foreign('recipe_type_id')->references('recipe_type_id')->on('recipe_types')->onDelete('set null');
                    $table->index('recipe_type_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        if (Schema::hasTable('inventory_batches')) {
            Schema::table('inventory_batches', function (Blueprint $table) {
                if (Schema::hasColumn('inventory_batches', 'recipe_type_id')) {
                    $table->dropForeign(['recipe_type_id']);
                    $table->dropIndex(['recipe_type_id']);
                    $table->dropColumn('recipe_type_id');
                }
            });
        }
    }
};
