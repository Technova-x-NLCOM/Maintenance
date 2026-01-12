<?php

return [
    // List of tables that can be maintained via the Maintenance API
    // Configure primary key and whether soft deletes are supported
    'tables' => [
        'categories' => [
            'primary_key' => 'category_id',
            'soft_deletes' => true,
        ],
        'item_types' => [
            'primary_key' => 'item_type_id',
            'soft_deletes' => true,
        ],
        'items' => [
            'primary_key' => 'item_id',
            'soft_deletes' => true,
        ],
        'inventory_batches' => [
            'primary_key' => 'batch_id',
            'soft_deletes' => true,
        ],
        'inventory_snapshots' => [
            'primary_key' => 'snapshot_id',
            'soft_deletes' => true,
        ],
        'inventory_transactions' => [
            'primary_key' => 'transaction_id',
            'soft_deletes' => true,
        ],
        'expiry_alerts' => [
            'primary_key' => 'alert_id',
            'soft_deletes' => true,
        ],
        'system_settings' => [
            'primary_key' => 'setting_id',
            'soft_deletes' => true,
        ],
        'permissions' => [
            'primary_key' => 'permission_id',
            'soft_deletes' => true,
        ],
        'roles' => [
            'primary_key' => 'role_id',
            'soft_deletes' => true,
        ],
        'users' => [
            'primary_key' => 'user_id',
            'soft_deletes' => true,
        ],
        'user_roles' => [
            'primary_key' => ['user_id', 'role_id'],
            'soft_deletes' => true,
        ],
        'role_permissions' => [
            'primary_key' => ['role_id', 'permission_id'],
            'soft_deletes' => false,
        ],
        'audit_log' => [
            'primary_key' => 'log_id',
            'soft_deletes' => false, // audit logs should not be soft deleted
        ],
    ],
];
