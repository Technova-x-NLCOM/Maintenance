<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL: modify the ENUM column to add DISCREPANCY
        DB::statement("ALTER TABLE inventory_transactions MODIFY COLUMN transaction_type ENUM('IN','OUT','ADJUSTMENT','TRANSFER','DISCREPANCY') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE inventory_transactions MODIFY COLUMN transaction_type ENUM('IN','OUT','ADJUSTMENT','TRANSFER') NOT NULL");
    }
};
