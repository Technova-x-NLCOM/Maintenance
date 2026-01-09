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

        // Create super admin user
        $superAdminUserId = DB::table('users')->insertGetId([
            'username' => 'superadmin',
            'email' => 'superadmin@nlcom.org',
            'password_hash' => Hash::make('superadmin123'),
            'first_name' => 'Super',
            'last_name' => 'Admin',
            'contact_info' => '555-0000',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create default admin user
        $adminUserId = DB::table('users')->insertGetId([
            'username' => 'admin',
            'email' => 'admin@nlcom.org',
            'password_hash' => Hash::make('admin123'),
            'first_name' => 'Admin',
            'last_name' => 'User',
            'contact_info' => '555-0001',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create default staff user
        $staffUserId = DB::table('users')->insertGetId([
            'username' => 'staff',
            'email' => 'staff@nlcom.org',
            'password_hash' => Hash::make('staff123'),
            'first_name' => 'Staff',
            'last_name' => 'Member',
            'contact_info' => '555-0002',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assign roles to users
        DB::table('user_roles')->insert([
            [
                'user_id' => $superAdminUserId,
                'role_id' => $superAdminRoleId,
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => $adminUserId,
                'role_id' => $adminRoleId,
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'user_id' => $staffUserId,
                'role_id' => $staffRoleId,
                'is_primary' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
