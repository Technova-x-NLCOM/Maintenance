<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AlertEscalationRule extends Model
{
    protected $table = 'alert_escalation_rules';
    protected $primaryKey = 'rule_id';

    protected $fillable = [
        'alert_type',
        'severity',
        'escalation_minutes',
        'escalation_roles',
        'is_active'
    ];

    protected $casts = [
        'escalation_roles' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get active escalation rule for alert type and severity
     */
    public static function getRule(string $alertType, string $severity): ?self
    {
        return self::where('alert_type', $alertType)
            ->where('severity', $severity)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Check if alert should be escalated
     */
    public static function shouldEscalate(string $alertType, string $severity, \DateTime $createdAt): bool
    {
        $rule = self::getRule($alertType, $severity);
        
        if (!$rule) {
            return false;
        }

        $minutesSinceCreated = now()->diffInMinutes($createdAt);
        return $minutesSinceCreated >= $rule->escalation_minutes;
    }

    /**
     * Get default escalation rules
     */
    public static function getDefaultRules(): array
    {
        return [
            [
                'alert_type' => 'expiry',
                'severity' => 'critical',
                'escalation_minutes' => 60, // 1 hour
                'escalation_roles' => ['super_admin', 'inventory_manager'],
                'is_active' => true
            ],
            [
                'alert_type' => 'low_stock',
                'severity' => 'critical',
                'escalation_minutes' => 120, // 2 hours
                'escalation_roles' => ['super_admin', 'inventory_manager'],
                'is_active' => true
            ],
            [
                'alert_type' => 'expiry',
                'severity' => 'warning',
                'escalation_minutes' => 480, // 8 hours
                'escalation_roles' => ['inventory_manager'],
                'is_active' => true
            ],
            [
                'alert_type' => 'low_stock',
                'severity' => 'warning',
                'escalation_minutes' => 720, // 12 hours
                'escalation_roles' => ['inventory_manager'],
                'is_active' => true
            ]
        ];
    }
}