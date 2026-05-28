<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * SanitizeInput middleware
 * - Trims string inputs
 * - Strips HTML tags
 * - Removes control characters (including null bytes)
 *
 * Note: This is a defensive layer; always validate and use parameterized queries on the server.
 */
class SanitizeInput
{
    public function handle(Request $request, Closure $next)
    {
        $data = $request->all();
        $sanitized = $this->sanitizeArray($data);
        $request->merge($sanitized);
        return $next($request);
    }

    private function sanitizeArray(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $out[$key] = $this->sanitizeArray($value);
            } elseif (is_string($value)) {
                // Trim
                $v = trim($value);
                // Remove HTML tags
                $v = strip_tags($v);
                // Remove control chars (0x00-0x1F, 0x7F)
                $v = preg_replace('/[\x00-\x1F\x7F]+/u', '', $v);
                $out[$key] = $v;
            } else {
                $out[$key] = $value;
            }
        }
        return $out;
    }
}
