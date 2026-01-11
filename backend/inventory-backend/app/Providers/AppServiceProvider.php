<?php

namespace App\Providers;

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
    }
}
