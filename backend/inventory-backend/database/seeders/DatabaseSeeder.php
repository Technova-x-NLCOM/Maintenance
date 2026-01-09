<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     * Run seeders in order of dependencies.
     */
    public function run(): void
    {
        // Seed item types first (no dependencies)
        $this->call(ItemTypeSeeder::class);

        // Seed categories (no dependencies)
        $this->call(CategorySeeder::class);

        // Seed roles before users (users depend on roles)
        $this->call(RoleSeeder::class);

        // Seed users (depends on roles)
        $this->call(UserSeeder::class);

        // Seed system settings (depends on users)
        $this->call(SystemSettingsSeeder::class);

        $this->command->info('✅ Database seeding completed successfully!');
    }
}
