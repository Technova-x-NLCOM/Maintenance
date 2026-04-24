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
        Schema::create('distribution_plan_remaining_items', function (Blueprint $table) {
            $table->id('remaining_id');
            $table->unsignedBigInteger('plan_id');
            $table->unsignedBigInteger('item_id');
            $table->decimal('remaining_quantity', 12, 4)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('plan_id')
                ->references('plan_id')
                ->on('distribution_plan_schedules')
                ->onDelete('cascade');

            $table->foreign('item_id')
                ->references('item_id')
                ->on('items')
                ->onDelete('restrict');

            $table->foreign('recorded_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');

            $table->unique(['plan_id', 'item_id'], 'distribution_plan_remaining_plan_item_unique');
            $table->index('plan_id');
            $table->index('item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('distribution_plan_remaining_items');
    }
};
