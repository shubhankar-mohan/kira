-- Kira MySQL bootstrap: create database and user with sufficient privileges
CREATE DATABASE IF NOT EXISTS `kira_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'kira_user'@'%' IDENTIFIED WITH mysql_native_password BY 'change_me_secure_password';

-- Grant full privileges on kira_db (including ALTER for migrations)
GRANT ALL PRIVILEGES ON `kira_db`.* TO 'kira_user'@'%' WITH GRANT OPTION;

-- Allow Prisma shadow DB creation and migrations by granting necessary privileges on all dbs
GRANT CREATE, DROP, ALTER, CREATE TEMPORARY TABLES ON *.* TO 'kira_user'@'%';

FLUSH PRIVILEGES;

