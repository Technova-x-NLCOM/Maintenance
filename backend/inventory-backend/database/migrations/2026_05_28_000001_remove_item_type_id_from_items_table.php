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
        if (!Schema::hasColumn('items', 'item_type_id')) {
            return;
        }

        Schema::table('items', function (Blueprint $table) {
            $table->dropForeign(['item_type_id']);
            $table->dropColumn('item_type_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('items', 'item_type_id')) {
            return;
        }

        Schema::table('items', function (Blueprint $table) {
            $table->unsignedBigInteger('item_type_id')->nullable()->after('item_description');
            $table->foreign('item_type_id')
                ->references('item_type_id')
                ->on('item_types')
                ->onDelete('restrict');
        });
    }
};
