-- ============================================================================
-- User & Role Setup Script (MySQL 8+)
-- Database: inventory_database
-- Creates application users/roles and grants privileges
-- Replace strong passwords before running in production.
-- ============================================================================

-- Adjust host as needed (e.g., 'localhost', '%')
SET @app_host := 'localhost';
SET @admin_pwd := 'ChangeMe_Strong_Admin_Password!';
SET @writer_pwd := 'ChangeMe_Strong_Write_Password!';
SET @reader_pwd := 'ChangeMe_Strong_Read_Password!';

-- Roles
CREATE ROLE IF NOT EXISTS inv_admin;
CREATE ROLE IF NOT EXISTS inv_writer;
CREATE ROLE IF NOT EXISTS inv_reader;

-- Privileges per role
GRANT ALL PRIVILEGES ON inventory_database.* TO inv_admin;
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON inventory_database.* TO inv_writer;
GRANT SELECT ON inventory_database.* TO inv_reader;

-- Users
CREATE USER IF NOT EXISTS 'inv_admin'@@app_host IDENTIFIED BY @admin_pwd;
CREATE USER IF NOT EXISTS 'inv_writer'@@app_host IDENTIFIED BY @writer_pwd;
CREATE USER IF NOT EXISTS 'inv_reader'@@app_host IDENTIFIED BY @reader_pwd;

-- Attach roles to users
GRANT inv_admin TO 'inv_admin'@@app_host;
GRANT inv_writer TO 'inv_writer'@@app_host;
GRANT inv_reader TO 'inv_reader'@@app_host;

-- Set default roles
SET DEFAULT ROLE inv_admin FOR 'inv_admin'@@app_host;
SET DEFAULT ROLE inv_writer FOR 'inv_writer'@@app_host;
SET DEFAULT ROLE inv_reader FOR 'inv_reader'@@app_host;

-- Optional: Revoke all privileges (example reference)
-- REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'inv_writer'@@app_host;

-- Verification queries
-- SHOW GRANTS FOR 'inv_admin'@@app_host;
-- SHOW GRANTS FOR 'inv_writer'@@app_host;
-- SHOW GRANTS FOR 'inv_reader'@@app_host;

-- End of user/role setup
