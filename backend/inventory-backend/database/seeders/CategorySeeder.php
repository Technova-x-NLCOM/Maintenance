<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'category_id' => 1,
                'category_name' => 'General Items',
                'parent_category_id' => null,
                'description' => 'General inventory category',
                'created_at' => '2025-11-18 04:42:48',
            ],
            [
                'category_id' => 2,
                'category_name' => 'Clothing',
                'parent_category_id' => null,
                'description' => 'Clothing and apparel',
                'created_at' => '2025-11-18 04:42:48',
            ],
            [
                'category_id' => 3,
                'category_name' => 'Kitchen Supplies',
                'parent_category_id' => null,
                'description' => 'Mobile kitchen supplies',
                'created_at' => '2025-11-18 04:42:48',
            ],
            [
                'category_id' => 4,
                'category_name' => 'Medical Supplies',
                'parent_category_id' => null,
                'description' => 'Medical and healthcare items',
                'created_at' => '2025-11-18 04:42:48',
            ],
            [
                'category_id' => 5,
                'category_name' => 'Emergency Equipment',
                'parent_category_id' => null,
                'description' => 'Emergency and safety equipment',
                'created_at' => '2025-11-18 04:42:48',
            ],
            [
                'category_id' => 6,
                'category_name' => 'Food Ingredients',
                'parent_category_id' => null,
                'description' => 'Perishable and non-perishable food items',
                'created_at' => '2025-11-18 04:42:48',
            ],
        ];

        DB::table('categories')->insert($categories);
    }
}
