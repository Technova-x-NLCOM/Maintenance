<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get role IDs
        $superAdminRoleId = DB::table('roles')->where('role_name', 'super_admin')->value('role_id');
        $adminRoleId = DB::table('roles')->where('role_name', 'admin')->value('role_id');
        $staffRoleId = DB::table('roles')->where('role_name', 'staff')->value('role_id');

        $now = now();

        $users = [
            [
                'username' => 'superadmin',
                'email' => 'superadmin@nlcom.org',
                'password_hash' => Hash::make('superadmin123'),
                'first_name' => 'Super',
                'last_name' => 'Admin',
                'contact_info' => '555-0000',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'username' => 'admin',
                'email' => 'admin@nlcom.org',
                // Align with sample data (bcrypt of "Password123!")
                'password_hash' => Hash::make('Password123!'),
                'first_name' => 'Admin',
                'last_name' => 'User',
                'contact_info' => '09170000000',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'username' => 'staff',
                'email' => 'staff@nlcom.org',
                'password_hash' => Hash::make('staff123'),
                'first_name' => 'Staff',
                'last_name' => 'Member',
                'contact_info' => '555-0002',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'username' => 'staff1',
                'email' => 'staff1@nlcom.org',
                'password_hash' => Hash::make('Password123!'),
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'contact_info' => '09171111111',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($users as $user) {
            DB::table('users')->updateOrInsert(
                ['username' => $user['username']],
                $user
            );
        }

        $userIds = DB::table('users')
            ->whereIn('username', ['superadmin', 'admin', 'staff', 'staff1'])
            ->pluck('user_id', 'username');

        $roleAssignments = [
            ['username' => 'superadmin', 'role_id' => $superAdminRoleId],
            ['username' => 'admin', 'role_id' => $adminRoleId],
            ['username' => 'staff', 'role_id' => $staffRoleId],
            ['username' => 'staff1', 'role_id' => $staffRoleId],
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
