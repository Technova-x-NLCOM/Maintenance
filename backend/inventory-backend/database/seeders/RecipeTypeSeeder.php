<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RecipeTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['name' => 'Feeding Program', 'description' => 'Planned feeding/distribution programs'],
            ['name' => 'Relief Goods', 'description' => 'Emergency relief supplies'],
            ['name' => 'Clinical', 'description' => 'Clinical or medical formulations'],
            ['name' => 'Manufacturing', 'description' => 'Production / manufacturing batches'],
            ['name' => 'Internal Use', 'description' => 'Internal consumption or testing'],
        ];

        foreach ($types as $t) {
            DB::table('recipe_types')->updateOrInsert([
                'name' => $t['name']
            ], [
                'description' => $t['description'],
                'updated_at' => now(),
                'created_at' => now(),
            ]);
        }
    }
}
