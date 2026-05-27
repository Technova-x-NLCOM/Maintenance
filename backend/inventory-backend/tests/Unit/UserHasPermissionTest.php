<?php

use App\Models\User;

class RolesRelationStub
{
    public function __construct(private bool $existsReturn) {}

    public function whereHas($relation, $callback)
    {
        // ignore callback and return self for chaining
        return $this;
    }

    public function exists()
    {
        return $this->existsReturn;
    }
}

it('returns true when the roles relation reports the permission exists', function () {
    $user = new class extends User {
        public $rolesReturn;
        public function roles() { return $this->rolesReturn; }
    };

    $user->rolesReturn = new RolesRelationStub(true);

    expect($user->hasPermission('some_permission'))->toBeTrue();
});

it('returns false when the roles relation reports the permission does not exist', function () {
    $user = new class extends User {
        public $rolesReturn;
        public function roles() { return $this->rolesReturn; }
    };

    $user->rolesReturn = new RolesRelationStub(false);

    expect($user->hasPermission('other_permission'))->toBeFalse();
});
