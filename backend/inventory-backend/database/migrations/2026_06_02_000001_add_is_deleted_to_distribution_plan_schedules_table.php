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
        if (! Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
            Schema::table('distribution_plan_schedules', function (Blueprint $table) {
                $table->boolean('is_deleted')->default(false)->after('notes');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
            Schema::table('distribution_plan_schedules', function (Blueprint $table) {
                $table->dropColumn('is_deleted');
            });
        }
    }
};
