<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AlertEscalationRule;
use App\Models\UserAlertSettings;
use App\Models\User;

class AlertManagementSeeder extends Seeder
{
    public function run()
    {
        // Create default escalation rules
        $defaultRules = AlertEscalationRule::getDefaultRules();
        
        foreach ($defaultRules as $rule) {
            AlertEscalationRule::updateOrCreate(
                [
                    'alert_type' => $rule['alert_type'],
                    'severity' => $rule['severity']
                ],
                $rule
            );
        }

        // Create default alert settings for existing users
        $users = User::all();
        
        foreach ($users as $user) {
            UserAlertSettings::firstOrCreate(
                ['user_id' => $user->user_id],
                UserAlertSettings::getDefaultSettings()
            );
        }

        // Update categories with default reorder levels
        \DB::table('categories')->update([
            'default_reorder_level' => 10,
            'default_expiry_warning_days' => 30
        ]);

        echo "Alert management seeder completed successfully!\n";
        echo "- Created " . count($defaultRules) . " escalation rules\n";
        echo "- Created alert settings for " . $users->count() . " users\n";
        echo "- Updated category defaults\n";
    }
}