<?php

return [
    // List of tables that can be maintained via the Maintenance API
    // Configure primary key and whether soft deletes are supported
    'tables' => [
        'categories' => [
            'primary_key' => 'category_id',
            'soft_deletes' => false, // No deleted_at column in this table
            'relations' => [
                // parent_category_id references categories.category_id -> categories.category_name
                'parent_category_id' => [
                    'ref_table' => 'categories',
                    'ref_key' => 'category_id',
                    'label_column' => 'category_name',
                ],
            ],
        ],
        'item_types' => [
            'primary_key' => 'item_type_id',
            'soft_deletes' => false, // No deleted_at column in this table
        ],
        'items' => [
            'primary_key' => 'item_id',
            'soft_deletes' => false, // No deleted_at column - uses is_active instead
            'relations' => [
                'item_type_id' => [
                    'ref_table' => 'item_types',
                    'ref_key' => 'item_type_id',
                    'label_column' => 'type_name',
                ],
                'category_id' => [
                    'ref_table' => 'categories',
                    'ref_key' => 'category_id',
                    'label_column' => 'category_name',
                ],
                'created_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
        'locations' => [
            'primary_key' => 'location_id',
            'soft_deletes' => false,
        ],
        'inventory_batches' => [
            'primary_key' => 'batch_id',
            'soft_deletes' => false, // No deleted_at column - uses status field instead
            'relations' => [
                'item_id' => [
                    'ref_table' => 'items',
                    'ref_key' => 'item_id',
                    'label_column' => 'item_description',
                ],
                'location_id' => [
                    'ref_table' => 'locations',
                    'ref_key' => 'location_id',
                    'label_column' => 'location_name',
                ],
            ],
        ],
        'inventory_snapshots' => [
            'primary_key' => 'snapshot_id',
            'soft_deletes' => false, // No deleted_at column
            'relations' => [
                'item_id' => [
                    'ref_table' => 'items',
                    'ref_key' => 'item_id',
                    'label_column' => 'item_description',
                ],
                'batch_id' => [
                    'ref_table' => 'inventory_batches',
                    'ref_key' => 'batch_id',
                    'label_column' => 'batch_number',
                ],
                'created_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
        'inventory_transactions' => [
            'primary_key' => 'transaction_id',
            'soft_deletes' => false, // No deleted_at column - transactions should not be deleted
            'relations' => [
                'item_id' => [
                    'ref_table' => 'items',
                    'ref_key' => 'item_id',
                    'label_column' => 'item_description',
                ],
                'batch_id' => [
                    'ref_table' => 'inventory_batches',
                    'ref_key' => 'batch_id',
                    'label_column' => 'batch_number',
                ],
                'from_location_id' => [
                    'ref_table' => 'locations',
                    'ref_key' => 'location_id',
                    'label_column' => 'location_name',
                ],
                'to_location_id' => [
                    'ref_table' => 'locations',
                    'ref_key' => 'location_id',
                    'label_column' => 'location_name',
                ],
                'performed_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
                'approved_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
        'expiry_alerts' => [
            'primary_key' => 'alert_id',
            'soft_deletes' => false, // No deleted_at column
            'relations' => [
                'batch_id' => [
                    'ref_table' => 'inventory_batches',
                    'ref_key' => 'batch_id',
                    'label_column' => 'batch_number',
                ],
                'acknowledged_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
        'system_settings' => [
            'primary_key' => 'setting_id',
            'soft_deletes' => false, // No deleted_at column
            'relations' => [
                'updated_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
        'permissions' => [
            'primary_key' => 'permission_id',
            'soft_deletes' => false, // No deleted_at column
        ],
        'roles' => [
            'primary_key' => 'role_id',
            'soft_deletes' => false, // No deleted_at column
        ],
        'users' => [
            'primary_key' => 'user_id',
            'soft_deletes' => false, // No deleted_at column - uses is_active instead
            'hidden_columns' => ['password_hash'], // Hide sensitive columns
        ],
        'user_roles' => [
            'primary_key' => ['user_id', 'role_id'],
            'soft_deletes' => false, // No deleted_at column
            'relations' => [
                'user_id' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
                'role_id' => [
                    'ref_table' => 'roles',
                    'ref_key' => 'role_id',
                    'label_column' => 'role_name',
                ],
            ],
        ],
        'role_permissions' => [
            'primary_key' => ['role_id', 'permission_id'],
            'soft_deletes' => false,
            'relations' => [
                'role_id' => [
                    'ref_table' => 'roles',
                    'ref_key' => 'role_id',
                    'label_column' => 'role_name',
                ],
                'permission_id' => [
                    'ref_table' => 'permissions',
                    'ref_key' => 'permission_id',
                    'label_column' => 'permission_name',
                ],
            ],
        ],
        'audit_log' => [
            'primary_key' => 'log_id',
            'soft_deletes' => false, // audit logs should not be soft deleted
            'relations' => [
                'performed_by' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
            ],
        ],
    ],
];
