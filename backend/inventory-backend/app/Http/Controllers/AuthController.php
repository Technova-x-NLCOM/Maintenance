<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')],
            'email' => ['required', 'string', 'email', 'max:100', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'first_name' => ['required', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:50'],
            'contact_info' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(['admin', 'staff'])],
        ]);

        $user = new User();
        $user->username = $data['username'];
        $user->email = $data['email'];
        $user->password_hash = Hash::make($data['password']);
        $user->first_name = $data['first_name'];
        $user->last_name = $data['last_name'];
        $user->contact_info = $data['contact_info'] ?? null;
        $user->role = $data['role'] ?? 'staff';
        $user->is_active = true;
        $user->save();

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Registration successful',
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'contact_info' => $user->contact_info,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ],
        ], 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'identifier' => ['required', 'string'], // email or username
            'password' => ['required', 'string'],
        ]);

        $identifier = $credentials['identifier'];
        $password = $credentials['password'];

        $field = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        if (! Auth::attempt([$field => $identifier, 'password' => $password, 'is_active' => true])) {
            return response()->json([
                'message' => 'Invalid credentials or inactive account',
            ], 422);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = Auth::user();

        return response()->json([
            'message' => 'Login successful',
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'contact_info' => $user->contact_info,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ],
        ]);
    }

    public function me(Request $request)
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'email' => $user->email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'contact_info' => $user->contact_info,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out']);
    }
}
