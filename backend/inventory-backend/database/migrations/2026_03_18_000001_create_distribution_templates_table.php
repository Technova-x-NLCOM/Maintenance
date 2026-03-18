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
        Schema::create('distribution_templates', function (Blueprint $table) {
            $table->id('template_id');
            $table->string('template_name', 150);
            $table->enum('distribution_type', ['feeding_program', 'relief_goods'])->default('feeding_program');
            $table->unsignedInteger('base_unit_count')->default(100);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('created_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');

            $table->unique(['template_name', 'distribution_type'], 'distribution_templates_name_type_unique');
            $table->index('distribution_type');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('distribution_templates');
    }
};
