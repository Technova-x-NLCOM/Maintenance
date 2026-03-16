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
        if (!Schema::hasColumn('items', 'shelf_life_days')) {
            Schema::table('items', function (Blueprint $table) {
                $table->unsignedInteger('shelf_life_days')->nullable()->after('reorder_level');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('items', 'shelf_life_days')) {
            Schema::table('items', function (Blueprint $table) {
                $table->dropColumn('shelf_life_days');
            });
        }
    }
};
