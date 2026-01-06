-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 18, 2025 at 06:01 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `draftdb`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `log_id` int(11) NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `record_id` int(11) NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `performed_by` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `parent_category_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `category_name`, `parent_category_id`, `description`, `created_at`) VALUES
(1, 'General Items', NULL, 'General inventory category', '2025-11-18 04:42:48'),
(2, 'Clothing', NULL, 'Clothing and apparel', '2025-11-18 04:42:48'),
(3, 'Kitchen Supplies', NULL, 'Mobile kitchen supplies', '2025-11-18 04:42:48'),
(4, 'Medical Supplies', NULL, 'Medical and healthcare items', '2025-11-18 04:42:48'),
(5, 'Emergency Equipment', NULL, 'Emergency and safety equipment', '2025-11-18 04:42:48'),
(6, 'Food Ingredients', NULL, 'Perishable and non-perishable food items', '2025-11-18 04:42:48');

-- --------------------------------------------------------

--
-- Table structure for table `expiry_alerts`
--

CREATE TABLE `expiry_alerts` (
  `alert_id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `alert_date` date NOT NULL,
  `days_until_expiry` int(11) DEFAULT NULL,
  `status` enum('pending','acknowledged','resolved') DEFAULT 'pending',
  `acknowledged_by` int(11) DEFAULT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_batches`
--

CREATE TABLE `inventory_batches` (
  `batch_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `expiry_date` date DEFAULT NULL,
  `manufactured_date` date DEFAULT NULL,
  `supplier_info` varchar(255) DEFAULT NULL,
  `batch_value` decimal(10,2) DEFAULT NULL,
  `status` enum('active','expired','depleted','quarantined') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_snapshots`
--

CREATE TABLE `inventory_snapshots` (
  `snapshot_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `snapshot_date` date NOT NULL,
  `quantity` int(11) NOT NULL,
  `total_value` decimal(12,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

CREATE TABLE `inventory_transactions` (
  `transaction_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `transaction_type` enum('IN','OUT','ADJUSTMENT','TRANSFER') NOT NULL,
  `quantity` int(11) NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `transaction_date` datetime DEFAULT current_timestamp(),
  `reason` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `destination` varchar(255) DEFAULT NULL,
  `performed_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `item_id` int(11) NOT NULL,
  `item_code` varchar(50) NOT NULL,
  `item_description` varchar(255) NOT NULL,
  `item_type_id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `measurement_unit` varchar(50) DEFAULT NULL,
  `particular` text DEFAULT NULL,
  `mg_dosage` decimal(10,2) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `unit_value` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_types`
--

CREATE TABLE `item_types` (
  `item_type_id` int(11) NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL
) ;

--
-- Dumping data for table `item_types`
--

INSERT INTO `item_types` (`item_type_id`, `type_name`, `description`) VALUES
(1, 'general_item', 'General inventory items'),
(2, 'nlcom_shirt', 'NLCOM branded shirts'),
(3, 'perishable', 'Perishable ingredients for mobile kitchen'),
(4, 'tool_utensil', 'Kitchen tools and utensils'),
(5, 'consumable', 'Consumable supplies'),
(6, 'medicine', 'Medical medicines'),
(7, 'medical_item', 'Medical equipment and supplies'),
(8, 'emergency_safety', 'Emergency and safety equipment');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_by`, `updated_at`) VALUES
(1, 'expiry_alert_days', '30', 'Number of days before expiry to trigger alert', NULL, '2025-11-18 04:42:48'),
(2, 'low_stock_threshold', '10', 'Minimum quantity threshold for low stock alerts', NULL, '2025-11-18 04:42:48'),
(3, 'require_approval_for_out', 'true', 'Require approval for OUT transactions', NULL, '2025-11-18 04:42:48');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `contact_info` varchar(100) DEFAULT NULL,
  `role` enum('admin','staff') NOT NULL DEFAULT 'staff',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_inventory`
-- (See below for the actual view)
--
CREATE TABLE `v_current_inventory` (
`item_id` int(11)
,`item_code` varchar(50)
,`item_description` varchar(255)
,`type_name` varchar(50)
,`category_name` varchar(100)
,`total_quantity` decimal(32,0)
,`unit_value` decimal(10,2)
,`total_value` decimal(42,2)
,`nearest_expiry` date
,`batch_count` bigint(21)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_near_expiry_items`
-- (See below for the actual view)
--
CREATE TABLE `v_near_expiry_items` (
`item_id` int(11)
,`item_code` varchar(50)
,`item_description` varchar(255)
,`batch_id` int(11)
,`batch_number` varchar(100)
,`quantity` int(11)
,`expiry_date` date
,`days_until_expiry` int(7)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_transaction_history`
-- (See below for the actual view)
--
CREATE TABLE `v_transaction_history` (
`transaction_id` int(11)
,`transaction_date` datetime
,`transaction_type` enum('IN','OUT','ADJUSTMENT','TRANSFER')
,`item_code` varchar(50)
,`item_description` varchar(255)
,`quantity` int(11)
,`reference_number` varchar(100)
,`destination` varchar(255)
,`performed_by_name` varchar(101)
,`notes` text
);

-- --------------------------------------------------------

--
-- Structure for view `v_current_inventory`
--
DROP TABLE IF EXISTS `v_current_inventory`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_inventory`  AS SELECT `i`.`item_id` AS `item_id`, `i`.`item_code` AS `item_code`, `i`.`item_description` AS `item_description`, `it`.`type_name` AS `type_name`, `c`.`category_name` AS `category_name`, sum(`ib`.`quantity`) AS `total_quantity`, `i`.`unit_value` AS `unit_value`, sum(`ib`.`quantity` * `i`.`unit_value`) AS `total_value`, min(`ib`.`expiry_date`) AS `nearest_expiry`, count(distinct `ib`.`batch_id`) AS `batch_count` FROM (((`items` `i` left join `item_types` `it` on(`i`.`item_type_id` = `it`.`item_type_id`)) left join `categories` `c` on(`i`.`category_id` = `c`.`category_id`)) left join `inventory_batches` `ib` on(`i`.`item_id` = `ib`.`item_id` and `ib`.`status` = 'active')) WHERE `i`.`is_active` = 1 GROUP BY `i`.`item_id`, `i`.`item_code`, `i`.`item_description`, `it`.`type_name`, `c`.`category_name`, `i`.`unit_value` ;

-- --------------------------------------------------------

--
-- Structure for view `v_near_expiry_items`
--
DROP TABLE IF EXISTS `v_near_expiry_items`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_near_expiry_items`  AS SELECT `i`.`item_id` AS `item_id`, `i`.`item_code` AS `item_code`, `i`.`item_description` AS `item_description`, `ib`.`batch_id` AS `batch_id`, `ib`.`batch_number` AS `batch_number`, `ib`.`quantity` AS `quantity`, `ib`.`expiry_date` AS `expiry_date`, to_days(`ib`.`expiry_date`) - to_days(curdate()) AS `days_until_expiry` FROM (`items` `i` join `inventory_batches` `ib` on(`i`.`item_id` = `ib`.`item_id`)) WHERE `ib`.`status` = 'active' AND `ib`.`expiry_date` is not null AND to_days(`ib`.`expiry_date`) - to_days(curdate()) <= 30 AND to_days(`ib`.`expiry_date`) - to_days(curdate()) >= 0 ORDER BY to_days(`ib`.`expiry_date`) - to_days(curdate()) ASC ;

-- --------------------------------------------------------

--
-- Structure for view `v_transaction_history`
--
DROP TABLE IF EXISTS `v_transaction_history`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_transaction_history`  AS SELECT `t`.`transaction_id` AS `transaction_id`, `t`.`transaction_date` AS `transaction_date`, `t`.`transaction_type` AS `transaction_type`, `i`.`item_code` AS `item_code`, `i`.`item_description` AS `item_description`, `t`.`quantity` AS `quantity`, `t`.`reference_number` AS `reference_number`, `t`.`destination` AS `destination`, concat(`u`.`first_name`,' ',`u`.`last_name`) AS `performed_by_name`, `t`.`notes` AS `notes` FROM ((`inventory_transactions` `t` join `items` `i` on(`t`.`item_id` = `i`.`item_id`)) join `users` `u` on(`t`.`performed_by` = `u`.`user_id`)) ORDER BY `t`.`transaction_date` DESC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_table_record` (`table_name`,`record_id`),
  ADD KEY `idx_performed_by` (`performed_by`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD KEY `idx_parent` (`parent_category_id`);

--
-- Indexes for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  ADD PRIMARY KEY (`alert_id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `acknowledged_by` (`acknowledged_by`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_alert_date` (`alert_date`);

--
-- Indexes for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  ADD PRIMARY KEY (`batch_id`),
  ADD KEY `idx_item` (`item_id`),
  ADD KEY `idx_expiry` (`expiry_date`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  ADD PRIMARY KEY (`snapshot_id`),
  ADD UNIQUE KEY `unique_snapshot` (`item_id`,`batch_id`,`snapshot_date`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_snapshot_date` (`snapshot_date`),
  ADD KEY `idx_item` (`item_id`);

--
-- Indexes for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `idx_item` (`item_id`),
  ADD KEY `idx_transaction_date` (`transaction_date`),
  ADD KEY `idx_transaction_type` (`transaction_type`),
  ADD KEY `idx_performed_by` (`performed_by`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`item_id`),
  ADD UNIQUE KEY `item_code` (`item_code`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_item_type` (`item_type_id`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_active` (`is_active`);
ALTER TABLE `items` ADD FULLTEXT KEY `idx_description` (`item_description`);

--
-- Indexes for table `item_types`
--
ALTER TABLE `item_types`
  ADD PRIMARY KEY (`item_type_id`),
  ADD UNIQUE KEY `type_name` (`type_name`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  MODIFY `alert_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  MODIFY `batch_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  MODIFY `snapshot_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  MODIFY `transaction_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_types`
--
ALTER TABLE `item_types`
  MODIFY `item_type_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `setting_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`performed_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL;

--
-- Constraints for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  ADD CONSTRAINT `expiry_alerts_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `expiry_alerts_ibfk_2` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  ADD CONSTRAINT `inventory_batches_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  ADD CONSTRAINT `inventory_snapshots_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_snapshots_ibfk_2` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_snapshots_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `inventory_transactions_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_transactions_ibfk_2` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_transactions_ibfk_3` FOREIGN KEY (`performed_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `inventory_transactions_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`item_type_id`) REFERENCES `item_types` (`item_type_id`),
  ADD CONSTRAINT `items_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `items_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
