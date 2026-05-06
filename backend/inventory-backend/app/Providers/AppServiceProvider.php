<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Routing\Router;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register route middleware alias for permission checks
        $router = $this->app->make(Router::class);
        $router->aliasMiddleware('permission', \App\Http\Middleware\EnsurePermission::class);

        RateLimiter::for('system-api', function ($request) {
            $key = $request->user()?->user_id ?? $request->ip();

            return Limit::perMinute(60)->by($key);
        });

        RateLimiter::for('auth-public', function ($request) {
            $key = $request->input('identifier') ?: $request->input('email') ?: $request->ip();

            return Limit::perMinute(10)->by($key);
        });
    }
}
