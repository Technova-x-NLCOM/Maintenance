-- ============================================================================
-- DML Script: Sample Data for inventory_database
-- Notes:
-- - Run AFTER ddl_inventory_database.sql
-- - Password hashes are sample bcrypt values (do not use in production)
-- ============================================================================

USE inventory_database;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_log;
TRUNCATE TABLE expiry_alerts;
TRUNCATE TABLE inventory_snapshots;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE inventory_batches;
TRUNCATE TABLE items;
TRUNCATE TABLE item_types;
TRUNCATE TABLE categories;
TRUNCATE TABLE users;
TRUNCATE TABLE system_settings;
SET FOREIGN_KEY_CHECKS = 1;

-- Users (bcrypt hash for "Password123!")
INSERT INTO users (user_id, username, email, password_hash, first_name, last_name, contact_info, role, is_active)
VALUES
  (1, 'admin', 'admin@nlcom.org', '$2y$10$Q9xFW6.n8vZpJk0q4XZo4uJ6I88vFYzCvFRhwQaX6xWzEl1JHqzGe', 'Super', 'Admin', '09170000000', 'admin', 1),
  (2, 'staff1', 'staff1@nlcom.org', '$2y$10$Q9xFW6.n8vZpJk0q4XZo4uJ6I88vFYzCvFRhwQaX6xWzEl1JHqzGe', 'Juan', 'Dela Cruz', '09171111111', 'staff', 1);

-- Item Types
INSERT INTO item_types (item_type_id, type_name, description) VALUES
  (1, 'general_item', 'General inventory items'),
  (2, 'medicine', 'Medical medicines'),
  (3, 'emergency_safety', 'Emergency and safety equipment'),
  (4, 'consumable', 'Consumable supplies');

-- Categories
INSERT INTO categories (category_id, category_name, parent_category_id, description)
VALUES
  (1, 'General Items', NULL, 'General inventory category'),
  (2, 'Medical Supplies', NULL, 'Medical and healthcare items'),
  (3, 'Emergency Equipment', NULL, 'Emergency and safety equipment'),
  (4, 'Food Ingredients', NULL, 'Perishable and non-perishable food items');

-- Items
INSERT INTO items (item_id, item_code, item_description, item_type_id, category_id, measurement_unit, unit_value, reorder_level, is_active, created_by)
VALUES
  (1, 'MED-0001', 'Paracetamol 500mg Tablet', 2, 2, 'box', 120.00, 50, 1, 1),
  (2, 'SAF-0001', 'N95 Respirator Mask', 3, 3, 'box', 450.00, 100, 1, 1),
  (3, 'FOOD-0001', 'Rice 50kg Sack', 4, 4, 'sack', 1800.00, 20, 1, 1);

-- Inventory Batches
INSERT INTO inventory_batches (batch_id, item_id, batch_number, quantity, expiry_date, supplier_info, batch_value, status)
VALUES
  (1, 1, 'MED-BATCH-2026-01', 500, '2026-06-30', 'ABC Pharma', 60000.00, 'active'),
  (2, 2, 'SAF-BATCH-2026-02', 300, '2027-01-31', 'SafeCo Supplies', 135000.00, 'active'),
  (3, 3, 'FOOD-BATCH-2026-03', 40, '2026-02-15', 'AgriCorp', 72000.00, 'active');

-- Inventory Transactions
INSERT INTO inventory_transactions (transaction_id, item_id, batch_id, transaction_type, quantity, reference_number, transaction_date, reason, destination, performed_by, approved_by)
VALUES
  (1, 1, 1, 'IN', 500, 'PO-2026-001', '2026-01-10 09:00:00', 'Replenishment', 'Central Warehouse', 1, 1),
  (2, 2, 2, 'OUT', 50, 'REL-2026-015', '2026-01-11 10:30:00', 'Distribution', 'Typhoon Response Team', 2, 1),
  (3, 3, 3, 'OUT', 5, 'REL-2026-016', '2026-01-11 11:00:00', 'Distribution', 'Mobile Kitchen', 2, 1);

-- Inventory Snapshots
INSERT INTO inventory_snapshots (snapshot_id, item_id, batch_id, snapshot_date, quantity, total_value, notes, created_by)
VALUES
  (1, 1, 1, '2026-01-10', 500, 60000.00, 'Initial receipt', 1),
  (2, 2, 2, '2026-01-11', 250, 112500.00, 'Post distribution', 2),
  (3, 3, 3, '2026-01-11', 35, 63000.00, 'Post distribution', 2);

-- Expiry Alerts (near-expiry example)
INSERT INTO expiry_alerts (alert_id, batch_id, alert_date, days_until_expiry, status, acknowledged_by, acknowledged_at)
VALUES
  (1, 3, CURRENT_DATE(), 30, 'pending', NULL, NULL);

-- System Settings
INSERT INTO system_settings (setting_id, setting_key, setting_value, description)
VALUES
  (1, 'expiry_alert_days', '30', 'Number of days before expiry to trigger alert'),
  (2, 'low_stock_threshold', '10', 'Minimum quantity threshold for low stock alerts'),
  (3, 'require_approval_for_out', 'true', 'Require approval for OUT transactions');

-- Audit Log (sample entry)
INSERT INTO audit_log (log_id, table_name, record_id, action, old_values, new_values, performed_by, ip_address)
VALUES
  (1, 'inventory_batches', 3, 'UPDATE', NULL, JSON_OBJECT('quantity', 35), 2, '192.168.1.10');

-- End of DML script
