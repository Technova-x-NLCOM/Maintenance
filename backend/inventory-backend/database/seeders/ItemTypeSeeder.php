<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ItemTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $itemTypes = [
            [
                'type_name' => 'general_item',
                'description' => 'General inventory items',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'nlcom_shirt',
                'description' => 'NLCOM branded shirts',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'perishable',
                'description' => 'Perishable ingredients for mobile kitchen',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'tool_utensil',
                'description' => 'Kitchen tools and utensils',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'consumable',
                'description' => 'Consumable supplies',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'medicine',
                'description' => 'Medical medicines',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'medical_item',
                'description' => 'Medical equipment and supplies',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type_name' => 'emergency_safety',
                'description' => 'Emergency and safety equipment',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('item_types')->insert($itemTypes);
    }
}
