<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemSettingsController extends Controller
{
    /**
     * Default rows when the table was never seeded (keeps UI usable).
     *
     * @return array<int, array<string, mixed>>
     */
    private function defaultSettingsRows(): array
    {
        $now = now()->format('Y-m-d H:i:s');

        return [
            [
                'setting_key' => 'expiry_alert_days',
                'setting_value' => '30',
                'description' => 'Number of days before expiry to trigger alert',
                'updated_by' => null,
                'updated_at' => $now,
            ],
            [
                'setting_key' => 'low_stock_threshold',
                'setting_value' => '10',
                'description' => 'Minimum quantity threshold for low stock alerts',
                'updated_by' => null,
                'updated_at' => $now,
            ],
            [
                'setting_key' => 'require_approval_for_out',
                'setting_value' => 'true',
                'description' => 'Require approval for OUT transactions',
                'updated_by' => null,
                'updated_at' => $now,
            ],
            [
                'setting_key' => 'expiry_email_recipients',
                'setting_value' => '',
                'description' => 'Comma-separated recipient emails for near-expiry notification messages',
                'updated_by' => null,
                'updated_at' => $now,
            ],
        ];
    }

    /**
     * Ensure at least the default settings exist (idempotent).
     */
    private function ensureDefaultSettingsExist(): void
    {
        if (DB::table('system_settings')->exists()) {
            return;
        }

        foreach ($this->defaultSettingsRows() as $row) {
            DB::table('system_settings')->insertOrIgnore($row);
        }
    }

    /**
     * List all system settings (super admin only via middleware)
     */
    public function index()
    {
        $this->ensureDefaultSettingsExist();

        $settings = DB::table('system_settings')->orderBy('setting_key')->get();

        return response()->json($settings);
    }

    /**
     * Update a setting by key (super admin only via middleware)
     */
    public function update(Request $request, $key)
    {
        $data = $request->validate([
            'setting_value' => 'required|string|max:1000',
        ]);

        $user = auth()->user();

        $updated = DB::table('system_settings')
            ->where('setting_key', $key)
            ->update([
                'setting_value' => $data['setting_value'],
                'updated_by'    => $user->user_id,
                'updated_at'    => now(),
            ]);

        if (!$updated) {
            return response()->json(['message' => 'Setting not found'], 404);
        }

        $setting = DB::table('system_settings')->where('setting_key', $key)->first();
        return response()->json($setting);
    }
}
