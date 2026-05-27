<?php

it('returns validation errors for check-password-set when identifier is missing', function () {
    $this->postJson('/api/auth/check-password-set', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['identifier']);
});

it('returns validation errors for forgot-password when email is missing', function () {
    $this->postJson('/api/auth/forgot-password', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

it('returns validation errors for reset-password when fields are missing', function () {
    $this->postJson('/api/auth/reset-password', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email', 'token', 'password']);
});

it('returns validation errors for register when required fields are missing', function () {
    $this->postJson('/api/auth/register', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors([
            'username',
            'email',
            'password',
            'password_confirmation',
            'first_name',
            'last_name',
        ]);
});
