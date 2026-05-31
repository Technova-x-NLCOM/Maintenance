<?php

use App\Mail\ResetPasswordMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

it('creates a passwordless user and sends a set-password email', function () {
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

    $payload = [
        'username' => 'invitee_' . uniqid(),
        'email' => uniqid('invitee_') . '@example.com',
        'first_name' => 'Invitee',
        'last_name' => 'User',
        'contact_info' => '09171234567',
        'role' => 'inventory_manager',
        'is_active' => true,
    ];

    $response = $this->actingAs($admin, 'api')
        ->postJson('/api/users', $payload)
        ->assertStatus(201)
        ->assertJsonPath('invite_sent', true);

    $response->assertJsonPath('message', 'User created successfully. A set-password email has been sent.');

    $this->assertDatabaseHas('users', [
        'username' => $payload['username'],
        'email' => $payload['email'],
        'password_hash' => null,
    ]);

    $this->assertDatabaseHas('password_reset_tokens', [
        'email' => $payload['email'],
    ]);

    Mail::assertSent(ResetPasswordMail::class, function (ResetPasswordMail $mail) use ($payload) {
        return $mail->hasTo($payload['email']);
    });
});