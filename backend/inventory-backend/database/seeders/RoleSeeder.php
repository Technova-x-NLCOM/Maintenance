<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Role;
use App\Models\Permission;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ensure basic roles exist
        $roles = [
            ['role_name' => 'super_admin', 'display_name' => 'Super Administrator', 'description' => 'Full system access with all permissions including user management and system configuration', 'is_system_role' => true],
            ['role_name' => 'inventory_manager', 'display_name' => 'Inventory Manager', 'description' => 'Full inventory management access including items, batches, transactions, and reports', 'is_system_role' => true],
        ];

        foreach ($roles as $r) {
            Role::updateOrCreate(
                ['role_name' => $r['role_name']],
                ['display_name' => $r['display_name'], 'description' => $r['description'], 'is_system_role' => $r['is_system_role']]
            );
        }

        // Seed initial permissions and attach to roles
        $permissions = [
            ['permission_name' => 'manage_users', 'display_name' => 'Manage Users', 'description' => 'Create, update, delete users', 'module' => 'system'],
            ['permission_name' => 'manage_roles', 'display_name' => 'Manage Roles', 'description' => 'Create and assign roles', 'module' => 'system'],
            ['permission_name' => 'manage_permissions', 'display_name' => 'Manage Permissions', 'description' => 'Create and assign permissions', 'module' => 'system'],
            ['permission_name' => 'manage_backups', 'display_name' => 'Manage Backups', 'description' => 'Manage database backups and restores', 'module' => 'system'],
            ['permission_name' => 'manage_settings', 'display_name' => 'Manage Settings', 'description' => 'View and update system-wide configuration settings', 'module' => 'system'],
            ['permission_name' => 'manage_maintenance', 'display_name' => 'Manage Maintenance', 'description' => 'Access maintenance tools for tables and rows', 'module' => 'maintenance'],
            ['permission_name' => 'manage_inventory', 'display_name' => 'Manage Inventory', 'description' => 'CRUD inventory items and stock', 'module' => 'inventory'],
            ['permission_name' => 'manage_categories', 'display_name' => 'Manage Categories', 'description' => 'Create, update, delete item categories', 'module' => 'inventory'],
            ['permission_name' => 'manage_batches', 'display_name' => 'Manage Batches', 'description' => 'Create, update inventory batches', 'module' => 'inventory'],
            ['permission_name' => 'manage_transactions', 'display_name' => 'Manage Transactions', 'description' => 'Create and approve inventory transactions', 'module' => 'inventory'],
            ['permission_name' => 'view_reports', 'display_name' => 'View Reports', 'description' => 'Access reporting and analytics features', 'module' => 'reports'],
            ['permission_name' => 'view_alerts', 'display_name' => 'View Alerts', 'description' => 'View expiry and low stock alerts', 'module' => 'inventory'],
        ];

        foreach ($permissions as $p) {
            Permission::updateOrCreate(
                ['permission_name' => $p['permission_name']],
                ['display_name' => $p['display_name'], 'description' => $p['description'], 'module' => $p['module']]
            );
        }

        $allPermissions = Permission::all();
        $allRoles = Role::all();
        $now = now();

        foreach ($allRoles as $role) {
            foreach ($allPermissions as $perm) {
                // Define permissions for each role
                if ($role->role_name === 'super_admin') {
                    // Super admin: full CRUD on everything
                    $pivotData = ['can_create' => true, 'can_read' => true, 'can_update' => true, 'can_delete' => true];
                } elseif ($role->role_name === 'inventory_manager') {
                    // Inventory manager: full access to inventory + maintenance; no access to system-only features
                    $inventoryPermissions = ['manage_inventory', 'manage_categories', 'manage_batches', 'manage_transactions', 'view_reports', 'view_alerts', 'manage_maintenance'];
                    
                    if (in_array($perm->permission_name, $inventoryPermissions)) {
                        $pivotData = ['can_create' => true, 'can_read' => true, 'can_update' => true, 'can_delete' => true];
                    } else {
                        // manage_users, manage_roles, manage_permissions, manage_backups, manage_settings: no access
                        $pivotData = ['can_create' => false, 'can_read' => false, 'can_update' => false, 'can_delete' => false];
                    }
                } else {
                    // Default: no access
                    $pivotData = ['can_create' => false, 'can_read' => false, 'can_update' => false, 'can_delete' => false];
                }

                DB::table('role_permissions')->updateOrInsert(
                    [
                        'role_id' => $role->role_id,
                        'permission_id' => $perm->permission_id,
                    ],
                    array_merge($pivotData, [
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])
                );
            }
        }
    }
}
