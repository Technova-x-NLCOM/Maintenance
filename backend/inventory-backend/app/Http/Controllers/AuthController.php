<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    /**
     * Check if a user's password has been set (public endpoint)
     */
    public function checkPasswordSet(Request $request)
    {
        $request->validate(['username' => 'required|string']);
        $user = User::where('username', $request->username)->first();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'password_set' => !is_null($user->password_hash),
        ]);
    }

    /**
     * Set initial password for a user who has none (public endpoint)
     */
    public function setInitialPassword(Request $request)
    {
        try {
            $data = $request->validate([
                'username' => 'required|string',
                'password' => [
                    'required',
                    'string',
                    'min:8',
                    'max:255',
                    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/',
                    'confirmed',
                ],
            ], [
                'password.regex' => 'Password must contain uppercase, lowercase, number, and a special character (@$!%*?&).',
            ]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed.', 'errors' => $e->errors()], 422);
        }

        $user = User::where('username', $data['username'])->first();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 404);
        }

        if (!is_null($user->password_hash)) {
            return response()->json(['success' => false, 'message' => 'Password is already set.'], 409);
        }

        $user->password_hash = Hash::make($data['password']);
        $user->save();

        return response()->json(['success' => true, 'message' => 'Password set successfully. You can now log in.']);
    }

    /**
     * Register a new user (Super Admin only)
     */
    public function register(Request $request)
    {
        try {
            $data = $request->validate([
                'username' => [
                    'required',
                    'string',
                    'min:3',
                    'max:50',
                    'alpha_dash',
                    Rule::unique('users', 'username')
                ],
                'email' => [
                    'required',
                    'string',
                    'email:rfc',
                    'max:100',
                    Rule::unique('users', 'email')
                ],
                'password' => [
                    'required',
                    'string',
                    'min:8',
                    'max:255',
                    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/',
                ],
                'password_confirmation' => [
                    'required',
                    'same:password'
                ],
                'first_name' => [
                    'required',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/'
                ],
                'last_name' => [
                    'required',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/'
                ],
                'contact_info' => [
                    'nullable',
                    'string',
                    'max:100',
                    'regex:/^[\+]?[0-9\s\-\(\)]+$/'
                ],
                'role' => [
                    'nullable',
                    Rule::in(['super_admin', 'inventory_manager'])
                ],
            ], [
                // Custom error messages
                'username.required' => 'Username is required.',
                'username.min' => 'Username must be at least 3 characters long.',
                'username.max' => 'Username cannot exceed 50 characters.',
                'username.alpha_dash' => 'Username can only contain letters, numbers, dashes, and underscores.',
                'username.unique' => 'This username is already taken. Please choose a different one.',
                
                'email.required' => 'Email address is required.',
                'email.email' => 'Please enter a valid email address.',
                'email.unique' => 'This email address is already registered. Please use a different email.',
                
                'password.required' => 'Password is required.',
                'password.min' => 'Password must be at least 8 characters long.',
                'password.max' => 'Password cannot exceed 255 characters.',
                'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).',
                
                'password_confirmation.required' => 'Password confirmation is required.',
                'password_confirmation.same' => 'Password confirmation does not match the password.',
                
                'first_name.required' => 'First name is required.',
                'first_name.min' => 'First name must be at least 2 characters long.',
                'first_name.max' => 'First name cannot exceed 50 characters.',
                'first_name.regex' => 'First name can only contain letters, spaces, hyphens, apostrophes, and periods.',
                
                'last_name.required' => 'Last name is required.',
                'last_name.min' => 'Last name must be at least 2 characters long.',
                'last_name.max' => 'Last name cannot exceed 50 characters.',
                'last_name.regex' => 'Last name can only contain letters, spaces, hyphens, apostrophes, and periods.',
                
                'contact_info.regex' => 'Contact information can only contain numbers, spaces, hyphens, parentheses, and plus signs.',
                'contact_info.max' => 'Contact information cannot exceed 100 characters.',
                
                'role.in' => 'Invalid role selected. Please choose either Super Admin or Inventory Manager.',
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed. Please check your input and try again.',
                'errors' => $e->errors(),
                'error_count' => count($e->errors())
            ], 422);
        }

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
            $roleName = $data['role'] ?? 'inventory_manager';
            $role = Role::where('role_name', $roleName)->first();
            
            if (!$role) {
                throw new \Exception('Selected role does not exist in the system.');
            }
            
            $user->roles()->attach($role->role_id, ['is_primary' => true]);

            DB::commit();

            // Generate JWT token for the new user
            $token = JWTAuth::fromUser($user);
            $user->load('primaryRole');

            return response()->json([
                'success' => true,
                'message' => 'User registered successfully! Welcome to NLCOM Inventory System.',
                'access_token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
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
                'success' => false,
                'message' => 'Registration failed. Please try again.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        try {
            $credentials = $request->validate([
                'identifier' => [
                    'required',
                    'string',
                    'min:3',
                    'max:100'
                ],
                'password' => [
                    'required',
                    'string',
                    'min:1',
                    'max:255'
                ],
                'expected_role' => [
                    'nullable',
                    'string',
                    'in:super_admin,inventory_manager'
                ],
            ], [
                'identifier.required' => 'Username or email is required.',
                'identifier.min' => 'Username or email must be at least 3 characters long.',
                'identifier.max' => 'Username or email cannot exceed 100 characters.',
                'identifier.string' => 'Username or email must be a valid text.',
                
                'password.required' => 'Password is required.',
                'password.min' => 'Password cannot be empty.',
                'password.max' => 'Password is too long.',
                'password.string' => 'Password must be valid text.',
                
                'expected_role.in' => 'Invalid portal role specified.',
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Please check your login information and try again.',
                'errors' => $e->errors(),
                'error_count' => count($e->errors())
            ], 422);
        }

        $identifier = trim($credentials['identifier']);
        $password = $credentials['password'];
        $expectedRole = $credentials['expected_role'] ?? null;

        // Determine if identifier is email or username
        $field = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        try {
            // Find user by identifier
            $user = User::where($field, $identifier)->first();
            
            // Check if user exists
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'No account found with this ' . ($field === 'email' ? 'email address' : 'username') . '.',
                    'error_type' => 'user_not_found'
                ], 404);
            }
            
            // Check if user is active
            if (!$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account has been deactivated. Please contact the system administrator.',
                    'error_type' => 'account_inactive'
                ], 403);
            }
            
            // Check password
            if (!Hash::check($password, $user->password_hash)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Incorrect password. Please check your password and try again.',
                    'error_type' => 'invalid_password'
                ], 401);
            }

            // Check if user's role matches expected role BEFORE issuing token
            if ($expectedRole && $user->role !== $expectedRole) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account does not have access to this portal. Please use the correct login page.',
                    'error_type' => 'unauthorized_portal_access',
                    'user_role' => $user->role,
                    'expected_role' => $expectedRole
                ], 403);
            }

            // Generate JWT token (only after all validation passes)
            $token = JWTAuth::fromUser($user);
            $user->load('primaryRole');

            // Record last login — use direct DB update so it always persists (migration must be run).
            if (Schema::hasColumn('users', 'last_login_at')) {
                $now = now();
                DB::table('users')
                    ->where('user_id', $user->user_id)
                    ->update([
                        'last_login_at' => $now,
                        'updated_at' => $now,
                    ]);
                $user->last_login_at = $now;
            } else {
                $user->touch('updated_at');
            }

            return response()->json([
                'success' => true,
                'message' => 'Login successful! Welcome back, ' . $user->first_name . '.',
                'access_token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
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
            ], 200);
            
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not create authentication token. Please try again.',
                'error_type' => 'token_creation_failed'
            ], 500);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Login failed due to a system error. Please try again.',
                'error_type' => 'system_error'
            ], 500);
        }
    }

    /**
     * Get authenticated user information
     */
    public function me(Request $request)
    {
        try {
            // Get authenticated user from JWT token
            $user = JWTAuth::parseToken()->authenticate();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found. Please login again.',
                    'error_type' => 'user_not_found'
                ], 404);
            }
            
            if (!$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account has been deactivated. Please contact the system administrator.',
                    'error_type' => 'account_inactive'
                ], 403);
            }

            $user->load('primaryRole');

            return response()->json([
                'success' => true,
                'message' => 'User information retrieved successfully.',
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
            ], 200);
            
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired authentication token. Please login again.',
                'error_type' => 'invalid_token'
            ], 401);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not retrieve user information. Please try again.',
                'error_type' => 'system_error'
            ], 500);
        }
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        try {
            // Get the token from the request
            $token = JWTAuth::getToken();
            
            if (!$token) {
                return response()->json([
                    'success' => false,
                    'message' => 'No authentication token found.',
                    'error_type' => 'no_token'
                ], 400);
            }
            
            // Invalidate the JWT token
            JWTAuth::invalidate($token);
            
            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully. Thank you for using NLCOM Inventory System.'
            ], 200);
            
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not logout properly. Please clear your browser cache.',
                'error_type' => 'logout_failed'
            ], 500);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Logout failed due to a system error.',
                'error_type' => 'system_error'
            ], 500);
        }
    }

    /**
     * Refresh JWT token
     */
    public function refresh(Request $request)
    {
        try {
            $token = JWTAuth::getToken();
            
            if (!$token) {
                return response()->json([
                    'success' => false,
                    'message' => 'No authentication token found.',
                    'error_type' => 'no_token'
                ], 400);
            }
            
            $newToken = JWTAuth::refresh($token);
            
            return response()->json([
                'success' => true,
                'message' => 'Token refreshed successfully.',
                'access_token' => $newToken,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
            ], 200);
            
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Could not refresh token. Please login again.',
                'error_type' => 'refresh_failed'
            ], 401);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token refresh failed due to a system error.',
                'error_type' => 'system_error'
            ], 500);
        }
    }
}
