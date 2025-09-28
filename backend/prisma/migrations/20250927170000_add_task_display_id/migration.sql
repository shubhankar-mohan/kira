-- DropIndex
DROP INDEX `Task_displayId_key` ON `Task`;

-- AlterTable
ALTER TABLE `Task` DROP COLUMN `displayId`;

-- DropTable
DROP TABLE `TaskSequence`;

-- CreateIndex
CREATE INDEX `Sprint_createdById_fkey` ON `Sprint`(`createdById` ASC);

-- CreateIndex
CREATE INDEX `Task_createdById_fkey` ON `Task`(`createdById` ASC);

-- CreateIndex
CREATE INDEX `Task_updatedById_fkey` ON `Task`(`updatedById` ASC);

-- CreateIndex
CREATE INDEX `TaskAssignment_assignedById_fkey` ON `TaskAssignment`(`assignedById` ASC);

-- CreateIndex
CREATE INDEX `Comment_parentCommentId_fkey` ON `Comment`(`parentCommentId` ASC);

-- CreateIndex
CREATE INDEX `SlackThread_createdById_fkey` ON `SlackThread`(`createdById` ASC);

-- CreateIndex
CREATE INDEX `Event_aggregateId_fkey` ON `Event`(`aggregateId` ASC);

-- CreateIndex
CREATE INDEX `Event_userId_fkey` ON `Event`(`userId` ASC);

-- CreateIndex
CREATE INDEX `ActivityLog_entityId_fkey` ON `ActivityLog`(`entityId` ASC);

