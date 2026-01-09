<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('api/auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])
        ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
    Route::post('login', [AuthController::class, 'login'])
        ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
    
        // Protected routes with JWT middleware
        Route::middleware(['auth:api'])->group(function () {
            Route::get('me', [AuthController::class, 'me'])
                ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
            Route::post('logout', [AuthController::class, 'logout'])
                ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
        });
});

    Route::prefix('api/rbac')->group(function () {
        Route::middleware(['auth:api'])->group(function () {
            Route::get('roles', [\App\Http\Controllers\RBACController::class, 'roles']);
            Route::post('roles', [\App\Http\Controllers\RBACController::class, 'createRole']);
            Route::post('assign-role', [\App\Http\Controllers\RBACController::class, 'assignRole']);
            Route::get('permissions', [\App\Http\Controllers\RBACController::class, 'permissions']);
            Route::post('give-permission', [\App\Http\Controllers\RBACController::class, 'givePermission']);
            Route::post('revoke-permission', [\App\Http\Controllers\RBACController::class, 'revokePermission']);
        });
    });
