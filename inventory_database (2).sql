-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 12, 2026 at 04:10 AM
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
-- Database: `inventory_database`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `log_id` bigint(20) UNSIGNED NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `record_id` int(11) NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `performed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `parent_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `category_name`, `parent_category_id`, `description`, `created_at`) VALUES
(1, 'General Items', NULL, 'General inventory category', '2025-11-17 20:42:48'),
(2, 'Clothing', NULL, 'Clothing and apparel', '2025-11-17 20:42:48'),
(3, 'Kitchen Supplies', NULL, 'Mobile kitchen supplies', '2025-11-17 20:42:48'),
(4, 'Medical Supplies', NULL, 'Medical and healthcare items', '2025-11-17 20:42:48'),
(5, 'Emergency Equipment', NULL, 'Emergency and safety equipment', '2025-11-17 20:42:48'),
(6, 'Food Ingredients', NULL, 'Perishable and non-perishable food items', '2025-11-17 20:42:48');

-- --------------------------------------------------------

--
-- Table structure for table `expiry_alerts`
--

CREATE TABLE `expiry_alerts` (
  `alert_id` bigint(20) UNSIGNED NOT NULL,
  `batch_id` bigint(20) UNSIGNED NOT NULL,
  `alert_date` date NOT NULL,
  `days_until_expiry` int(11) DEFAULT NULL,
  `status` enum('pending','acknowledged','resolved') NOT NULL DEFAULT 'pending',
  `acknowledged_by` bigint(20) UNSIGNED DEFAULT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_batches`
--

CREATE TABLE `inventory_batches` (
  `batch_id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `expiry_date` date DEFAULT NULL,
  `manufactured_date` date DEFAULT NULL,
  `supplier_info` varchar(255) DEFAULT NULL,
  `batch_value` decimal(10,2) DEFAULT NULL,
  `status` enum('active','expired','depleted','quarantined') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_snapshots`
--

CREATE TABLE `inventory_snapshots` (
  `snapshot_id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `batch_id` bigint(20) UNSIGNED DEFAULT NULL,
  `snapshot_date` date NOT NULL,
  `quantity` int(11) NOT NULL,
  `total_value` decimal(12,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

CREATE TABLE `inventory_transactions` (
  `transaction_id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `batch_id` bigint(20) UNSIGNED DEFAULT NULL,
  `transaction_type` enum('IN','OUT','ADJUSTMENT','TRANSFER') NOT NULL,
  `quantity` int(11) NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `transaction_date` datetime NOT NULL DEFAULT current_timestamp(),
  `reason` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `destination` varchar(255) DEFAULT NULL,
  `performed_by` bigint(20) UNSIGNED NOT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `item_code` varchar(50) NOT NULL,
  `item_description` varchar(255) NOT NULL,
  `item_type_id` bigint(20) UNSIGNED NOT NULL,
  `category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `measurement_unit` varchar(50) DEFAULT NULL,
  `particular` text DEFAULT NULL,
  `mg_dosage` decimal(10,2) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `unit_value` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_types`
--

CREATE TABLE `item_types` (
  `item_type_id` bigint(20) UNSIGNED NOT NULL,
  `type_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `item_types`
--

INSERT INTO `item_types` (`item_type_id`, `type_name`, `description`, `created_at`, `updated_at`) VALUES
(1, 'general_item', 'General inventory items', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(2, 'nlcom_shirt', 'NLCOM branded shirts', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(3, 'perishable', 'Perishable ingredients for mobile kitchen', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(4, 'tool_utensil', 'Kitchen tools and utensils', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(5, 'consumable', 'Consumable supplies', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(6, 'medicine', 'Medical medicines', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(7, 'medical_item', 'Medical equipment and supplies', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(8, 'emergency_safety', 'Emergency and safety equipment', '2026-01-11 07:26:39', '2026-01-11 07:26:39');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_01_06_000001_create_item_types_table', 1),
(5, '2026_01_06_000002_create_categories_table', 1),
(6, '2026_01_06_000003_create_users_table_custom', 1),
(7, '2026_01_06_000004_create_items_table', 1),
(8, '2026_01_06_000005_create_inventory_batches_table', 1),
(9, '2026_01_06_000006_create_inventory_snapshots_table', 1),
(10, '2026_01_06_000007_create_inventory_transactions_table', 1),
(11, '2026_01_06_000008_create_expiry_alerts_table', 1),
(12, '2026_01_06_000009_create_audit_log_table', 1),
(13, '2026_01_06_000010_create_system_settings_table', 1),
(14, '2026_01_06_000011_create_rbac_tables', 1),
(15, '2026_01_07_000001_remove_role_column_from_users', 1),
(16, '2026_01_11_000001_add_crud_columns_to_role_permissions', 1);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `permission_name` varchar(100) NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `module` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`permission_id`, `permission_name`, `display_name`, `module`, `description`, `created_at`, `updated_at`) VALUES
(1, 'manage_users', 'Manage Users', 'system', 'Create, update, delete users', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(2, 'manage_roles', 'Manage Roles', 'system', 'Create and assign roles', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(3, 'manage_permissions', 'Manage Permissions', 'system', 'Create and assign permissions', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(4, 'view_reports', 'View Reports', 'reports', 'Access reporting features', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(5, 'manage_inventory', 'Manage Inventory', 'inventory', 'CRUD inventory items and stock', '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(6, 'manage_backups', 'Manage Backups', 'system', 'Manage database backups and restores', '2026-01-11 07:26:39', '2026-01-11 07:26:39');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_system_role` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `role_name`, `display_name`, `description`, `is_system_role`, `created_at`, `updated_at`) VALUES
(1, 'super_admin', 'Super Administrator', 'Full system access with all permissions', 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(2, 'admin', 'Administrator', 'Administrative access to manage users and inventory', 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(3, 'staff', 'Staff Member', 'Standard staff access for inventory operations', 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `can_create` tinyint(1) NOT NULL DEFAULT 0,
  `can_read` tinyint(1) NOT NULL DEFAULT 1,
  `can_update` tinyint(1) NOT NULL DEFAULT 0,
  `can_delete` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`, `can_create`, `can_read`, `can_update`, `can_delete`) VALUES
(1, 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(1, 2, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(1, 3, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(1, 4, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(1, 5, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(1, 6, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 1, 1, 1, 1),
(2, 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(2, 2, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(2, 3, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(2, 4, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(2, 5, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(2, 6, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 2, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 3, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 4, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 5, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0),
(3, 6, '2026-01-11 07:26:39', '2026-01-11 07:26:39', 0, 0, 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('iljXt8stEnDswp0JpYtpmxM0SOVDcm8kZmvGriGc', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiVDJwM0lYTlR5Q29aSlYyQVRsQ2h6bGg1N2NTbmJYRFJTSGtPYkN3OSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MzY6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMC9hcGkvcmJhYy9yb2xlcyI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1768185912),
('iPYghx5DFSd2bUB0q6x8hxa4IrORBBVvMejehdXj', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoieGxvSE5KVGxTd0FmdGpQN0NaeVZNSXNIeWxaZ2Z1WlllM1VwTEJvcCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MzM6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMC9hcGkvYXV0aC9tZSI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1768185907),
('jIWNyVCb0GvJMsUQkjwu1PjGcWMXaJlCHzAuDFcN', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoia25yenY1bkNKUXhIbDJLQXJpazFrTVdyUHRBOGVjMndMN3hKTTZsTSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6NDI6Imh0dHA6Ly8xMjcuMC4wLjE6ODAwMC9hcGkvcmJhYy9wZXJtaXNzaW9ucyI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1768185913),
('Ku0MEuSthysofr5D4LORaMbJf3dkWK2SUlTb5uq5', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', 'YToyOntzOjY6Il90b2tlbiI7czo0MDoiOWFQU2o4STB0RHJhNElzZ3V1cUhySU9IZ0xFSkYxQ3lmZ1o2NzQydCI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1768185909);

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_id` bigint(20) UNSIGNED NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_by`, `updated_at`) VALUES
(1, 'expiry_alert_days', '30', 'Number of days before expiry to trigger alert', NULL, '2025-11-17 20:42:48'),
(2, 'low_stock_threshold', '10', 'Minimum quantity threshold for low stock alerts', NULL, '2025-11-17 20:42:48'),
(3, 'require_approval_for_out', 'true', 'Require approval for OUT transactions', NULL, '2025-11-17 20:42:48');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `contact_info` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `contact_info`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'superadmin', 'superadmin@nlcom.org', '$2y$12$Lw8LrwUuYPBRiVp.0fY0yefC4S0xj3HN.jH444GRCoPVPRusjEYH.', 'Super', 'Admin', '555-0000', 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(2, 'admin', 'admin@nlcom.org', '$2y$12$hs3u2tb.Do5.WvyeoJHODuFA1gnP4DoVJP32B/fAt02I3jMwbWCe6', 'Admin', 'User', '555-0001', 1, '2026-01-11 07:26:39', '2026-01-11 07:26:39'),
(3, 'staff', 'staff@nlcom.org', '$2y$12$Q/q2oKNIgO.rYJ48I/WH4Oki6uCwfAsvz9CJHw7XCruQw7QWKuk6i', 'Staff', 'Member', '555-0002', 1, '2026-01-11 07:26:40', '2026-01-11 07:26:40');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`, `is_primary`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '2026-01-11 07:26:40', '2026-01-11 07:26:40'),
(2, 2, 1, '2026-01-11 07:26:40', '2026-01-11 07:26:40'),
(3, 3, 1, '2026-01-11 07:26:40', '2026-01-11 07:26:40');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `audit_log_table_name_record_id_index` (`table_name`,`record_id`),
  ADD KEY `audit_log_performed_by_index` (`performed_by`),
  ADD KEY `audit_log_created_at_index` (`created_at`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD KEY `categories_parent_category_id_index` (`parent_category_id`);

--
-- Indexes for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  ADD PRIMARY KEY (`alert_id`),
  ADD KEY `expiry_alerts_batch_id_index` (`batch_id`),
  ADD KEY `expiry_alerts_acknowledged_by_index` (`acknowledged_by`),
  ADD KEY `expiry_alerts_status_index` (`status`),
  ADD KEY `expiry_alerts_alert_date_index` (`alert_date`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  ADD PRIMARY KEY (`batch_id`),
  ADD KEY `inventory_batches_item_id_index` (`item_id`),
  ADD KEY `inventory_batches_expiry_date_index` (`expiry_date`),
  ADD KEY `inventory_batches_status_index` (`status`);

--
-- Indexes for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  ADD PRIMARY KEY (`snapshot_id`),
  ADD UNIQUE KEY `inventory_snapshots_item_id_batch_id_snapshot_date_unique` (`item_id`,`batch_id`,`snapshot_date`),
  ADD KEY `inventory_snapshots_created_by_foreign` (`created_by`),
  ADD KEY `inventory_snapshots_item_id_index` (`item_id`),
  ADD KEY `inventory_snapshots_batch_id_index` (`batch_id`),
  ADD KEY `inventory_snapshots_snapshot_date_index` (`snapshot_date`);

--
-- Indexes for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `inventory_transactions_item_id_index` (`item_id`),
  ADD KEY `inventory_transactions_batch_id_index` (`batch_id`),
  ADD KEY `inventory_transactions_transaction_date_index` (`transaction_date`),
  ADD KEY `inventory_transactions_transaction_type_index` (`transaction_type`),
  ADD KEY `inventory_transactions_performed_by_index` (`performed_by`),
  ADD KEY `inventory_transactions_approved_by_index` (`approved_by`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`item_id`),
  ADD UNIQUE KEY `items_item_code_unique` (`item_code`),
  ADD KEY `items_created_by_foreign` (`created_by`),
  ADD KEY `items_item_type_id_index` (`item_type_id`),
  ADD KEY `items_category_id_index` (`category_id`),
  ADD KEY `items_is_active_index` (`is_active`);
ALTER TABLE `items` ADD FULLTEXT KEY `items_item_description_fulltext` (`item_description`);

--
-- Indexes for table `item_types`
--
ALTER TABLE `item_types`
  ADD PRIMARY KEY (`item_type_id`),
  ADD UNIQUE KEY `item_types_type_name_unique` (`type_name`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`permission_id`),
  ADD UNIQUE KEY `permissions_permission_name_unique` (`permission_name`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `roles_role_name_unique` (`role_name`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `role_permissions_permission_id_foreign` (`permission_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `system_settings_setting_key_unique` (`setting_key`),
  ADD KEY `system_settings_updated_by_index` (`updated_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `users_username_unique` (`username`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `user_roles_role_id_foreign` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  MODIFY `alert_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  MODIFY `batch_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  MODIFY `snapshot_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  MODIFY `transaction_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `item_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_types`
--
ALTER TABLE `item_types`
  MODIFY `item_type_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `permission_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `setting_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD CONSTRAINT `audit_log_performed_by_foreign` FOREIGN KEY (`performed_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_parent_category_id_foreign` FOREIGN KEY (`parent_category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL;

--
-- Constraints for table `expiry_alerts`
--
ALTER TABLE `expiry_alerts`
  ADD CONSTRAINT `expiry_alerts_acknowledged_by_foreign` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `expiry_alerts_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_batches`
--
ALTER TABLE `inventory_batches`
  ADD CONSTRAINT `inventory_batches_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_snapshots`
--
ALTER TABLE `inventory_snapshots`
  ADD CONSTRAINT `inventory_snapshots_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_snapshots_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_snapshots_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `inventory_transactions_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `inventory_transactions_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_transactions_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_transactions_performed_by_foreign` FOREIGN KEY (`performed_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `items_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `items_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `items_item_type_id_foreign` FOREIGN KEY (`item_type_id`) REFERENCES `item_types` (`item_type_id`);

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `role_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE;

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_roles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
