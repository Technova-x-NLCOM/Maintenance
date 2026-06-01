<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operation_types', function (Blueprint $table) {
            $table->id('operation_type_id');
            $table->string('operation_name', 100)->unique();
            $table->enum('operation_direction', ['IN', 'OUT']);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('operation_direction');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operation_types');
    }
};