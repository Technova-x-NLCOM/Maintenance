<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertHistory extends Model
{
    protected $table = 'alert_history';
    protected $primaryKey = 'history_id';

    protected $fillable = [
        'alert_type',
        'alert_reference',
        'message',
        'severity',
        'status',
        'created_by',
        'acknowledged_by',
        'resolved_by',
        'acknowledged_at',
        'resolved_at',
        'metadata'
    ];

    protected $casts = [
        'metadata' => 'array',
        'acknowledged_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function acknowledger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by', 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by', 'user_id');
    }

    /**
     * Create alert history entry
     */
    public static function createEntry(array $data): self
    {
        return self::create([
            'alert_type' => $data['type'],
            'alert_reference' => $data['reference'] ?? null,
            'message' => $data['message'],
            'severity' => $data['severity'],
            'status' => $data['status'] ?? 'pending',
            'created_by' => $data['created_by'] ?? null,
            'metadata' => $data['metadata'] ?? null
        ]);
    }

    /**
     * Acknowledge alert
     */
    public function acknowledge(int $userId): bool
    {
        return $this->update([
            'status' => 'acknowledged',
            'acknowledged_by' => $userId,
            'acknowledged_at' => now()
        ]);
    }

    /**
     * Resolve alert
     */
    public function resolve(int $userId): bool
    {
        return $this->update([
            'status' => 'resolved',
            'resolved_by' => $userId,
            'resolved_at' => now()
        ]);
    }
}