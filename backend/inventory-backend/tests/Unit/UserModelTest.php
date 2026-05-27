<?php

use App\Models\User;

it('returns the password_hash via getAuthPassword', function () {
    $user = new User([
        'password_hash' => 'supersecret',
    ]);

    expect($user->getAuthPassword())->toBe('supersecret');
});
