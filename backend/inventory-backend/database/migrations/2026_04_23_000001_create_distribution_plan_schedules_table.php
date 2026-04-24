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
        Schema::create('distribution_plan_schedules', function (Blueprint $table) {
            $table->id('plan_id');
            $table->unsignedBigInteger('template_id');
            $table->string('week_label', 50);
            $table->date('planned_date');
            $table->unsignedInteger('target_unit_count');
            $table->enum('status', ['planned', 'checked_pre', 'ready', 'completed', 'cancelled'])->default('planned');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('precheck_at')->nullable();
            $table->timestamp('final_check_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('template_id')
                ->references('template_id')
                ->on('distribution_templates')
                ->onDelete('restrict');

            $table->foreign('created_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');

            $table->index('template_id');
            $table->index('planned_date');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('distribution_plan_schedules');
    }
};
