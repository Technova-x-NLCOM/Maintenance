<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update the status enum to include new statuses
        DB::statement("ALTER TABLE distribution_plan_schedules MODIFY COLUMN status ENUM('planned', 'stock_allocated', 'checked_pre', 'ready', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum values
        DB::statement("ALTER TABLE distribution_plan_schedules MODIFY COLUMN status ENUM('planned', 'checked_pre', 'ready', 'completed', 'cancelled') DEFAULT 'planned'");
    }
};