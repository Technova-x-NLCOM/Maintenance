-- ============================================================================
-- DDL Script: NLCOM Inventory Management System
-- Database: inventory_database
-- Includes: database creation, tables, constraints, indexes, views
-- Engine: InnoDB, Charset: utf8mb4
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS inventory_database;
CREATE DATABASE inventory_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_database;

-- --------------------------------------------------------------------------
-- TABLES
-- --------------------------------------------------------------------------

CREATE TABLE item_types (
  item_type_id   INT AUTO_INCREMENT PRIMARY KEY,
  type_name      VARCHAR(50) NOT NULL UNIQUE,
  description    TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE categories (
  category_id         INT AUTO_INCREMENT PRIMARY KEY,
  category_name       VARCHAR(100) NOT NULL,
  parent_category_id  INT NULL,
  description         TEXT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id)
    REFERENCES categories(category_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50) NOT NULL UNIQUE,
  email          VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  first_name     VARCHAR(50) NOT NULL,
  last_name      VARCHAR(50) NOT NULL,
  contact_info   VARCHAR(100) NULL,
  role           ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active      TINYINT(1) DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_role (role),
  KEY idx_email (email)
) ENGINE=InnoDB;

CREATE TABLE items (
  item_id            INT AUTO_INCREMENT PRIMARY KEY,
  item_code          VARCHAR(50) NOT NULL UNIQUE,
  item_description   VARCHAR(255) NOT NULL,
  item_type_id       INT NOT NULL,
  category_id        INT NULL,
  measurement_unit   VARCHAR(50) NULL,
  particular         TEXT NULL,
  mg_dosage          DECIMAL(10,2) NULL,
  image_url          VARCHAR(500) NULL,
  remarks            TEXT NULL,
  unit_value         DECIMAL(10,2) NULL,
  reorder_level      INT DEFAULT 0,
  is_active          TINYINT(1) DEFAULT 1,
  created_by         INT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_item_type (item_type_id),
  KEY idx_category (category_id),
  KEY idx_active (is_active),
  KEY idx_created_by (created_by),
  FULLTEXT KEY idx_description (item_description),
  CONSTRAINT fk_items_item_types FOREIGN KEY (item_type_id) REFERENCES item_types(item_type_id),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
  CONSTRAINT fk_items_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inventory_batches (
  batch_id         INT AUTO_INCREMENT PRIMARY KEY,
  item_id          INT NOT NULL,
  batch_number     VARCHAR(100) NULL,
  quantity         INT NOT NULL DEFAULT 0,
  expiry_date      DATE NULL,
  manufactured_date DATE NULL,
  supplier_info    VARCHAR(255) NULL,
  batch_value      DECIMAL(10,2) NULL,
  status           ENUM('active','expired','depleted','quarantined') DEFAULT 'active',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_item (item_id),
  KEY idx_expiry (expiry_date),
  KEY idx_batch_status (status),
  CONSTRAINT fk_batches_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
  transaction_id   INT AUTO_INCREMENT PRIMARY KEY,
  item_id          INT NOT NULL,
  batch_id         INT NULL,
  transaction_type ENUM('IN','OUT','ADJUSTMENT','TRANSFER') NOT NULL,
  quantity         INT NOT NULL,
  reference_number VARCHAR(100) NULL,
  transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason           VARCHAR(255) NULL,
  notes            TEXT NULL,
  destination      VARCHAR(255) NULL,
  performed_by     INT NOT NULL,
  approved_by      INT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_item (item_id),
  KEY idx_batch (batch_id),
  KEY idx_transaction_date (transaction_date),
  KEY idx_transaction_type (transaction_type),
  KEY idx_performed_by (performed_by),
  KEY idx_approved_by (approved_by),
  CONSTRAINT fk_tx_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_batch FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_performed_by FOREIGN KEY (performed_by) REFERENCES users(user_id),
  CONSTRAINT fk_tx_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE inventory_snapshots (
  snapshot_id   INT AUTO_INCREMENT PRIMARY KEY,
  item_id       INT NOT NULL,
  batch_id      INT NULL,
  snapshot_date DATE NOT NULL,
  quantity      INT NOT NULL,
  total_value   DECIMAL(12,2) NULL,
  notes         TEXT NULL,
  created_by    INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_snapshot (item_id, batch_id, snapshot_date),
  KEY idx_snapshot_date (snapshot_date),
  KEY idx_snapshot_item (item_id),
  KEY idx_snapshot_batch (batch_id),
  KEY idx_snapshot_created_by (created_by),
  CONSTRAINT fk_snap_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_snap_batch FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE CASCADE,
  CONSTRAINT fk_snap_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE expiry_alerts (
  alert_id         INT AUTO_INCREMENT PRIMARY KEY,
  batch_id         INT NOT NULL,
  alert_date       DATE NOT NULL,
  days_until_expiry INT NULL,
  status           ENUM('pending','acknowledged','resolved') DEFAULT 'pending',
  acknowledged_by  INT NULL,
  acknowledged_at  TIMESTAMP NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_alert_batch (batch_id),
  KEY idx_alert_status (status),
  KEY idx_alert_date (alert_date),
  KEY idx_ack_by (acknowledged_by),
  CONSTRAINT fk_alert_batch FOREIGN KEY (batch_id) REFERENCES inventory_batches(batch_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_ack_by FOREIGN KEY (acknowledged_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  log_id        INT AUTO_INCREMENT PRIMARY KEY,
  table_name    VARCHAR(50) NOT NULL,
  record_id     INT NOT NULL,
  action        ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  old_values    JSON NULL,
  new_values    JSON NULL,
  performed_by  INT NULL,
  ip_address    VARCHAR(45) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_table_record (table_name, record_id),
  KEY idx_log_performed_by (performed_by),
  KEY idx_log_created_at (created_at),
  CONSTRAINT fk_log_user FOREIGN KEY (performed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE system_settings (
  setting_id    INT AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  description   TEXT NULL,
  updated_by    INT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_setting_updated_by (updated_by),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- VIEWS
-- --------------------------------------------------------------------------

DROP VIEW IF EXISTS v_current_inventory;
CREATE VIEW v_current_inventory AS
SELECT
  i.item_id,
  i.item_code,
  i.item_description,
  it.type_name,
  c.category_name,
  SUM(ib.quantity) AS total_quantity,
  i.unit_value,
  SUM(ib.quantity * i.unit_value) AS total_value,
  MIN(ib.expiry_date) AS nearest_expiry,
  COUNT(DISTINCT ib.batch_id) AS batch_count
FROM items i
LEFT JOIN item_types it ON i.item_type_id = it.item_type_id
LEFT JOIN categories c ON i.category_id = c.category_id
LEFT JOIN inventory_batches ib ON i.item_id = ib.item_id AND ib.status = 'active'
WHERE i.is_active = 1
GROUP BY i.item_id, i.item_code, i.item_description, it.type_name, c.category_name, i.unit_value;

DROP VIEW IF EXISTS v_near_expiry_items;
CREATE VIEW v_near_expiry_items AS
SELECT
  i.item_id,
  i.item_code,
  i.item_description,
  ib.batch_id,
  ib.batch_number,
  ib.quantity,
  ib.expiry_date,
  TO_DAYS(ib.expiry_date) - TO_DAYS(CURDATE()) AS days_until_expiry
FROM items i
JOIN inventory_batches ib ON i.item_id = ib.item_id
WHERE ib.status = 'active'
  AND ib.expiry_date IS NOT NULL
  AND TO_DAYS(ib.expiry_date) - TO_DAYS(CURDATE()) BETWEEN 0 AND 30
ORDER BY days_until_expiry ASC;

DROP VIEW IF EXISTS v_transaction_history;
CREATE VIEW v_transaction_history AS
SELECT
  t.transaction_id,
  t.transaction_date,
  t.transaction_type,
  i.item_code,
  i.item_description,
  t.quantity,
  t.reference_number,
  t.destination,
  CONCAT(u.first_name, ' ', u.last_name) AS performed_by_name,
  t.notes
FROM inventory_transactions t
JOIN items i ON t.item_id = i.item_id
JOIN users u ON t.performed_by = u.user_id
ORDER BY t.transaction_date DESC;

SET FOREIGN_KEY_CHECKS = 1;
-- End of DDL script
