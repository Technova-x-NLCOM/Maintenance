<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get role IDs
        $superAdminRoleId = DB::table('roles')->where('role_name', 'super_admin')->value('role_id');
        $inventoryManagerRoleId = DB::table('roles')->where('role_name', 'inventory_manager')->value('role_id');

        $now = now();

        $users = [
            [
                'username' => 'superadmin',
                'email' => 'superadmin@nlcom.org',
                'password_hash' => Hash::make('SuperAdmin123!'),
                'first_name' => 'Super',
                'last_name' => 'Administrator',
                'contact_info' => '09170000000',
                'is_active' => true,
                'password_initialized' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'username' => 'inventory_manager',
                'email' => 'inventory@nlcom.org',
                'password_hash' => Hash::make('InventoryManager123!'),
                'first_name' => 'Inventory',
                'last_name' => 'Manager',
                'contact_info' => '09171111111',
                'is_active' => true,
                'password_initialized' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        // If the column doesn't exist yet, keep seeding working.
        if (!Schema::hasColumn('users', 'password_initialized')) {
            foreach ($users as &$user) {
                unset($user['password_initialized']);
            }
        }

        foreach ($users as $user) {
            DB::table('users')->updateOrInsert(
                ['username' => $user['username']],
                $user
            );
        }

        $userIds = DB::table('users')
            ->whereIn('username', ['superadmin', 'inventory_manager'])
            ->pluck('user_id', 'username');

        $roleAssignments = [
            ['username' => 'superadmin', 'role_id' => $superAdminRoleId],
            ['username' => 'inventory_manager', 'role_id' => $inventoryManagerRoleId],
        ];

        foreach ($roleAssignments as $assignment) {
            $userId = $userIds[$assignment['username']] ?? null;
            if (!$userId || !$assignment['role_id']) {
                continue;
            }

            DB::table('user_roles')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'role_id' => $assignment['role_id'],
                ],
                [
                    'is_primary' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
