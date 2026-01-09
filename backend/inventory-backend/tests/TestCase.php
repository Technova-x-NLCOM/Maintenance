<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Creates the application.
     */
    public function createApplication()
    {
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();

        // Create minimal schema required for tests to avoid running full migrations
        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->id('user_id');
                $table->string('name')->nullable();
                $table->string('username')->nullable();
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('password_hash')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->id('role_id');
                $table->string('role_name')->unique();
                $table->string('display_name')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_system_role')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table) {
                $table->id('permission_id');
                $table->string('permission_name')->unique();
                $table->string('display_name')->nullable();
                $table->text('description')->nullable();
                $table->string('module')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('role_permissions')) {
            Schema::create('role_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->unsignedBigInteger('permission_id');
                $table->timestamps();
                $table->primary(['role_id', 'permission_id']);
            });
        }

        if (!Schema::hasTable('user_roles')) {
            Schema::create('user_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('role_id');
                $table->boolean('is_primary')->default(false);
                $table->timestamps();
                $table->primary(['user_id', 'role_id']);
            });
        }
    }
}
