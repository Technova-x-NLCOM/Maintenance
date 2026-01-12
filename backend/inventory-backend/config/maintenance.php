<?php

return [
    // List of tables that can be maintained via the Maintenance API
    // Configure primary key and whether soft deletes are supported
    'tables' => [
        'categories' => [
            'primary_key' => 'category_id',
            'soft_deletes' => true,
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
            'soft_deletes' => true,
        ],
        'items' => [
            'primary_key' => 'item_id',
            'soft_deletes' => true,
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
        'inventory_batches' => [
            'primary_key' => 'batch_id',
            'soft_deletes' => true,
            'relations' => [
                'item_id' => [
                    'ref_table' => 'items',
                    'ref_key' => 'item_id',
                    'label_column' => 'item_description',
                ],
            ],
        ],
        'inventory_snapshots' => [
            'primary_key' => 'snapshot_id',
            'soft_deletes' => true,
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
            'soft_deletes' => true,
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
            'soft_deletes' => true,
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
            'soft_deletes' => true,
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
            'relations' => [
                'user_id' => [
                    'ref_table' => 'users',
                    'ref_key' => 'user_id',
                    'label_column' => 'username',
                ],
                'role_id' => [
                    'ref_table' => 'roles',
                    'ref_key' => 'role_id',
                    'label_column' => 'display_name',
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
                    'label_column' => 'display_name',
                ],
                'permission_id' => [
                    'ref_table' => 'permissions',
                    'ref_key' => 'permission_id',
                    'label_column' => 'display_name',
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
