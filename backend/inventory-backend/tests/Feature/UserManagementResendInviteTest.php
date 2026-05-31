<?php

use App\Mail\ResetPasswordMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

it('resends a set-password invite for a managed user', function () {
    Mail::fake();

    $admin = User::create([
        'username' => 'super_' . uniqid(),
        'email' => uniqid('super_') . '@example.com',
        'password_hash' => bcrypt('Password@123'),
        'first_name' => 'Super',
        'last_name' => 'Admin',
        'is_active' => true,
    ]);

    $super = Role::firstOrCreate(['role_name' => 'super_admin'], ['display_name' => 'Super Administrator']);
    $admin->roles()->attach($super->role_id, ['is_primary' => true]);

    $user = User::create([
        'username' => 'pending_' . uniqid(),
        'email' => uniqid('pending_') . '@example.com',
        'password_hash' => null,
        'first_name' => 'Pending',
        'last_name' => 'User',
        'is_active' => true,
    ]);

    $this->actingAs($admin, 'api')
        ->postJson('/api/users/' . $user->user_id . '/resend-invite')
        ->assertStatus(200)
        ->assertJsonPath('message', 'Set-password invite sent successfully.');

    $this->assertDatabaseHas('password_reset_tokens', [
        'email' => $user->email,
    ]);

    Mail::assertSent(ResetPasswordMail::class, function (ResetPasswordMail $mail) use ($user) {
        return $mail->hasTo($user->email);
    });
});