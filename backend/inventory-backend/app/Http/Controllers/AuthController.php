<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\Facades\JWTAuth;

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
            'role' => ['nullable', Rule::in(['super_admin', 'admin', 'staff'])],
        ]);

        DB::beginTransaction();
        try {
            $user = new User();
            $user->username = $data['username'];
            $user->email = $data['email'];
            $user->password_hash = Hash::make($data['password']);
            $user->first_name = $data['first_name'];
            $user->last_name = $data['last_name'];
            $user->contact_info = $data['contact_info'] ?? null;
            $user->is_active = true;
            $user->save();

            // Assign role
            $roleName = $data['role'] ?? 'staff';
            $role = Role::where('role_name', $roleName)->first();
            if ($role) {
                $user->roles()->attach($role->role_id, ['is_primary' => true]);
            }

            DB::commit();

                // Generate JWT token for the new user
                $token = JWTAuth::fromUser($user);
                $user->load('primaryRole');

            return response()->json([
                'message' => 'Registration successful',
                    'access_token' => $token,
                    'token_type' => 'bearer',
                    'expires_in' => auth('api')->factory()->getTTL() * 60,
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
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Registration failed',
                'error' => $e->getMessage()
            ], 500);
        }
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

            // Find user by identifier
            $user = User::where($field, $identifier)->where('is_active', true)->first();
        
            if (!$user || !Hash::check($password, $user->password_hash)) {
            return response()->json([
                'message' => 'Invalid credentials or inactive account',
            ], 422);
        }

            // Generate JWT token
            $token = JWTAuth::fromUser($user);
        $user->load('primaryRole');

        return response()->json([
            'message' => 'Login successful',
                'access_token' => $token,
                'token_type' => 'bearer',
                'expires_in' => auth('api')->factory()->getTTL() * 60,
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
        try {
            // Get authenticated user from JWT token
            $user = JWTAuth::parseToken()->authenticate();
        } catch (\Exception $e) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user->load('primaryRole');

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
        try {
            // Invalidate the JWT token
            JWTAuth::invalidate(JWTAuth::getToken());
            return response()->json(['message' => 'Logged out successfully']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Logout failed'], 500);
        }
    }
}
