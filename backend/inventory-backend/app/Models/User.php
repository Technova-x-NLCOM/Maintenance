<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    protected $primaryKey = 'user_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'username',
        'email',
        'password_hash',
        'password_initialized',
        'first_name',
        'last_name',
        'contact_info',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $appends = ['role'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'password_initialized' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    // Relationships
    public function roles()
    {
        return $this->belongsToMany(
            Role::class,
            'user_roles',
            'user_id',
            'role_id'
        )->withPivot('is_primary')->withTimestamps();
    }

    public function primaryRole()
    {
        return $this->belongsToMany(
            Role::class,
            'user_roles',
            'user_id',
            'role_id'
        )->wherePivot('is_primary', true)->withTimestamps();
    }

    // Helper methods
    public function hasRole($roleName)
    {
        return $this->roles()->where('role_name', $roleName)->exists();
    }

    public function hasPermission($permissionName)
    {
        return $this->roles()
            ->whereHas('permissions', function ($q) use ($permissionName) {
                $q->where('permission_name', $permissionName)
                  ->where(function ($q2) {
                      $q2->where('role_permissions.can_create', true)
                         ->orWhere('role_permissions.can_read', true)
                         ->orWhere('role_permissions.can_update', true)
                         ->orWhere('role_permissions.can_delete', true);
                  });
            })->exists();
    }
    public function getRoleAttribute()
    {
        $primaryRole = $this->primaryRole()->first();
        return $primaryRole ? $primaryRole->role_name : null;
    }

    // JWT Methods
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [
            'email' => $this->email,
            'username' => $this->username,
            'role' => $this->role,
        ];
    }
}
