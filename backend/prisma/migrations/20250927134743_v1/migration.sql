-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `role` ENUM('Admin', 'Manager', 'Developer') NOT NULL DEFAULT 'Developer',
    `avatarUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sprint` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `week` INTEGER NOT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('Planned', 'Active', 'Completed') NOT NULL DEFAULT 'Planned',
    `description` VARCHAR(191) NULL,
    `goal` VARCHAR(191) NULL,
    `isCurrent` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sprint_week_idx`(`week`),
    INDEX `Sprint_status_idx`(`status`),
    INDEX `Sprint_isCurrent_idx`(`isCurrent`),
    INDEX `Sprint_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'PRODUCT_BLOCKED', 'ENGG_BLOCKED', 'DEV_TESTING', 'NOT_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('P0', 'P1', 'P2', 'BACKLOG') NOT NULL DEFAULT 'BACKLOG',
    `type` ENUM('Feature', 'Bug', 'Improvement', 'Task') NOT NULL DEFAULT 'Task',
    `storyPoints` INTEGER NOT NULL DEFAULT 0,
    `estimatedPoints` INTEGER NOT NULL DEFAULT 0,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `tags` JSON NULL,
    `metadata` JSON NULL,
    `sprintId` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `slackThreadTs` VARCHAR(50) NULL,
    `slackChannelId` VARCHAR(50) NULL,
    `createdFrom` ENUM('Web', 'Slack', 'API') NOT NULL DEFAULT 'Web',
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_status_idx`(`status`),
    INDEX `Task_priority_idx`(`priority`),
    INDEX `Task_type_idx`(`type`),
    INDEX `Task_sprintId_idx`(`sprintId`),
    INDEX `Task_parentTaskId_idx`(`parentTaskId`),
    INDEX `Task_createdAt_idx`(`createdAt`),
    INDEX `Task_dueDate_idx`(`dueDate`),
    INDEX `Task_orderIndex_idx`(`orderIndex`),
    INDEX `Task_slackThreadTs_idx`(`slackThreadTs`),
    INDEX `Task_slackChannelId_idx`(`slackChannelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskAssignment` (
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('Assignee', 'Reviewer', 'Watcher') NOT NULL DEFAULT 'Assignee',
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskAssignment_userId_idx`(`userId`),
    INDEX `TaskAssignment_role_idx`(`role`),
    PRIMARY KEY (`taskId`, `userId`, `role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` CHAR(36) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `content` VARCHAR(191) NOT NULL,
    `commentType` ENUM('Comment', 'Status_Change', 'Assignment', 'System') NOT NULL DEFAULT 'Comment',
    `metadata` JSON NULL,
    `parentCommentId` VARCHAR(191) NULL,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,
    `slackTs` VARCHAR(50) NULL,
    `slackChannelId` VARCHAR(50) NULL,
    `source` ENUM('Web', 'Slack', 'System') NOT NULL DEFAULT 'Web',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Comment_taskId_idx`(`taskId`),
    INDEX `Comment_userId_idx`(`userId`),
    INDEX `Comment_createdAt_idx`(`createdAt`),
    INDEX `Comment_commentType_idx`(`commentType`),
    INDEX `Comment_slackTs_idx`(`slackTs`),
    INDEX `Comment_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlackThread` (
    `id` CHAR(36) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(50) NOT NULL,
    `threadTs` VARCHAR(50) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `messageCount` INTEGER NOT NULL DEFAULT 0,

    INDEX `SlackThread_taskId_idx`(`taskId`),
    INDEX `SlackThread_channelId_idx`(`channelId`),
    INDEX `SlackThread_isActive_idx`(`isActive`),
    UNIQUE INDEX `SlackThread_channelId_threadTs_key`(`channelId`, `threadTs`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` CHAR(36) NOT NULL,
    `aggregateType` ENUM('Task', 'Comment', 'User', 'Sprint') NOT NULL,
    `aggregateId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(100) NOT NULL,
    `eventData` JSON NOT NULL,
    `source` ENUM('Web', 'Slack', 'System') NOT NULL,
    `userId` VARCHAR(191) NULL,
    `slackEventId` VARCHAR(100) NULL,
    `slackThreadTs` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Event_slackEventId_key`(`slackEventId`),
    INDEX `Event_aggregateType_aggregateId_idx`(`aggregateType`, `aggregateId`),
    INDEX `Event_createdAt_idx`(`createdAt`),
    INDEX `Event_source_idx`(`source`),
    INDEX `Event_processedAt_idx`(`processedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` CHAR(36) NOT NULL,
    `entityType` ENUM('Task', 'Sprint', 'User', 'Comment') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `source` ENUM('Web', 'Slack', 'System') NOT NULL,
    `slackThreadTs` VARCHAR(50) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ActivityLog_userId_idx`(`userId`),
    INDEX `ActivityLog_action_idx`(`action`),
    INDEX `ActivityLog_source_idx`(`source`),
    INDEX `ActivityLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sprint` ADD CONSTRAINT `Sprint_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_sprintId_fkey` FOREIGN KEY (`sprintId`) REFERENCES `Sprint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_parentTaskId_fkey` FOREIGN KEY (`parentTaskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignment` ADD CONSTRAINT `TaskAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentCommentId_fkey` FOREIGN KEY (`parentCommentId`) REFERENCES `Comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlackThread` ADD CONSTRAINT `SlackThread_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlackThread` ADD CONSTRAINT `SlackThread_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_aggregateId_fkey` FOREIGN KEY (`aggregateId`) REFERENCES `Task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `Task`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
