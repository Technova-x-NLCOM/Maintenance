// User-friendly table and column configurations for elderly users

export interface TableConfig {
  name: string;
  friendlyName: string;
  description: string;
  icon: string;
  category: 'core' | 'inventory' | 'users' | 'system';
}

export interface ColumnConfig {
  friendlyName: string;
  description?: string;
  placeholder?: string;
}

// Table configurations with friendly names and descriptions
export const TABLE_CONFIGS: { [key: string]: TableConfig } = {
  'users': {
    name: 'users',
    friendlyName: 'Users',
    description: 'Manage system users and their accounts',
    icon: 'users',
    category: 'users'
  },
  'items': {
    name: 'items',
    friendlyName: 'Inventory Items',
    description: 'All items stored in the inventory',
    icon: 'package',
    category: 'inventory'
  },
  'categories': {
    name: 'categories',
    friendlyName: 'Categories',
    description: 'Item categories for organization',
    icon: 'folder',
    category: 'inventory'
  },
  'item_types': {
    name: 'item_types',
    friendlyName: 'Item Types',
    description: 'Different types of inventory items',
    icon: 'tag',
    category: 'inventory'
  },
  'inventory_batches': {
    name: 'inventory_batches',
    friendlyName: 'Inventory Batches',
    description: 'Batch information with quantities and expiry dates',
    icon: 'layers',
    category: 'inventory'
  },
  'inventory_transactions': {
    name: 'inventory_transactions',
    friendlyName: 'Transactions',
    description: 'Record of all inventory movements (in/out)',
    icon: 'activity',
    category: 'inventory'
  },
  'inventory_snapshots': {
    name: 'inventory_snapshots',
    friendlyName: 'Inventory Snapshots',
    description: 'Historical inventory records at specific dates',
    icon: 'camera',
    category: 'inventory'
  },
  'expiry_alerts': {
    name: 'expiry_alerts',
    friendlyName: 'Expiry Alerts',
    description: 'Alerts for items nearing expiration',
    icon: 'alert-triangle',
    category: 'inventory'
  },
  'audit_log': {
    name: 'audit_log',
    friendlyName: 'Activity Log',
    description: 'Record of all system activities and changes',
    icon: 'file-text',
    category: 'system'
  },
  'system_settings': {
    name: 'system_settings',
    friendlyName: 'System Settings',
    description: 'Application configuration and preferences',
    icon: 'settings',
    category: 'system'
  },
  'roles': {
    name: 'roles',
    friendlyName: 'User Roles',
    description: 'Define user roles and access levels',
    icon: 'shield',
    category: 'users'
  },
  'permissions': {
    name: 'permissions',
    friendlyName: 'Permissions',
    description: 'System permissions and access rights',
    icon: 'key',
    category: 'users'
  },
  'role_permissions': {
    name: 'role_permissions',
    friendlyName: 'Role Permissions',
    description: 'Link permissions to specific roles',
    icon: 'link',
    category: 'users'
  },
  'user_roles': {
    name: 'user_roles',
    friendlyName: 'User Role Assignments',
    description: 'Assign roles to users',
    icon: 'user-check',
    category: 'users'
  }
};

// Column configurations with friendly names
export const COLUMN_CONFIGS: { [table: string]: { [column: string]: ColumnConfig } } = {
  'users': {
    'user_id': { friendlyName: 'User ID', description: 'Unique identifier' },
    'username': { friendlyName: 'Username', description: 'Login name', placeholder: 'Enter username' },
    'email': { friendlyName: 'Email Address', description: 'User email', placeholder: 'example@email.com' },
    'password_hash': { friendlyName: 'Password', description: 'Encrypted password' },
    'first_name': { friendlyName: 'First Name', description: 'Given name', placeholder: 'Enter first name' },
    'last_name': { friendlyName: 'Last Name', description: 'Family name', placeholder: 'Enter last name' },
    'contact_info': { friendlyName: 'Contact Number', description: 'Phone or mobile', placeholder: 'Enter phone number' },
    'role': { friendlyName: 'User Role', description: 'Access level' },
    'is_active': { friendlyName: 'Active Status', description: 'Is account active?' },
    'created_at': { friendlyName: 'Date Created', description: 'When account was created' },
    'updated_at': { friendlyName: 'Last Updated', description: 'Last modification date' }
  },
  'items': {
    'item_id': { friendlyName: 'Item ID', description: 'Unique identifier' },
    'item_code': { friendlyName: 'Item Code', description: 'Unique item code', placeholder: 'e.g., ITM-001' },
    'item_description': { friendlyName: 'Item Name/Description', description: 'What is this item?', placeholder: 'Enter item name' },
    'item_type_id': { friendlyName: 'Item Type', description: 'Category of item' },
    'category_id': { friendlyName: 'Category', description: 'Item category' },
    'measurement_unit': { friendlyName: 'Unit of Measure', description: 'How is it measured?', placeholder: 'e.g., pcs, kg, box' },
    'particular': { friendlyName: 'Particulars/Details', description: 'Additional details', placeholder: 'Enter additional details' },
    'mg_dosage': { friendlyName: 'Dosage (mg)', description: 'For medicines only', placeholder: 'Enter dosage in mg' },
    'image_url': { friendlyName: 'Image URL', description: 'Link to item image', placeholder: 'https://...' },
    'remarks': { friendlyName: 'Remarks/Notes', description: 'Additional notes', placeholder: 'Enter any notes' },
    'unit_value': { friendlyName: 'Unit Price', description: 'Price per unit', placeholder: '0.00' },
    'reorder_level': { friendlyName: 'Reorder Level', description: 'Minimum stock before reorder', placeholder: 'Enter minimum quantity' },
    'is_active': { friendlyName: 'Active', description: 'Is item active?' },
    'created_by': { friendlyName: 'Created By', description: 'Who added this item' },
    'created_at': { friendlyName: 'Date Added', description: 'When item was added' },
    'updated_at': { friendlyName: 'Last Updated', description: 'Last modification' }
  },
  'categories': {
    'category_id': { friendlyName: 'Category ID', description: 'Unique identifier' },
    'category_name': { friendlyName: 'Category name', description: 'Name of this category', placeholder: 'e.g. Office supplies' },
    'parent_category_id': { friendlyName: 'Parent category (optional)', description: 'Leave blank for a top-level category' },
    'description': { friendlyName: 'Description (optional)', description: 'Short description of this category', placeholder: 'Describe this category' },
    'created_at': { friendlyName: 'Date created', description: 'When created' }
  },
  'item_types': {
    'item_type_id': { friendlyName: 'Type ID', description: 'Unique identifier' },
    'type_name': { friendlyName: 'Type name', description: 'What kind of item is this?', placeholder: 'e.g. Medicine, Equipment' },
    'description': { friendlyName: 'Description (optional)', description: 'Short description', placeholder: 'Describe this type' }
  },
  'inventory_batches': {
    'batch_id': { friendlyName: 'Batch ID', description: 'Unique identifier' },
    'item_id': { friendlyName: 'Item', description: 'Which item is this batch for?' },
    'batch_number': { friendlyName: 'Batch or lot number', description: 'Reference number for this batch', placeholder: 'e.g. LOT-2024-001' },
    'quantity': { friendlyName: 'Quantity', description: 'Number of units in this batch', placeholder: 'e.g. 100' },
    'expiry_date': { friendlyName: 'Expiry date', description: 'When does this batch expire?', placeholder: 'YYYY-MM-DD' },
    'manufactured_date': { friendlyName: 'Manufacturing date (optional)', description: 'When was it made?', placeholder: 'YYYY-MM-DD' },
    'supplier_info': { friendlyName: 'Supplier (optional)', description: 'Where did it come from?', placeholder: 'Supplier name' },
    'batch_value': { friendlyName: 'Batch value (optional)', description: 'Total value of this batch', placeholder: '0.00' },
    'status': { friendlyName: 'Status', description: 'Current batch status' },
    'created_at': { friendlyName: 'Date added', description: 'When batch was added' },
    'updated_at': { friendlyName: 'Last updated', description: 'Last modification' }
  },
  'inventory_transactions': {
    'transaction_id': { friendlyName: 'Transaction ID', description: 'Unique identifier' },
    'item_id': { friendlyName: 'Item', description: 'Which item?' },
    'batch_id': { friendlyName: 'Batch', description: 'Which batch?' },
    'transaction_type': { friendlyName: 'Type', description: 'In, Out, Adjustment, or Transfer' },
    'quantity': { friendlyName: 'Quantity', description: 'How many units?', placeholder: 'e.g. 10' },
    'reference_number': { friendlyName: 'Reference number (optional)', description: 'Document or reference', placeholder: 'e.g. PO-12345' },
    'transaction_date': { friendlyName: 'Date', description: 'When did this happen?' },
    'reason': { friendlyName: 'Reason (optional)', description: 'Why was this done?', placeholder: 'Brief reason' },
    'notes': { friendlyName: 'Notes (optional)', description: 'Additional notes', placeholder: 'Any notes' },
    'destination': { friendlyName: 'Destination (optional)', description: 'Where is it going?', placeholder: 'Destination' },
    'performed_by': { friendlyName: 'Performed by', description: 'Who did this?' },
    'approved_by': { friendlyName: 'Approved by', description: 'Who approved?' },
    'created_at': { friendlyName: 'Date recorded', description: 'When recorded' }
  },
  'inventory_snapshots': {
    'snapshot_id': { friendlyName: 'Snapshot ID', description: 'Unique identifier' },
    'item_id': { friendlyName: 'Item', description: 'Which item?' },
    'batch_id': { friendlyName: 'Batch', description: 'Which batch?' },
    'snapshot_date': { friendlyName: 'Snapshot date', description: 'Date of this stock count', placeholder: 'YYYY-MM-DD' },
    'quantity': { friendlyName: 'Quantity', description: 'Stock count at this date', placeholder: 'e.g. 50' },
    'total_value': { friendlyName: 'Total value (optional)', description: 'Value at snapshot time', placeholder: '0.00' },
    'notes': { friendlyName: 'Notes (optional)', description: 'Additional notes', placeholder: 'Any notes' },
    'created_by': { friendlyName: 'Created by', description: 'Who created this?' },
    'created_at': { friendlyName: 'Date created', description: 'When created' }
  },
  'expiry_alerts': {
    'alert_id': { friendlyName: 'Alert ID', description: 'Unique identifier' },
    'batch_id': { friendlyName: 'Batch', description: 'Which batch?' },
    'alert_date': { friendlyName: 'Alert date', description: 'When alert was raised' },
    'days_until_expiry': { friendlyName: 'Days until expiry', description: 'Days remaining' },
    'status': { friendlyName: 'Status', description: 'Alert status' },
    'acknowledged_by': { friendlyName: 'Acknowledged by', description: 'Who acknowledged?' },
    'acknowledged_at': { friendlyName: 'Acknowledged date', description: 'When acknowledged' },
    'created_at': { friendlyName: 'Date created', description: 'When created' }
  },
  'audit_log': {
    'log_id': { friendlyName: 'Log ID', description: 'Unique identifier' },
    'table_name': { friendlyName: 'Table', description: 'Which table was changed?' },
    'record_id': { friendlyName: 'Record ID', description: 'Which record?' },
    'action': { friendlyName: 'Action', description: 'What was done?' },
    'old_values': { friendlyName: 'Previous Values', description: 'Values before change' },
    'new_values': { friendlyName: 'New Values', description: 'Values after change' },
    'performed_by': { friendlyName: 'Performed By', description: 'Who did this?' },
    'ip_address': { friendlyName: 'IP Address', description: 'From which computer?' },
    'created_at': { friendlyName: 'Date/Time', description: 'When it happened' }
  },
  'system_settings': {
    'setting_id': { friendlyName: 'Setting ID', description: 'Unique identifier' },
    'setting_key': { friendlyName: 'Setting Name', description: 'Name of setting', placeholder: 'Enter setting name' },
    'setting_value': { friendlyName: 'Value', description: 'Setting value', placeholder: 'Enter value' },
    'description': { friendlyName: 'Description', description: 'What does this setting do?', placeholder: 'Describe the setting' },
    'updated_by': { friendlyName: 'Last Updated By', description: 'Who changed it?' },
    'updated_at': { friendlyName: 'Last Updated', description: 'When changed' }
  },
  'roles': {
    'role_id': { friendlyName: 'Role ID', description: 'Unique identifier' },
    'role_name': { friendlyName: 'Role Name', description: 'Name of role', placeholder: 'Enter role name' },
    'display_name': { friendlyName: 'Display Name', description: 'Friendly display name', placeholder: 'Enter display name' },
    'description': { friendlyName: 'Description', description: 'Role description', placeholder: 'Describe this role' },
    'created_at': { friendlyName: 'Date Created', description: 'When created' },
    'updated_at': { friendlyName: 'Last Updated', description: 'When updated' }
  },
  'permissions': {
    'permission_id': { friendlyName: 'Permission ID', description: 'Unique identifier' },
    'permission_name': { friendlyName: 'Permission Name', description: 'Name of permission', placeholder: 'Enter permission name' },
    'display_name': { friendlyName: 'Display Name', description: 'Friendly display name', placeholder: 'Enter display name' },
    'description': { friendlyName: 'Description', description: 'What does this allow?', placeholder: 'Describe the permission' },
    'created_at': { friendlyName: 'Date Created', description: 'When created' }
  },
  'role_permissions': {
    'role_id': { friendlyName: 'Role', description: 'Which role?' },
    'permission_id': { friendlyName: 'Permission', description: 'Which permission?' },
    'can_create': { friendlyName: 'Can Create', description: 'Allow creating?' },
    'can_read': { friendlyName: 'Can View', description: 'Allow viewing?' },
    'can_update': { friendlyName: 'Can Edit', description: 'Allow editing?' },
    'can_delete': { friendlyName: 'Can Delete', description: 'Allow deleting?' }
  },
  'user_roles': {
    'user_id': { friendlyName: 'User', description: 'Which user?' },
    'role_id': { friendlyName: 'Role', description: 'Which role?' },
    'is_primary': { friendlyName: 'Primary Role', description: 'Is this the main role?' },
    'assigned_at': { friendlyName: 'Date Assigned', description: 'When assigned' }
  }
};

// Helper function to get friendly table name
export function getFriendlyTableName(tableName: string): string {
  return TABLE_CONFIGS[tableName]?.friendlyName || formatColumnName(tableName);
}

// Helper function to get table description
export function getTableDescription(tableName: string): string {
  return TABLE_CONFIGS[tableName]?.description || '';
}

// Helper function to get table icon
export function getTableIcon(tableName: string): string {
  return TABLE_CONFIGS[tableName]?.icon || 'database';
}

// Helper function to get table category
export function getTableCategory(tableName: string): string {
  return TABLE_CONFIGS[tableName]?.category || 'system';
}

// Helper function to get friendly column name
export function getFriendlyColumnName(tableName: string, columnName: string): string {
  const config = COLUMN_CONFIGS[tableName]?.[columnName];
  if (config) return config.friendlyName;
  return formatColumnName(columnName);
}

// Helper function to get column description
export function getColumnDescription(tableName: string, columnName: string): string {
  return COLUMN_CONFIGS[tableName]?.[columnName]?.description || '';
}

// Helper function to get column placeholder
export function getColumnPlaceholder(tableName: string, columnName: string): string {
  const config = COLUMN_CONFIGS[tableName]?.[columnName];
  if (config?.placeholder) return config.placeholder;
  return `Enter ${getFriendlyColumnName(tableName, columnName).toLowerCase()}`;
}

// Format column name (fallback): snake_case to Title Case
export function formatColumnName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
