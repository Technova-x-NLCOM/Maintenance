<?php

use App\Models\User;
use App\Models\Role;
use App\Models\Permission;

beforeEach(function () {
    // Ensure database migrations/seeds run when using RefreshDatabase in environment
});

it('allows super_admin to create a role', function () {
    // create a user and give super_admin role
    $user = User::factory()->create();

    $super = Role::firstOrCreate(['role_name' => 'super_admin'], ['display_name' => 'Super Administrator']);
    $user->roles()->attach($super->role_id, ['is_primary' => true]);

    $this->actingAs($user, 'api')
        ->postJson('/api/rbac/roles', ['role_name' => 'qa_role'])
        ->assertStatus(201);

    $this->assertDatabaseHas('roles', ['role_name' => 'qa_role']);
});

it('forbids non-privileged user from creating a role', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'api')
        ->postJson('/api/rbac/roles', ['role_name' => 'should_not_create'])
        ->assertStatus(403);

    $this->assertDatabaseMissing('roles', ['role_name' => 'should_not_create']);
});
