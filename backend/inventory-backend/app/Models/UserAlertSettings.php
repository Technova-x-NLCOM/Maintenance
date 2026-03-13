<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAlertSettings extends Model
{
    protected $table = 'user_alert_settings';
    protected $primaryKey = 'setting_id';

    protected $fillable = [
        'user_id',
        'alert_frequency',
        'expiry_warning_days',
        'critical_expiry_days',
        'warning_expiry_days',
        'email_notifications',
        'push_notifications'
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'push_notifications' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Get default settings for a user
     */
    public static function getDefaultSettings(): array
    {
        return [
            'alert_frequency' => 'immediate',
            'expiry_warning_days' => 30,
            'critical_expiry_days' => 7,
            'warning_expiry_days' => 14,
            'email_notifications' => true,
            'push_notifications' => true
        ];
    }

    /**
     * Get or create settings for a user
     */
    public static function getForUser(int $userId): self
    {
        return self::firstOrCreate(
            ['user_id' => $userId],
            self::getDefaultSettings()
        );
    }
}