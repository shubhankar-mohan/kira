const googleSheets = require('./googleSheets');
const prisma = require('../db/prisma');
const fs = require('fs').promises;
const path = require('path');

class MigrationService {
    constructor() {
        this.migrationLog = [];
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        this.migrationLog.push(logEntry);
        console.log(logEntry);
    }

    async exportFromSheets() {
        this.log('Starting export from Google Sheets...');

        try {
            const [users, sprints, tasks, comments] = await Promise.all([
                googleSheets.getUsers(),
                googleSheets.getSprints(),
                googleSheets.getTasks(),
                this.getAllCommentsFromSheets()
            ]);

            const exportData = {
                users,
                sprints,
                tasks,
                comments,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            const exportPath = path.join(__dirname, '../../migration-export.json');
            await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

            this.log(`Export completed. Found: ${users.length} users, ${sprints.length} sprints, ${tasks.length} tasks, ${comments.length} comments`);
            this.log(`Export saved to: ${exportPath}`);

            return exportData;
        } catch (error) {
            this.log(`Export failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async getAllCommentsFromSheets() {
        this.log('Exporting comments from Google Sheets...');
        const tasks = await googleSheets.getTasks();
        const allComments = [];

        for (const task of tasks) {
            try {
                const comments = await googleSheets.getComments(task.id);
                allComments.push(...comments);
            } catch (error) {
                this.log(`Failed to export comments for task ${task.id}: ${error.message}`, 'WARN');
            }
        }

        return allComments;
    }

    async validateExportData(data) {
        this.log('Validating export data...');

        const validation = {
            users: { count: data.users.length, valid: 0 },
            sprints: { count: data.sprints.length, valid: 0 },
            tasks: { count: data.tasks.length, valid: 0 },
            comments: { count: data.comments.length, valid: 0 }
        };

        // Validate users
        for (const user of data.users) {
            if (user.email && user.name) {
                validation.users.valid++;
            }
        }

        // Validate sprints
        for (const sprint of data.sprints) {
            if (sprint.name && sprint.week) {
                validation.sprints.valid++;
            }
        }

        // Validate tasks
        for (const task of data.tasks) {
            if (task.task && task.id) {
                validation.tasks.valid++;
            }
        }

        // Validate comments
        for (const comment of data.comments) {
            if (comment.taskId && comment.comment) {
                validation.comments.valid++;
            }
        }

        this.log(`Validation results: ${JSON.stringify(validation)}`);

        return validation;
    }

    async importToMySQL(data) {
        this.log('Starting import to MySQL...');

        try {
            // Clear existing data (optional - for fresh migration)
            if (process.env.CLEAR_EXISTING_DATA === 'true') {
                await this.clearExistingData();
            }

            // Import users first
            const userMap = await this.importUsers(data.users);

            // Import sprints
            const sprintMap = await this.importSprints(data.sprints, userMap);

            // Import tasks
            const taskMap = await this.importTasks(data.tasks, userMap, sprintMap);

            // Import comments
            await this.importComments(data.comments, userMap, taskMap);

            this.log('Import completed successfully');
            return { userMap, sprintMap, taskMap };
        } catch (error) {
            this.log(`Import failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async clearExistingData() {
        this.log('Clearing existing data...');

        await prisma.$transaction(async (tx) => {
            await tx.activityLog.deleteMany();
            await tx.event.deleteMany();
            await tx.slackThread.deleteMany();
            await tx.comment.deleteMany();
            await tx.taskAssignment.deleteMany();
            await tx.task.deleteMany();
            await tx.sprint.deleteMany();
            await tx.user.deleteMany();
        });

        this.log('Existing data cleared');
    }

    async importUsers(users) {
        this.log(`Importing ${users.length} users...`);
        const userMap = new Map();

        for (const user of users) {
            try {
                const created = await prisma.user.create({
                    data: {
                        email: user.email,
                        name: user.name,
                        role: this.mapRole(user.role),
                        isActive: user.active !== false,
                        createdAt: user.createdDate ? new Date(user.createdDate) : new Date()
                    }
                });

                userMap.set(user.id, created.id);
                userMap.set(user.email, created.id);

                this.log(`Imported user: ${user.email}`);
            } catch (error) {
                this.log(`Failed to import user ${user.email}: ${error.message}`, 'ERROR');
            }
        }

        return userMap;
    }

    async importSprints(sprints, userMap) {
        this.log(`Importing ${sprints.length} sprints...`);
        const sprintMap = new Map();

        for (const sprint of sprints) {
            try {
                const created = await prisma.sprint.create({
                    data: {
                        name: sprint.name,
                        week: sprint.week || 1,
                        goal: sprint.goal || '',
                        status: this.mapSprintStatus(sprint.status),
                        startDate: sprint.startDate ? new Date(sprint.startDate) : null,
                        endDate: sprint.endDate ? new Date(sprint.endDate) : null,
                        isCurrent: sprint.isCurrent === true,
                        createdById: userMap.get(sprint.createdBy) || null
                    }
                });

                sprintMap.set(sprint.id, created.id);

                this.log(`Imported sprint: ${sprint.name}`);
            } catch (error) {
                this.log(`Failed to import sprint ${sprint.name}: ${error.message}`, 'ERROR');
            }
        }

        return sprintMap;
    }

    async importTasks(tasks, userMap, sprintMap) {
        this.log(`Importing ${tasks.length} tasks...`);
        const taskMap = new Map();

        for (const task of tasks) {
            try {
                const created = await prisma.task.create({
                    data: {
                        title: task.task,
                        description: task.description || '',
                        status: this.mapTaskStatus(task.status),
                        priority: this.mapTaskPriority(task.priority),
                        type: this.mapTaskType(task.type),
                        storyPoints: task.sprintPoints || 0,
                        dueDate: task.dueDate ? new Date(task.dueDate) : null,
                        createdFrom: 'Web',
                        createdById: userMap.get(task.createdBy) || null,
                        updatedById: userMap.get(task.lastEditedBy) || null,
                        createdAt: task.createdTime ? new Date(task.createdTime) : new Date(),
                        updatedAt: task.lastEditedTime ? new Date(task.lastEditedTime) : new Date(),
                        sprintId: sprintMap.get(task.sprintWeek) || null,
                        slackThreadTs: task.slackThreadId || null,
                        slackChannelId: task.slackChannelId || null
                    }
                });

                taskMap.set(task.id, created.id);

                this.log(`Imported task: ${task.task}`);
            } catch (error) {
                this.log(`Failed to import task ${task.task}: ${error.message}`, 'ERROR');
            }
        }

        return taskMap;
    }

    async importComments(comments, userMap, taskMap) {
        this.log(`Importing ${comments.length} comments...`);

        for (const comment of comments) {
            try {
                await prisma.comment.create({
                    data: {
                        taskId: taskMap.get(comment.taskId),
                        userId: userMap.get(comment.user) || null,
                        content: comment.comment,
                        source: 'Web',
                        createdAt: comment.timestamp ? new Date(comment.timestamp) : new Date(),
                        slackTs: comment.slackMessageTs || null,
                        slackChannelId: comment.slackChannelId || null
                    }
                });

                this.log(`Imported comment for task ${comment.taskId}`);
            } catch (error) {
                this.log(`Failed to import comment for task ${comment.taskId}: ${error.message}`, 'ERROR');
            }
        }
    }

    mapRole(role) {
        const roleMap = {
            'Admin': 'Admin',
            'Manager': 'Manager',
            'Developer': 'Developer'
        };
        return roleMap[role] || 'Developer';
    }

    mapSprintStatus(status) {
        const statusMap = {
            'Active': 'Active',
            'Completed': 'Completed',
            'Planned': 'Planned'
        };
        return statusMap[status] || 'Planned';
    }

    mapTaskStatus(status) {
        const statusMap = {
            'PENDING': 'PENDING',
            'IN_PROGRESS': 'IN_PROGRESS',
            'DONE': 'DONE',
            'PRODUCT-BLOCKED': 'PRODUCT_BLOCKED',
            'ENGG-BLOCKED': 'ENGG_BLOCKED',
            'DEV-TESTING': 'DEV-TESTING',
            'NOT-REQUIRED': 'NOT-REQUIRED',
            'TODO': 'PENDING',
            'BLOCKED': 'PRODUCT_BLOCKED'
        };
        return statusMap[status] || 'PENDING';
    }

    mapTaskPriority(priority) {
        const priorityMap = {
            'P0': 'P0',
            'P1': 'P1',
            'P2': 'P2',
            'Backlog': 'BACKLOG',
            'BACKLOG': 'BACKLOG'
        };
        return priorityMap[priority] || 'BACKLOG';
    }

    mapTaskType(type) {
        const typeMap = {
            'Feature': 'Feature',
            'Bug': 'Bug',
            'Improvement': 'Improvement',
            'Task': 'Task',
            'TASK': 'Task'
        };
        return typeMap[type] || 'Task';
    }

    async generateReport() {
        this.log('Generating migration report...');

        const reportPath = path.join(__dirname, '../../migration-report.json');

        const report = {
            timestamp: new Date().toISOString(),
            logs: this.migrationLog,
            summary: {
                totalUsers: await prisma.user.count(),
                totalSprints: await prisma.sprint.count(),
                totalTasks: await prisma.task.count(),
                totalComments: await prisma.comment.count(),
                totalAssignments: await prisma.taskAssignment.count()
            }
        };

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        this.log(`Migration report saved to: ${reportPath}`);
        return report;
    }
}

module.exports = MigrationService;
