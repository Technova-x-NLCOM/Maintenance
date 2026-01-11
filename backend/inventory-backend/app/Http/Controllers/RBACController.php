<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;

class RBACController extends Controller
{
    // List roles
    public function roles()
    {
        return response()->json(Role::with('permissions')->get());
    }

    // Create a new role (super admin only)
    public function createRole(Request $request)
    {
        $user = auth()->user();
        if (!$user || (!$user->hasRole('super_admin') && ! $user->hasPermission('manage_roles'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'role_name' => 'required|string|unique:roles,role_name',
            'display_name' => 'nullable|string',
            'description' => 'nullable|string',
            'is_system_role' => 'sometimes|boolean',
        ]);

        $role = Role::create($data);
        return response()->json($role, 201);
    }

    // Assign role to user (super admin only)
    public function assignRole(Request $request)
    {
        $user = auth()->user();
        if (!$user || (!$user->hasRole('super_admin') && ! $user->hasPermission('manage_roles'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,user_id',
            'role_id' => 'required|integer|exists:roles,role_id',
            'is_primary' => 'sometimes|boolean',
        ]);

        $target = User::find($data['user_id']);
        $roleId = $data['role_id'];
        $isPrimary = isset($data['is_primary']) ? (bool)$data['is_primary'] : false;

        if ($isPrimary) {
            DB::table('user_roles')->where('user_id', $target->user_id)->update(['is_primary' => false]);
        }

        $target->roles()->syncWithoutDetaching([$roleId => ['is_primary' => $isPrimary]]);

        return response()->json(['message' => 'Role assigned']);
    }

    // Create or attach a permission to a role (super admin only)
    public function givePermission(Request $request)
    {
        $user = auth()->user();
        if (!$user || (!$user->hasRole('super_admin') && ! $user->hasPermission('manage_permissions'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'role_id' => 'required|integer|exists:roles,role_id',
            'permission_name' => 'required|string',
            'display_name' => 'nullable|string',
            'description' => 'nullable|string',
            'can_create' => 'sometimes|boolean',
            'can_read' => 'sometimes|boolean',
            'can_update' => 'sometimes|boolean',
            'can_delete' => 'sometimes|boolean',
        ]);

        $role = Role::find($data['role_id']);

        $permission = Permission::firstOrCreate(
            ['permission_name' => $data['permission_name']],
            ['display_name' => $data['display_name'] ?? null, 'description' => $data['description'] ?? null]
        );

        // If the target role is super_admin, always grant full CRUD
        if ($role && $role->role_name === 'super_admin') {
            $pivotData = [
                'can_create' => true,
                'can_read' => true,
                'can_update' => true,
                'can_delete' => true,
            ];
        } else {
            $pivotData = [
                'can_create' => isset($data['can_create']) ? (bool)$data['can_create'] : false,
                'can_read' => isset($data['can_read']) ? (bool)$data['can_read'] : true,
                'can_update' => isset($data['can_update']) ? (bool)$data['can_update'] : false,
                'can_delete' => isset($data['can_delete']) ? (bool)$data['can_delete'] : false,
            ];
        }

        $role->permissions()->syncWithoutDetaching([
            $permission->permission_id => $pivotData
        ]);

        return response()->json(['message' => 'Permission attached to role']);
    }

    // Revoke a permission from a role (super admin only)
    public function revokePermission(Request $request)
    {
        $user = auth()->user();
        if (!$user || (!$user->hasRole('super_admin') && ! $user->hasPermission('manage_permissions'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'role_id' => 'required|integer|exists:roles,role_id',
            'permission_id' => 'required|integer|exists:permissions,permission_id',
        ]);

        $role = Role::find($data['role_id']);
        $role->permissions()->detach($data['permission_id']);

        return response()->json(['message' => 'Permission revoked']);
    }

    // Update CRUD flags on an existing role-permission pivot
    public function updatePermissionFlags(Request $request)
    {
        $user = auth()->user();
        if (!$user || (!$user->hasRole('super_admin') && ! $user->hasPermission('manage_permissions'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'role_id' => 'required|integer|exists:roles,role_id',
            'permission_id' => 'required|integer|exists:permissions,permission_id',
            'can_create' => 'sometimes|boolean',
            'can_read' => 'sometimes|boolean',
            'can_update' => 'sometimes|boolean',
            'can_delete' => 'sometimes|boolean',
        ]);

        $role = Role::find($data['role_id']);
        if (!$role) {
            return response()->json(['message' => 'Role not found'], 404);
        }

        // Enforce full CRUD for super_admin
        if ($role->role_name === 'super_admin') {
            $pivotData = [
                'can_create' => true,
                'can_read' => true,
                'can_update' => true,
                'can_delete' => true,
            ];
        } else {
            $pivotData = [
                'can_create' => isset($data['can_create']) ? (bool)$data['can_create'] : false,
                'can_read' => isset($data['can_read']) ? (bool)$data['can_read'] : true,
                'can_update' => isset($data['can_update']) ? (bool)$data['can_update'] : false,
                'can_delete' => isset($data['can_delete']) ? (bool)$data['can_delete'] : false,
            ];
        }

        // Update existing pivot
        $role->permissions()->updateExistingPivot($data['permission_id'], $pivotData);

        return response()->json(['message' => 'Role-permission flags updated']);
    }

    // List permissions
    public function permissions()
    {
        return response()->json(Permission::all());
    }
}
