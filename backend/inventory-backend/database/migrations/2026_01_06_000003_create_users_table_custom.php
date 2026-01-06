<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * This migration is DEPRECATED.
     * The users table is now created in the default Laravel migration:
     * 0001_01_01_000000_create_users_table.php
     * 
     * This file is kept for reference only and does nothing.
     */
    public function up(): void
    {
        // No-op: Users table is created in the default migration
    }

    public function down(): void
    {
        // No-op: Users table is dropped by the default migration
    }
};

