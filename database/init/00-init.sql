-- Kira MySQL bootstrap: create database and user with sufficient privileges
CREATE DATABASE IF NOT EXISTS `kira_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'kira_user'@'%' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON `kira_db`.* TO 'kira_user'@'%';

-- Allow Prisma shadow DB creation by granting create/drop on all dbs
GRANT CREATE, DROP ON *.* TO 'kira_user'@'%';
FLUSH PRIVILEGES;

