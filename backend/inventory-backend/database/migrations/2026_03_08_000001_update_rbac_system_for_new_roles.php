<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add CRUD permission columns to role_permissions table if they don't exist
        if (!Schema::hasColumn('role_permissions', 'can_create')) {
            Schema::table('role_permissions', function (Blueprint $table) {
                $table->boolean('can_create')->default(false)->after('permission_id');
                $table->boolean('can_read')->default(true)->after('can_create');
                $table->boolean('can_update')->default(false)->after('can_read');
                $table->boolean('can_delete')->default(false)->after('can_update');
            });
        }

        // Update existing role names to new system
        DB::table('roles')->where('role_name', 'admin')->update(['role_name' => 'inventory_manager', 'display_name' => 'Inventory Manager']);
        DB::table('roles')->where('role_name', 'staff')->update(['role_name' => 'inventory_manager', 'display_name' => 'Inventory Manager']);
        
        // Remove duplicate inventory_manager roles if any exist
        $duplicateRoles = DB::table('roles')
            ->select('role_name', DB::raw('COUNT(*) as count'))
            ->groupBy('role_name')
            ->having('count', '>', 1)
            ->get();

        foreach ($duplicateRoles as $duplicate) {
            if ($duplicate->role_name === 'inventory_manager') {
                // Keep the first one, delete the rest
                $roleIds = DB::table('roles')->where('role_name', 'inventory_manager')->pluck('role_id');
                $keepRoleId = $roleIds->first();
                $deleteRoleIds = $roleIds->slice(1);
                
                // Update user_roles to use the kept role
                foreach ($deleteRoleIds as $deleteRoleId) {
                    DB::table('user_roles')->where('role_id', $deleteRoleId)->update(['role_id' => $keepRoleId]);
                    DB::table('role_permissions')->where('role_id', $deleteRoleId)->delete();
                    DB::table('roles')->where('role_id', $deleteRoleId)->delete();
                }
            }
        }

        // Ensure we have the correct roles
        DB::table('roles')->updateOrInsert(
            ['role_name' => 'super_admin'],
            [
                'display_name' => 'Super Administrator',
                'description' => 'Full system access with all permissions including user management and system configuration',
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]
        );

        DB::table('roles')->updateOrInsert(
            ['role_name' => 'inventory_manager'],
            [
                'display_name' => 'Inventory Manager',
                'description' => 'Full inventory management access including items, batches, transactions, and reports',
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert role names
        DB::table('roles')->where('role_name', 'inventory_manager')->update(['role_name' => 'admin', 'display_name' => 'Administrator']);
        
        // Remove CRUD columns if they were added by this migration
        if (Schema::hasColumn('role_permissions', 'can_create')) {
            Schema::table('role_permissions', function (Blueprint $table) {
                $table->dropColumn(['can_create', 'can_read', 'can_update', 'can_delete']);
            });
        }
    }
};