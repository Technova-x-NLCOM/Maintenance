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
        Schema::create('backup_logs', function (Blueprint $table) {
            $table->id('backup_id');
            $table->string('backup_filename');
            $table->decimal('backup_size_mb', 10, 2);
            $table->enum('backup_type', ['full', 'incremental']);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at');

            $table->foreign('created_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_logs');
    }
};
