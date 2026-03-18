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
        Schema::create('distribution_template_items', function (Blueprint $table) {
            $table->id('template_item_id');
            $table->unsignedBigInteger('template_id');
            $table->unsignedBigInteger('item_id');
            $table->decimal('quantity_per_base', 12, 4);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('template_id')
                ->references('template_id')
                ->on('distribution_templates')
                ->onDelete('cascade');

            $table->foreign('item_id')
                ->references('item_id')
                ->on('items')
                ->onDelete('restrict');

            $table->unique(['template_id', 'item_id'], 'distribution_template_items_template_item_unique');
            $table->index('template_id');
            $table->index('item_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('distribution_template_items');
    }
};
