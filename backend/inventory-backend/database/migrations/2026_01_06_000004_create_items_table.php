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
        Schema::create('items', function (Blueprint $table) {
            $table->id('item_id');
            $table->string('item_code', 50)->unique();
            $table->string('item_description', 255);
            $table->unsignedBigInteger('item_type_id');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->string('measurement_unit', 50)->nullable();
            $table->text('particular')->nullable();
            $table->decimal('mg_dosage', 10, 2)->nullable();
            $table->string('image_url', 500)->nullable();
            $table->text('remarks')->nullable();
            $table->decimal('unit_value', 10, 2)->nullable();
            $table->integer('reorder_level')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            // Foreign keys
            $table->foreign('item_type_id')
                ->references('item_type_id')
                ->on('item_types');
            
            $table->foreign('category_id')
                ->references('category_id')
                ->on('categories')
                ->onDelete('set null');
            
            $table->foreign('created_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');

            // Indexes (item_code already unique via column definition)
            $table->index('item_type_id');
            $table->index('category_id');
            $table->index('is_active');
            $table->fullText('item_description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
