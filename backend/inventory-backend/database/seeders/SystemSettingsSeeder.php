<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SystemSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            [
                'setting_id' => 1,
                'setting_key' => 'expiry_alert_days',
                'setting_value' => '30',
                'description' => 'Number of days before expiry to trigger alert',
                'updated_by' => null,
                'updated_at' => '2025-11-18 04:42:48',
            ],
            [
                'setting_id' => 2,
                'setting_key' => 'low_stock_threshold',
                'setting_value' => '10',
                'description' => 'Minimum quantity threshold for low stock alerts',
                'updated_by' => null,
                'updated_at' => '2025-11-18 04:42:48',
            ],
            [
                'setting_id' => 3,
                'setting_key' => 'require_approval_for_out',
                'setting_value' => 'true',
                'description' => 'Require approval for OUT transactions',
                'updated_by' => null,
                'updated_at' => '2025-11-18 04:42:48',
            ],
        ];

        DB::table('system_settings')->insert($settings);
    }
}
