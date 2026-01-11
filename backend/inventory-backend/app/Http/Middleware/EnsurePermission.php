<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsurePermission
{
    /**
     * Handle an incoming request.
     * Usage: ->middleware('permission:permission_name')
     */
    public function handle(Request $request, Closure $next, $permission = null)
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user->hasRole('super_admin')) {
            return $next($request);
        }

        if ($permission && $user->hasPermission($permission)) {
            return $next($request);
        }

        return response()->json(['message' => 'Forbidden'], 403);
    }
}
