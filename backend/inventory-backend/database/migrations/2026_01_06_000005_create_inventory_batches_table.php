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
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->id('batch_id');
            $table->unsignedBigInteger('item_id');
            $table->string('batch_number', 100)->nullable();
            $table->integer('quantity')->default(0);
            $table->date('expiry_date')->nullable();
            $table->date('manufactured_date')->nullable();
            $table->string('supplier_info', 255)->nullable();
            $table->decimal('batch_value', 10, 2)->nullable();
            $table->enum('status', ['active', 'expired', 'depleted', 'quarantined'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            // Foreign key
            $table->foreign('item_id')
                ->references('item_id')
                ->on('items')
                ->onDelete('cascade');

            // Indexes
            $table->index('item_id');
            $table->index('expiry_date');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_batches');
    }
};
