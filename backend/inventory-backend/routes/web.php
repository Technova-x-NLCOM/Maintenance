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

    Route::prefix('api/rbac')
        ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
        ->group(function () {
            Route::middleware(['auth:api'])->group(function () {
                Route::get('roles', [\App\Http\Controllers\RBACController::class, 'roles']);
                Route::post('roles', [\App\Http\Controllers\RBACController::class, 'createRole'])->middleware('permission:manage_roles');
                Route::post('assign-role', [\App\Http\Controllers\RBACController::class, 'assignRole'])->middleware('permission:manage_roles');
                Route::get('permissions', [\App\Http\Controllers\RBACController::class, 'permissions']);
                Route::post('give-permission', [\App\Http\Controllers\RBACController::class, 'givePermission'])->middleware('permission:manage_permissions');
                Route::post('revoke-permission', [\App\Http\Controllers\RBACController::class, 'revokePermission'])->middleware('permission:manage_permissions');
                Route::patch('role-permission', [\App\Http\Controllers\RBACController::class, 'updatePermissionFlags'])->middleware('permission:manage_permissions');
            });
        });

Route::prefix('api/backup')
        ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
        ->group(function () {
            Route::middleware(['auth:api'])->group(function () {
                Route::post('create', [\App\Http\Controllers\BackupController::class, 'backup'])->middleware('permission:manage_backups');
                Route::get('list', [\App\Http\Controllers\BackupController::class, 'listBackups'])->middleware('permission:manage_backups');
                Route::post('restore', [\App\Http\Controllers\BackupController::class, 'restore'])->middleware('permission:manage_backups');
                Route::post('restore-upload', [\App\Http\Controllers\BackupController::class, 'restoreFromUpload'])->middleware('permission:manage_backups');
                Route::post('download', [\App\Http\Controllers\BackupController::class, 'downloadBackup'])->middleware('permission:manage_backups');
                Route::post('delete', [\App\Http\Controllers\BackupController::class, 'deleteBackup'])->middleware('permission:manage_backups');
            });
        });

// Maintenance API routes
Route::prefix('api/maintenance')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api'])->group(function () {
            // Home - List all tables
            Route::get('tables', [\App\Http\Controllers\Maintenance\MaintenanceHomeController::class, 'listTables']);
            
            // Table List - View and manage rows
            Route::get('{table}/schema', [\App\Http\Controllers\Maintenance\TableListController::class, 'schema']);
            Route::get('{table}/rows', [\App\Http\Controllers\Maintenance\TableListController::class, 'listRows']);
            Route::delete('{table}/rows/{id}', [\App\Http\Controllers\Maintenance\TableListController::class, 'delete']);
            Route::post('{table}/rows/{id}/restore', [\App\Http\Controllers\Maintenance\TableListController::class, 'restore']);
            
            // Table Form - Create and update
            Route::post('{table}/rows', [\App\Http\Controllers\Maintenance\TableFormController::class, 'create']);
            Route::put('{table}/rows/{id}', [\App\Http\Controllers\Maintenance\TableFormController::class, 'update']);
        });
    });
