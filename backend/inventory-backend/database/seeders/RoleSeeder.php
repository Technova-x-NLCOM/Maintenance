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
            ['role_name' => 'super_admin', 'display_name' => 'Super Administrator', 'description' => 'Full system access with all permissions', 'is_system_role' => true],
            ['role_name' => 'admin', 'display_name' => 'Administrator', 'description' => 'Administrative access to manage users and inventory', 'is_system_role' => true],
            ['role_name' => 'staff', 'display_name' => 'Staff Member', 'description' => 'Standard staff access for inventory operations', 'is_system_role' => true],
        ];

        foreach ($roles as $r) {
            Role::updateOrCreate(
                ['role_name' => $r['role_name']],
                ['display_name' => $r['display_name'], 'description' => $r['description'], 'is_system_role' => $r['is_system_role']]
            );
        }

        // Seed initial permissions and attach to super_admin; ensure all role-permission rows exist (default false for non-super roles)
        $permissions = [
            ['permission_name' => 'manage_users', 'display_name' => 'Manage Users', 'description' => 'Create, update, delete users', 'module' => 'system'],
            ['permission_name' => 'manage_roles', 'display_name' => 'Manage Roles', 'description' => 'Create and assign roles', 'module' => 'system'],
            ['permission_name' => 'manage_permissions', 'display_name' => 'Manage Permissions', 'description' => 'Create and assign permissions', 'module' => 'system'],
            ['permission_name' => 'view_reports', 'display_name' => 'View Reports', 'description' => 'Access reporting features', 'module' => 'reports'],
            ['permission_name' => 'manage_inventory', 'display_name' => 'Manage Inventory', 'description' => 'CRUD inventory items and stock', 'module' => 'inventory'],
            ['permission_name' => 'manage_backups', 'display_name' => 'Manage Backups', 'description' => 'Manage database backups and restores', 'module' => 'system'],
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
                // Super admin: full CRUD; others default to no access (all flags false)
                $pivotData = $role->role_name === 'super_admin'
                    ? ['can_create' => true, 'can_read' => true, 'can_update' => true, 'can_delete' => true]
                    : ['can_create' => false, 'can_read' => false, 'can_update' => false, 'can_delete' => false];

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
