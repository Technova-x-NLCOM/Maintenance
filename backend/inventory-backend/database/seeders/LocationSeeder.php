<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LocationSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $now = now();

        $locations = [
            [
                'location_code' => 'LOCATION-001',
                'location_name' => 'Central Warehouse',
                'location_type' => 'warehouse',
                'description' => 'Primary storage for incoming inventory',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'location_code' => 'LOCATION-002',
                'location_name' => 'Relief Supplies Room',
                'location_type' => 'storage_room',
                'description' => 'Emergency and distribution-ready supplies',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'location_code' => 'LOCATION-003',
                'location_name' => 'Pantry / Food Storage',
                'location_type' => 'pantry',
                'description' => 'Food inventory storage area',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($locations as $location) {
            DB::table('locations')->updateOrInsert(
                ['location_code' => $location['location_code']],
                $location
            );
        }
    }
}