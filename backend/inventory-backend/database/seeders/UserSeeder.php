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
        // Create default admin user
        $adminUser = [
            'username' => 'admin',
            'email' => 'admin@nlcom.org',
            'password_hash' => Hash::make('admin123'),
            'first_name' => 'Admin',
            'last_name' => 'User',
            'contact_info' => '555-0001',
            'role' => 'admin',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        // Create default staff user
        $staffUser = [
            'username' => 'staff',
            'email' => 'staff@nlcom.org',
            'password_hash' => Hash::make('staff123'),
            'first_name' => 'Staff',
            'last_name' => 'Member',
            'contact_info' => '555-0002',
            'role' => 'staff',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('users')->insert([
            $adminUser,
            $staffUser,
        ]);
    }
}
