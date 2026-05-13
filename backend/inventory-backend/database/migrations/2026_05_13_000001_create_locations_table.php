<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id('location_id');
            $table->string('location_code', 50)->unique();
            $table->string('location_name', 150);
            $table->string('location_type', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('location_name');
            $table->index('location_type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};