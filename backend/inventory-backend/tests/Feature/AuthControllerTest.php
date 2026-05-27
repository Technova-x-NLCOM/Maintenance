<?php

it('returns validation errors when login payload is missing', function () {
    $this->postJson('/api/auth/login', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['identifier', 'password']);
});
