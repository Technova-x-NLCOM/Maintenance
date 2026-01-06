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
        Schema::create('categories', function (Blueprint $table) {
            $table->id('category_id');
            $table->string('category_name', 100);
            $table->unsignedBigInteger('parent_category_id')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Self-referencing foreign key for hierarchical categories
            $table->foreign('parent_category_id')
                ->references('category_id')
                ->on('categories')
                ->onDelete('set null');

            $table->index('parent_category_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
