<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_plan_schedules', function (Blueprint $table) {
            if (!Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at')) {
                $table->timestamp('auto_allocated_at')->nullable()->after('completed_notes');
            }

            if (!Schema::hasColumn('distribution_plan_schedules', 'auto_allocation_ref')) {
                $table->string('auto_allocation_ref', 100)->nullable()->after('auto_allocated_at');
                $table->index('auto_allocated_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('distribution_plan_schedules', function (Blueprint $table) {
            if (Schema::hasColumn('distribution_plan_schedules', 'auto_allocation_ref')) {
                $table->dropColumn('auto_allocation_ref');
            }

            if (Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at')) {
                $table->dropIndex(['auto_allocated_at']);
                $table->dropColumn('auto_allocated_at');
            }
        });
    }
};
