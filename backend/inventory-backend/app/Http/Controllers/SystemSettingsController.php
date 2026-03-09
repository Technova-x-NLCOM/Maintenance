<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemSettingsController extends Controller
{
    /**
     * List all system settings (super admin only via middleware)
     */
    public function index()
    {
        $settings = DB::table('system_settings')->get();
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
