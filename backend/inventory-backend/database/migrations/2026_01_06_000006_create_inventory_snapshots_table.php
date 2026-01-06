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
        Schema::create('inventory_snapshots', function (Blueprint $table) {
            $table->id('snapshot_id');
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->date('snapshot_date');
            $table->integer('quantity');
            $table->decimal('total_value', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Foreign keys
            $table->foreign('item_id')
                ->references('item_id')
                ->on('items')
                ->onDelete('cascade');
            
            $table->foreign('batch_id')
                ->references('batch_id')
                ->on('inventory_batches')
                ->onDelete('cascade');
            
            $table->foreign('created_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');

            // Indexes
            $table->unique(['item_id', 'batch_id', 'snapshot_date']);
            $table->index('item_id');
            $table->index('batch_id');
            $table->index('snapshot_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_snapshots');
    }
};
