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
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id('transaction_id');
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('batch_id')->nullable();
            $table->enum('transaction_type', ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']);
            $table->integer('quantity');
            $table->string('reference_number', 100)->nullable();
            $table->dateTime('transaction_date')->useCurrent();
            $table->string('reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->string('destination', 255)->nullable();
            $table->unsignedBigInteger('performed_by');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Foreign keys
            $table->foreign('item_id')
                ->references('item_id')
                ->on('items')
                ->onDelete('cascade');
            
            $table->foreign('batch_id')
                ->references('batch_id')
                ->on('inventory_batches')
                ->onDelete('set null');
            
            $table->foreign('performed_by')
                ->references('user_id')
                ->on('users');
            
            $table->foreign('approved_by')
                ->references('user_id')
                ->on('users');

            // Indexes
            $table->index('item_id');
            $table->index('batch_id');
            $table->index('transaction_date');
            $table->index('transaction_type');
            $table->index('performed_by');
            $table->index('approved_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_transactions');
    }
};
