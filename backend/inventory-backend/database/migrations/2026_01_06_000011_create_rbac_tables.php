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
        // Roles table (more flexible than enum)
        Schema::create('roles', function (Blueprint $table) {
            $table->id('role_id');
            $table->string('role_name', 50)->unique();
            $table->string('display_name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_system_role')->default(false); // Prevent deletion
            $table->timestamps();
        });

        // Permissions table
        Schema::create('permissions', function (Blueprint $table) {
            $table->id('permission_id');
            $table->string('permission_name', 100)->unique();
            $table->string('display_name', 150);
            $table->string('module', 50); // Group permissions by module
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // Role-Permission pivot table
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles', 'role_id')->onDelete('cascade');
            $table->foreignId('permission_id')->constrained('permissions', 'permission_id')->onDelete('cascade');
            $table->primary(['role_id', 'permission_id']);
            $table->timestamps();
        });

        // User-Role pivot table (supports multiple roles per user if needed)
        Schema::create('user_roles', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users', 'user_id')->onDelete('cascade');
            $table->foreignId('role_id')->constrained('roles', 'role_id')->onDelete('cascade');
            $table->boolean('is_primary')->default(true);
            $table->primary(['user_id', 'role_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
