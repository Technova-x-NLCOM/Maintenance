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
        Schema::table('role_permissions', function (Blueprint $table) {
            if (!Schema::hasColumn('role_permissions', 'can_create')) {
                $table->boolean('can_create')->default(false);
            }
            if (!Schema::hasColumn('role_permissions', 'can_read')) {
                $table->boolean('can_read')->default(true);
            }
            if (!Schema::hasColumn('role_permissions', 'can_update')) {
                $table->boolean('can_update')->default(false);
            }
            if (!Schema::hasColumn('role_permissions', 'can_delete')) {
                $table->boolean('can_delete')->default(false);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_permissions', function (Blueprint $table) {
            if (Schema::hasColumn('role_permissions', 'can_create')) {
                $table->dropColumn('can_create');
            }
            if (Schema::hasColumn('role_permissions', 'can_read')) {
                $table->dropColumn('can_read');
            }
            if (Schema::hasColumn('role_permissions', 'can_update')) {
                $table->dropColumn('can_update');
            }
            if (Schema::hasColumn('role_permissions', 'can_delete')) {
                $table->dropColumn('can_delete');
            }
        });
    }
};
