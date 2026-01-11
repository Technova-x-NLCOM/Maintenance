<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasFactory;

    protected $primaryKey = 'permission_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'permission_name',
        'display_name',
        'description',
        'module',
    ];

    // Relationships
    public function roles()
    {
        return $this->belongsToMany(
            Role::class,
            'role_permissions',
            'permission_id',
            'role_id'
        )->withPivot('can_create', 'can_read', 'can_update', 'can_delete')->withTimestamps();
    }
}
