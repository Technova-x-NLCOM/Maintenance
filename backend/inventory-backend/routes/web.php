<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Inventory\CategoryController;
use App\Http\Controllers\Inventory\IssuanceTransactionController;
use App\Http\Controllers\Inventory\ItemController;
use App\Http\Controllers\Inventory\ItemTypeController;
use App\Http\Controllers\Inventory\ReceivingTransactionController;

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
            Route::post('refresh', [AuthController::class, 'refresh'])
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
                Route::get('me/permissions', [\App\Http\Controllers\RBACController::class, 'currentRolePermissions']);
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

// Profile API routes
Route::prefix('api/profile')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api'])->group(function () {
            Route::put('update', [\App\Http\Controllers\ProfileController::class, 'update']);
            Route::put('password', [\App\Http\Controllers\ProfileController::class, 'changePassword']);
        });
    });

// Super Admin Dashboard API routes
Route::prefix('api/super-admin')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api'])->group(function () {
            Route::get('stats', [\App\Http\Controllers\SuperAdminController::class, 'stats']);
            Route::get('dashboard-preview', [\App\Http\Controllers\SuperAdminController::class, 'dashboardPreview']);
            Route::get('activity', [\App\Http\Controllers\SuperAdminController::class, 'activity']);
            Route::get('alerts', [\App\Http\Controllers\SuperAdminController::class, 'alerts']);
            Route::post('alerts/{alertId}/acknowledge', [\App\Http\Controllers\SuperAdminController::class, 'acknowledgeAlert']);
        });
    });


// Inventory Manager Dashboard API routes
Route::prefix('api/inventory-manager')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api'])->group(function () {
            Route::get('stats', [\App\Http\Controllers\InventoryManagerController::class, 'stats']);
            Route::get('dashboard-preview', [\App\Http\Controllers\InventoryManagerController::class, 'dashboardPreview']);
            Route::get('activity', [\App\Http\Controllers\InventoryManagerController::class, 'activity']);
            Route::get('alerts', [\App\Http\Controllers\InventoryManagerController::class, 'alerts']);
        });
    });

// Inventory Master Data - Item Registration and Updates
Route::prefix('api/inventory/items')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_inventory'])->group(function () {
            Route::get('options', [ItemController::class, 'options']);
            Route::get('minimum-stock', [ItemController::class, 'minimumStockList']);
            Route::patch('minimum-stock/bulk', [ItemController::class, 'bulkUpdateMinimumStock']);
            Route::patch('{itemId}/minimum-stock', [ItemController::class, 'updateMinimumStock']);
            Route::post('{itemId}/expected-expiry', [ItemController::class, 'expectedExpiry']);
            Route::get('/', [ItemController::class, 'index']);
            Route::get('{itemId}', [ItemController::class, 'show']);
            Route::post('/', [ItemController::class, 'store']);
            Route::put('{itemId}', [ItemController::class, 'update']);
            Route::patch('{itemId}/status', [ItemController::class, 'updateStatus']);
        });
    });

// Inventory Master Data - Category Management
Route::prefix('api/inventory/categories')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_categories'])->group(function () {
            Route::get('items/available', [CategoryController::class, 'listAssignableItems']);
            Route::get('{categoryId}/items', [CategoryController::class, 'listCategoryItems']);
            Route::post('{categoryId}/items', [CategoryController::class, 'assignItem']);
            Route::delete('{categoryId}/items/{itemId}', [CategoryController::class, 'removeItem']);
            Route::get('options', [CategoryController::class, 'options']);
            Route::get('/', [CategoryController::class, 'index']);
            Route::get('{categoryId}', [CategoryController::class, 'show']);
            Route::post('/', [CategoryController::class, 'store']);
            Route::put('{categoryId}', [CategoryController::class, 'update']);
            Route::delete('{categoryId}', [CategoryController::class, 'destroy']);
        });
    });

// Item types (for category setup and item registration)
Route::prefix('api/inventory/item-types')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_categories'])->group(function () {
            Route::get('/', [ItemTypeController::class, 'index']);
            Route::post('/', [ItemTypeController::class, 'store']);
        });
    });

// Inventory Transactions - Receiving (IN)
Route::prefix('api/inventory/receiving')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_inventory'])->group(function () {
            Route::get('items', [ReceivingTransactionController::class, 'getReceivingItems']);
            Route::post('create', [ReceivingTransactionController::class, 'createReceiving']);
        });
    });

// Inventory Transactions - Issuance (OUT)
Route::prefix('api/inventory/issuance')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_inventory'])->group(function () {
            Route::get('items', [IssuanceTransactionController::class, 'getIssuableItems']);
            Route::post('create', [IssuanceTransactionController::class, 'createIssuance']);
        });
    });

// Maintenance API routes
Route::prefix('api/maintenance')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_maintenance'])->group(function () {
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

// System Settings API routes (super admin only)
Route::prefix('api/settings')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class])
    ->group(function () {
        Route::middleware(['auth:api', 'permission:manage_settings'])->group(function () {
            Route::get('/', [\App\Http\Controllers\SystemSettingsController::class, 'index']);
            Route::put('{key}', [\App\Http\Controllers\SystemSettingsController::class, 'update']);
        });
    });
