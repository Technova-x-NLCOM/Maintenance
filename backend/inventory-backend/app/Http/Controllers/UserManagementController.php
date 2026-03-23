<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserManagementController extends Controller
{
    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if (!$user->hasRole('super_admin') && !$user->hasPermission('manage_roles')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    /**
     * List users for System Users UI (primary role + last login).
     */
    public function index(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeAdmin($request)) {
            return $deny;
        }

        $users = User::query()
            ->with('primaryRole')
            ->orderByDesc('user_id')
            ->get();

        $data = $users->map(function (User $u) {
            $role = $u->primaryRole->first();
            return [
                'user_id' => $u->user_id,
                'username' => $u->username,
                'email' => $u->email,
                'first_name' => $u->first_name,
                'last_name' => $u->last_name,
                'contact_info' => $u->contact_info,
                'is_active' => (bool) $u->is_active,
                'role_name' => $role ? $role->role_name : null,
                'role_display_name' => $role ? ($role->display_name ?: $role->role_name) : null,
                // ISO-8601 string so the frontend Date parser is reliable across browsers
                'last_login_at' => $u->last_login_at
                    ? $u->last_login_at->toIso8601String()
                    : null,
                'created_at' => $u->created_at,
                'updated_at' => $u->updated_at,
            ];
        });

        return response()->json($data);
    }

    /**
     * Create a user account (admin). Mirrors AuthController::register validation but does not issue a JWT.
     */
    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeAdmin($request)) {
            return $deny;
        }

        try {
            $data = $request->validate([
                'username' => [
                    'required',
                    'string',
                    'min:3',
                    'max:50',
                    'alpha_dash',
                    Rule::unique('users', 'username'),
                ],
                'email' => [
                    'required',
                    'string',
                    'email:rfc',
                    'max:100',
                    Rule::unique('users', 'email'),
                ],
                'password' => [
                    'required',
                    'string',
                    'min:8',
                    'max:255',
                    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/',
                ],
                'password_confirmation' => [
                    'required',
                    'same:password',
                ],
                'first_name' => [
                    'required',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/',
                ],
                'last_name' => [
                    'required',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/',
                ],
                'contact_info' => [
                    'nullable',
                    'string',
                    'max:100',
                    'regex:/^[\+]?[0-9\s\-\(\)]+$/',
                ],
                'role' => [
                    'nullable',
                    Rule::in(['super_admin', 'inventory_manager']),
                ],
                'is_active' => ['sometimes', 'boolean'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
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
            $user->is_active = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true;
            $user->save();

            $roleName = $data['role'] ?? 'inventory_manager';
            $role = Role::where('role_name', $roleName)->first();
            if (!$role) {
                throw new \RuntimeException('Selected role does not exist in the system.');
            }
            $user->roles()->sync([$role->role_id => ['is_primary' => true]]);

            DB::commit();

            $user->load('primaryRole');
            $pr = $user->primaryRole->first();

            return response()->json([
                'message' => 'User created successfully.',
                'user' => [
                    'user_id' => $user->user_id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'contact_info' => $user->contact_info,
                    'is_active' => (bool) $user->is_active,
                    'role_name' => $pr ? $pr->role_name : null,
                    'role_display_name' => $pr ? ($pr->display_name ?: $pr->role_name) : null,
                    'last_login_at' => $user->last_login_at
                        ? $user->last_login_at->toIso8601String()
                        : null,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ],
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create user.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, int $userId): JsonResponse
    {
        if ($deny = $this->authorizeAdmin($request)) {
            return $deny;
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $actor = $request->user();
        $actorId = $actor ? $actor->getKey() : null;

        try {
            $data = $request->validate([
                'username' => [
                    'sometimes',
                    'string',
                    'min:3',
                    'max:50',
                    'alpha_dash',
                    Rule::unique('users', 'username')->ignore($user->user_id, 'user_id'),
                ],
                'email' => [
                    'sometimes',
                    'string',
                    'email:rfc',
                    'max:100',
                    Rule::unique('users', 'email')->ignore($user->user_id, 'user_id'),
                ],
                'first_name' => [
                    'sometimes',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/',
                ],
                'last_name' => [
                    'sometimes',
                    'string',
                    'min:2',
                    'max:50',
                    'regex:/^[a-zA-Z\s\-\'\.]+$/',
                ],
                'contact_info' => [
                    'nullable',
                    'string',
                    'max:100',
                    'regex:/^[\+]?[0-9\s\-\(\)]+$/',
                ],
                'role' => [
                    'sometimes',
                    Rule::in(['super_admin', 'inventory_manager']),
                ],
                'password' => [
                    'nullable',
                    'string',
                    'min:8',
                    'max:255',
                    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/',
                ],
                'password_confirmation' => ['required_with:password', 'same:password'],
                'is_active' => ['sometimes', 'boolean'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }

        if (array_key_exists('is_active', $data) && $data['is_active'] === false && $actorId !== null && (int) $user->user_id === (int) $actorId) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        if (isset($data['role']) && $data['role'] !== 'super_admin' && $actorId !== null && (int) $user->user_id === (int) $actorId && $user->hasRole('super_admin')) {
            return response()->json(['message' => 'You cannot remove Super Admin role from your own account.'], 422);
        }

        DB::beginTransaction();
        try {
            if (!empty($data['password'])) {
                $user->password_hash = Hash::make($data['password']);
            }

            $fill = Arr::only($data, ['username', 'email', 'first_name', 'last_name', 'contact_info', 'is_active']);
            $user->fill($fill);
            $user->save();

            if (isset($data['role'])) {
                $role = Role::where('role_name', $data['role'])->firstOrFail();
                $user->roles()->sync([$role->role_id => ['is_primary' => true]]);
            }

            DB::commit();

            $user->refresh();
            $user->load('primaryRole');
            $pr = $user->primaryRole->first();

            return response()->json([
                'message' => 'User updated successfully.',
                'user' => [
                    'user_id' => $user->user_id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'contact_info' => $user->contact_info,
                    'is_active' => (bool) $user->is_active,
                    'role_name' => $pr ? $pr->role_name : null,
                    'role_display_name' => $pr ? ($pr->display_name ?: $pr->role_name) : null,
                    'last_login_at' => $user->last_login_at
                        ? $user->last_login_at->toIso8601String()
                        : null,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update user.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
