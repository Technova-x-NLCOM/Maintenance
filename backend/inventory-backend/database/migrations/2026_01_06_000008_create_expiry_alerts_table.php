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
        Schema::create('expiry_alerts', function (Blueprint $table) {
            $table->id('alert_id');
            $table->unsignedBigInteger('batch_id');
            $table->date('alert_date');
            $table->integer('days_until_expiry')->nullable();
            $table->enum('status', ['pending', 'acknowledged', 'resolved'])->default('pending');
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Foreign keys
            $table->foreign('batch_id')
                ->references('batch_id')
                ->on('inventory_batches')
                ->onDelete('cascade');
            
            $table->foreign('acknowledged_by')
                ->references('user_id')
                ->on('users');

            // Indexes
            $table->index('batch_id');
            $table->index('acknowledged_by');
            $table->index('status');
            $table->index('alert_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expiry_alerts');
    }
};
