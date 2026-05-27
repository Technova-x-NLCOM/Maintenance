<?php

it('rejects anonymous access to protected rbac routes', function () {
    $this->getJson('/api/rbac/roles')
        ->assertStatus(401);
});

it('rejects anonymous access to protected settings routes', function () {
    $this->getJson('/api/settings')
        ->assertStatus(401);
});
