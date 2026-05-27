<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

function createSuperAdminForFeatureTests(): User
{
    $user = User::create([
        'username' => 'super_' . uniqid(),
        'email' => uniqid('super_') . '@example.com',
        'password_hash' => bcrypt('Password@123'),
        'first_name' => 'Super',
        'last_name' => 'Admin',
        'is_active' => true,
    ]);

    $role = Role::firstOrCreate(
        ['role_name' => 'super_admin'],
        ['display_name' => 'Super Administrator']
    );

    $user->roles()->syncWithoutDetaching([
        $role->role_id => ['is_primary' => true],
    ]);

    return $user;
}

it('lists maintainable tables for a super admin', function () {
    $user = createSuperAdminForFeatureTests();

    $response = $this->actingAs($user, 'api')
        ->getJson('/api/maintenance/tables')
        ->assertStatus(200);

    $response->assertJsonFragment(['name' => 'categories']);
    $response->assertJsonFragment(['name' => 'audit_log']);
});

it('returns dashboard stats for a super admin', function () {
    $user = createSuperAdminForFeatureTests();

    $this->actingAs($user, 'api')
        ->getJson('/api/super-admin/stats')
        ->assertStatus(200)
        ->assertJsonStructure([
            'totalUsers',
            'activeUsers',
            'totalItems',
            'lowStockItems',
            'totalTransactions',
            'pendingAlerts',
            'totalCategories',
            'expiringItems',
        ]);
});

it('returns default system settings for a super admin', function () {
    $user = createSuperAdminForFeatureTests();

    $this->actingAs($user, 'api')
        ->getJson('/api/settings')
        ->assertStatus(200)
        ->assertJsonFragment(['setting_key' => 'expiry_alert_days'])
        ->assertJsonFragment(['setting_key' => 'low_stock_threshold']);
});

it('updates a system setting for a super admin', function () {
    $user = createSuperAdminForFeatureTests();

    DB::table('system_settings')->updateOrInsert(
        ['setting_key' => 'expiry_alert_days'],
        [
            'setting_value' => '30',
            'description' => 'Number of days before expiry to trigger alert',
            'updated_by' => null,
            'updated_at' => now(),
        ]
    );

    $this->actingAs($user, 'api')
        ->putJson('/api/settings/expiry_alert_days', ['setting_value' => '45'])
        ->assertStatus(200)
        ->assertJsonPath('setting_value', '45');

    $this->assertDatabaseHas('system_settings', [
        'setting_key' => 'expiry_alert_days',
        'setting_value' => '45',
    ]);
});

it('rejects restoring a missing backup file for a super admin', function () {
    $user = createSuperAdminForFeatureTests();

    $this->actingAs($user, 'api')
        ->postJson('/api/backup/restore', ['backup_file' => 'missing-backup.sql'])
        ->assertStatus(404);
});
