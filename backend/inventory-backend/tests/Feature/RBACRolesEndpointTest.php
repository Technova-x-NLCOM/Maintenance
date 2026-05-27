<?php

use App\Models\User;

it('returns a 200 response for the rbac roles list', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'api')
        ->getJson('/api/rbac/roles')
        ->assertStatus(200);
});
