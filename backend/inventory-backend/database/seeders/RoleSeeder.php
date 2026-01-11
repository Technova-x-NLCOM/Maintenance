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

        // Seed initial permissions and attach to super_admin
        $super = Role::where('role_name', 'super_admin')->first();
        if ($super) {
            $permissions = [
                ['permission_name' => 'manage_users', 'display_name' => 'Manage Users', 'description' => 'Create, update, delete users', 'module' => 'system'],
                ['permission_name' => 'manage_roles', 'display_name' => 'Manage Roles', 'description' => 'Create and assign roles', 'module' => 'system'],
                ['permission_name' => 'manage_permissions', 'display_name' => 'Manage Permissions', 'description' => 'Create and assign permissions', 'module' => 'system'],
                ['permission_name' => 'view_reports', 'display_name' => 'View Reports', 'description' => 'Access reporting features', 'module' => 'reports'],
                ['permission_name' => 'manage_inventory', 'display_name' => 'Manage Inventory', 'description' => 'CRUD inventory items and stock', 'module' => 'inventory'],
            ];

            foreach ($permissions as $p) {
                $perm = Permission::updateOrCreate(
                    ['permission_name' => $p['permission_name']],
                    ['display_name' => $p['display_name'], 'description' => $p['description'], 'module' => $p['module']]
                );
                $super->permissions()->syncWithoutDetaching([
                    $perm->permission_id => [
                        'can_create' => true,
                        'can_read' => true,
                        'can_update' => true,
                        'can_delete' => true,
                    ]
                ]);
            }
        }
    }
}
