<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_maintenance', function (Blueprint $table) {
            $table->id('maintenance_id');
            $table->unsignedBigInteger('location_id');
            $table->unsignedBigInteger('temp_location_id');
            $table->string('title', 255);
            $table->string('reason', 255)->nullable();
            $table->enum('status', ['pending', 'active', 'restoring', 'completed', 'cancelled'])
                  ->default('pending');
            $table->dateTime('scheduled_start')->nullable();
            $table->dateTime('scheduled_end')->nullable();
            $table->dateTime('actual_start')->nullable();
            $table->dateTime('actual_end')->nullable();
            $table->integer('moved_out_quantity')->default(0);
            $table->integer('moved_back_quantity')->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamps();

            $table->foreign('location_id')
                  ->references('location_id')->on('locations')->onDelete('cascade');
            $table->foreign('temp_location_id')
                  ->references('location_id')->on('locations')->onDelete('cascade');
            $table->foreign('performed_by')
                  ->references('user_id')->on('users')->onDelete('set null');

            $table->index('location_id');
            $table->index('status');
        });

        Schema::create('storage_maintenance_batches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('maintenance_id');
            $table->unsignedBigInteger('batch_id');   // new batch created at temp location
            $table->unsignedBigInteger('item_id');
            $table->integer('original_quantity');      // how many were moved out
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('maintenance_id')
                  ->references('maintenance_id')->on('storage_maintenance')->onDelete('cascade');
            $table->foreign('batch_id')
                  ->references('batch_id')->on('inventory_batches')->onDelete('cascade');
            $table->foreign('item_id')
                  ->references('item_id')->on('items')->onDelete('cascade');

            $table->index('maintenance_id');
            $table->index('batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_maintenance_batches');
        Schema::dropIfExists('storage_maintenance');
    }
};
