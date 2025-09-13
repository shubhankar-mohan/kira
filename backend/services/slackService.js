const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const cron = require('node-cron');
const googleSheetsService = require('./googleSheets');
const ScrumMasterFeatures = require('./scrumMasterFeatures');

class SlackService {
    constructor() {
        this.app = null;
        this.client = null;
        this.isInitialized = false;
        this.threadToTaskMap = new Map(); // Maps Slack thread_ts to task IDs
        this.threadTimestamps = new Map(); // Track creation timestamps for cleanup
        this.userEmailMap = new Map(); // Maps Slack user IDs to email addresses
        this.scheduledJobs = [];
        this.scrumMaster = null; // Will be initialized after client is ready
        this.cleanupInterval = null;
        
        this.initialize();
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Initialize Slack App with Bot Token
            this.app = new App({
                token: process.env.SLACK_BOT_TOKEN,
                signingSecret: process.env.SLACK_SIGNING_SECRET,
                socketMode: false,
                port: process.env.SLACK_PORT || 3001
            });

            // Initialize Web API client
            this.client = new WebClient(process.env.SLACK_BOT_TOKEN);

            // Initialize scrum master features
            this.scrumMaster = new ScrumMasterFeatures(this.client);

            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize user mapping
            await this.initializeUserMapping();
            
            // Setup scheduled jobs
            this.setupScheduledJobs();

            // Setup memory cleanup - run every hour
            this.cleanupInterval = setInterval(() => this.cleanupOldThreads(), 60 * 60 * 1000);

            this.isInitialized = true;
            console.log('✅ Slack service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Slack service:', error.message);
        }
    }

    async setupEventListeners() {
        // Listen for app mentions (@kira)
        this.app.event('app_mention', async ({ event, client }) => {
            await this.handleAppMention(event, client);
        });

        // Listen for messages in threads (for comments)
        this.app.event('message', async ({ event, client }) => {
            if (event.thread_ts) {
                await this.handleThreadMessage(event, client);
            }
        });

        // Listen for emoji reactions
        this.app.event('reaction_added', async ({ event, client }) => {
            await this.handleReactionAdded(event, client);
        });

        // Setup slash commands
        this.app.command('/kira', async ({ command, ack, respond, client }) => {
            await ack();
            await this.handleSlashCommand(command, respond, client);
        });

        // Interactive components (buttons, modals)
        this.app.action('task_complete', async ({ ack, body, client }) => {
            await ack();
            await this.handleTaskComplete(body, client);
        });

        this.app.action('task_assign', async ({ ack, body, client }) => {
            await ack();
            await this.handleTaskAssign(body, client);
        });
    }

    async handleReactionAdded(event, client) {
        try {
            // Optional: react to ✅ on task thread to mark done
            if (!event || !event.item || !event.item.ts) return;
            const threadTs = event.item.ts;
            const reaction = event.reaction;

            // Only consider when reaction is in a thread we know or can resolve
            let taskId = this.threadToTaskMap.get(threadTs);
            if (!taskId) {
                const tasks = await googleSheetsService.getTasks();
                const linked = tasks.find(t => String(t.slackThreadId) === String(threadTs));
                if (linked) {
                    taskId = linked.id;
                    this.threadToTaskMap.set(threadTs, taskId);
                    this.threadTimestamps.set(threadTs, Date.now());
                }
            }
            if (!taskId) return;

            // Example behavior: if ✅ added, mark task done
            if (reaction === 'white_check_mark' || reaction === 'heavy_check_mark') {
                const user = await this.getUserBySlackId(event.user);
                await googleSheetsService.updateTask(taskId, {
                    status: 'DONE',
                    lastEditedBy: user ? user.name : 'Slack User'
                });
                await client.chat.postMessage({
                    channel: event.item.channel,
                    thread_ts: threadTs,
                    text: `✅ Marked task ${taskId} as DONE`
                });
            }
        } catch (error) {
            console.error('Error in handleReactionAdded:', error);
        }
    }

    async handleAppMention(event, client) {
        try {
            const text = event.text.toLowerCase();
            const userId = event.user;
            const channel = event.channel;
            const ts = event.ts;

            // Enhanced duplicate prevention - check both thread_ts and message content
            const messageKey = `${ts}-${text}`;
            if (this.threadToTaskMap.has(ts) || this.threadToTaskMap.has(messageKey)) {
                console.log(`Skipping duplicate task creation for thread ${ts}`);
                return;
            }

            // Extract task creation info from mention
            const taskInfo = this.parseTaskFromMention(event.text);
            
            if (taskInfo) {
                // Create task in Google Sheets
                const user = await this.getUserBySlackId(userId);
                const task = await this.createTaskFromSlack(taskInfo, user, ts, channel);
                
                // Map thread to task for future comments (prevent duplicates)
                const now = Date.now();
                this.threadToTaskMap.set(ts, task.id);
                this.threadToTaskMap.set(messageKey, task.id);
                this.threadTimestamps.set(ts, now);
                this.threadTimestamps.set(messageKey, now);
                
                // Send confirmation message with task URL
                await client.chat.postMessage({
                    channel: channel,
                    thread_ts: ts,
                    blocks: this.buildTaskCreatedBlocks(task)
                });

                // Send notifications to assigned users
                if (taskInfo.assignedUsers.length > 0) {
                    await this.notifyAssignedUsers(taskInfo.assignedUsers, task, client);
                }

            } else {
                // Handle help or other commands
                await this.sendHelpMessage(channel, client);
            }

        } catch (error) {
            console.error('Error handling app mention:', error);
            await client.chat.postMessage({
                channel: event.channel,
                thread_ts: event.ts,
                text: '❌ Sorry, I encountered an error processing your request. Please try again.'
            });
        }
    }

    parseTaskFromMention(text) {
        // Input validation
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text input for parseTaskFromMention:', text);
            return null;
        }

        // Remove the bot mention from the beginning only
        const botMentionPattern = /<@[^>]+>/;
        const firstMentionMatch = text.match(botMentionPattern);
        if (!firstMentionMatch) return null; // No bot mention found
        
        let cleanText = text.replace(firstMentionMatch[0], '').trim();
        
        // Sanitize input to prevent potential issues
        cleanText = cleanText.replace(/[<>]/g, ''); // Remove angle brackets
        cleanText = cleanText.substring(0, 500); // Limit length to prevent abuse
        
        // If the cleaned text is empty or too short, return null
        if (!cleanText || cleanText.length < 3) return null;
        
        // Extract priority (P0, P1, P2)
        const priorityMatch = cleanText.match(/\b(P[0-2])\b/i);
        const priority = priorityMatch ? priorityMatch[1].toUpperCase() : 'P2';
        
        // Extract assigned users (excluding the bot mention)
        const userMentions = text.match(/<@[UW][A-Z0-9]+>/g) || [];
        const assignedUsers = userMentions.slice(1); // Skip the first mention (bot)
        
        // Extract task type
        const typeMatch = cleanText.match(/\b(bug|feature|improvement)\b/i);
        const type = typeMatch ? this.capitalizeFirst(typeMatch[1]) : 'Feature';
        
        // Extract due date
        const dueDateMatch = cleanText.match(/due\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
        const dueDate = dueDateMatch ? dueDateMatch[1] : '';
        
        // Extract sprint points
        const pointsMatch = cleanText.match(/(\d+)\s*points?/i);
        const sprintPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
        
        // Clean task title (remove extracted elements)
        let title = cleanText
            .replace(/\b(P[0-2])\b/gi, '')
            .replace(/\b(bug|feature|improvement)\b/gi, '')
            .replace(/due\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi, '')
            .replace(/(\d+)\s*points?/gi, '')
            .replace(/<@[UW][A-Z0-9]+>/g, '')
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .trim();

        // Ensure we have a meaningful title
        if (!title || title.length < 3) return null;

        return {
            title,
            priority,
            type,
            assignedUsers,
            dueDate,
            sprintPoints,
            description: title // Use title as description for now
        };
    }

    async createTaskFromSlack(taskInfo, createdBy, threadTs, channelId) {
        // Get current active sprint
        const sprints = await googleSheetsService.getSprints();
        const activeSprint = sprints.find(s => s.status === 'Active') || sprints[0];
        
        // Convert Slack user IDs to emails
        const assignedEmails = [];
        for (const slackUserId of taskInfo.assignedUsers) {
            const email = await this.getEmailBySlackId(slackUserId);
            if (email) assignedEmails.push(email);
        }

        const taskData = {
            task: taskInfo.title,
            description: taskInfo.description,
            status: 'TODO',
            priority: taskInfo.priority,
            type: taskInfo.type,
            assignedTo: assignedEmails.join(', '),
            sprintPoints: taskInfo.sprintPoints,
            dueDate: taskInfo.dueDate,
            sprintWeek: activeSprint ? activeSprint.name : '',
            createdBy: createdBy ? createdBy.name : 'Slack User',
            message: `Created from Slack thread: ${threadTs}`,
            slackThreadId: threadTs,
            slackChannelId: channelId
        };

        const task = await googleSheetsService.createTask(taskData);
        
        // Add initial comment with Slack context
        await googleSheetsService.addComment({
            taskId: task.id,
            user: createdBy ? createdBy.name : 'Slack User',
            comment: `Task created from Slack mention in thread ${threadTs}`
        });

        return task;
    }

    async handleThreadMessage(event, client) {
        try {
            // Ignore bot/self messages to prevent loops
            if (event.bot_id || event.subtype === 'bot_message') {
                return;
            }

            const mappedTaskId = this.threadToTaskMap.get(event.thread_ts);
            let resolvedTaskId = mappedTaskId;

            // Fallback: lookup task by slackThreadId in Sheets if not in memory
            if (!resolvedTaskId) {
                try {
                    const tasks = await googleSheetsService.getTasks();
                    const linkedTask = tasks.find(t => String(t.slackThreadId) === String(event.thread_ts));
                    if (linkedTask) {
                        resolvedTaskId = linkedTask.id;
                        this.threadToTaskMap.set(event.thread_ts, linkedTask.id);
                        this.threadTimestamps.set(event.thread_ts, Date.now());
                    }
                } catch (e) {
                    console.error('Fallback lookup failed:', e);
                }
            }
            if (!resolvedTaskId) return;

            const user = await this.getUserBySlackId(event.user);
            const userName = user ? user.name : 'Slack User';

            // Add comment to task with Slack metadata
            await googleSheetsService.addComment({
                taskId: resolvedTaskId,
                user: userName,
                comment: event.text,
                source: 'slack',
                slackMessageTs: event.ts,
                slackChannelId: event.channel
            });
            // Log activity from Slack
            try {
                await googleSheetsService.addActivity({
                    taskId: resolvedTaskId,
                    user: userName,
                    action: 'commented',
                    details: event.text,
                    source: 'slack'
                });
            } catch (e) { console.error('Failed to log activity (slack comment):', e.message); }

            // React to confirm comment was recorded
            await client.reactions.add({
                channel: event.channel,
                timestamp: event.ts,
                name: 'white_check_mark'
            });

        } catch (error) {
            console.error('Error handling thread message:', error);
        }
    }

    // Post a task created message and return { channel, thread_ts }
    async postTaskCreatedThread(task) {
        try {
            const channel = process.env.SLACK_TASKS_CHANNEL || process.env.SLACK_NOTIFICATIONS_CHANNEL || '#eng-sprint';
            const result = await this.client.chat.postMessage({
                channel: channel,
                text: `Task created: ${task.task}`,
                blocks: this.buildTaskCreatedBlocks(task)
            });

            if (result && result.ts) {
                this.threadToTaskMap.set(result.ts, task.id);
                this.threadTimestamps.set(result.ts, Date.now());
            }

            return { channel: result.channel, thread_ts: result.ts };
        } catch (error) {
            console.error('Error posting task created thread:', error);
            throw error;
        }
    }

    // Post a comment to an existing Slack thread, return message ts
    async postCommentToThread(channelId, threadTs, text) {
        try {
            const result = await this.client.chat.postMessage({
                channel: channelId,
                thread_ts: threadTs,
                text,
                mrkdwn: true
            });
            return result.ts;
        } catch (error) {
            console.error('Error posting comment to Slack thread:', error);
            throw error;
        }
    }

    async handleSlashCommand(command, respond, client) {
        const args = command.text.split(' ');
        const action = args[0]?.toLowerCase();

        switch (action) {
            case 'create':
                await this.handleCreateCommand(args.slice(1), respond, command.user_id);
                break;
            case 'close':
                await this.handleCloseCommand(args.slice(1), respond, command.user_id);
                break;
            case 'assign':
                await this.handleAssignCommand(args.slice(1), respond, command.user_id);
                break;
            case 'status':
                await this.handleStatusCommand(args.slice(1), respond);
                break;
            case 'sprint':
                await this.handleSprintCommand(args.slice(1), respond);
                break;
            case 'burndown':
                await this.handleBurndownCommand(args.slice(1), respond);
                break;
            case 'workload':
                await this.handleWorkloadCommand(args.slice(1), respond);
                break;
            case 'reviews':
                await this.handleReviewsCommand(args.slice(1), respond);
                break;
            case 'retrospective':
                await this.handleRetrospectiveCommand(args.slice(1), respond);
                break;
            case 'release':
                await this.handleReleaseCommand(args.slice(1), respond);
                break;
            case 'help':
            default:
                await this.sendSlashCommandHelp(respond);
                break;
        }
    }

    async handleCreateCommand(args, respond, userId) {
        const title = args.join(' ');
        if (!title) {
            return respond({
                text: '❌ Please provide a task title. Usage: `/kira create Task title here`',
                response_type: 'ephemeral'
            });
        }

        try {
            const user = await this.getUserBySlackId(userId);
            const task = await googleSheetsService.createTask({
                task: title,
                status: 'TODO',
                priority: 'P2',
                type: 'Feature',
                createdBy: user ? user.name : 'Slack User'
            });

            respond({
                text: `✅ Task created: *${task.task}* (ID: ${task.id})`,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Failed to create task. Please try again.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleCloseCommand(args, respond, userId) {
        const taskId = args[0];
        if (!taskId) {
            return respond({
                text: '❌ Please provide a task ID. Usage: `/kira close TASK_ID`',
                response_type: 'ephemeral'
            });
        }

        try {
            const user = await this.getUserBySlackId(userId);
            await googleSheetsService.updateTask(taskId, {
                status: 'DONE',
                lastEditedBy: user ? user.name : 'Slack User'
            });

            respond({
                text: `✅ Task ${taskId} marked as completed!`,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: `❌ Failed to close task ${taskId}. Please check the task ID.`,
                response_type: 'ephemeral'
            });
        }
    }

    async handleAssignCommand(args, respond, userId) {
        const taskId = args[0];
        const userMention = args[1];
        
        if (!taskId || !userMention) {
            return respond({
                text: '❌ Please provide a task ID and user. Usage: `/kira assign TASK_ID @user`',
                response_type: 'ephemeral'
            });
        }

        try {
            // Extract user ID from mention
            const userIdMatch = userMention.match(/<@([UW][A-Z0-9]+)>/);
            const targetUserId = userIdMatch ? userIdMatch[1] : null;
            
            if (!targetUserId) {
                return respond({
                    text: '❌ Please mention a valid user. Usage: `/kira assign TASK_ID @user`',
                    response_type: 'ephemeral'
                });
            }
            
            const targetUser = await this.getUserBySlackId(targetUserId);
            if (!targetUser) {
                return respond({
                    text: '❌ User not found in Kira system.',
                    response_type: 'ephemeral'
                });
            }
            
            const currentUser = await this.getUserBySlackId(userId);
            await googleSheetsService.updateTask(taskId, {
                assignedTo: targetUser.email,
                lastEditedBy: currentUser ? currentUser.name : 'Slack User'
            });

            respond({
                text: `✅ Task ${taskId} assigned to ${targetUser.name}!`,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: `❌ Failed to assign task ${taskId}. Please check the task ID.`,
                response_type: 'ephemeral'
            });
        }
    }

    async handleStatusCommand(args, respond) {
        try {
            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            
            const activeSprint = sprints.find(s => s.status === 'Active');
            if (!activeSprint) {
                return respond({
                    text: '❌ No active sprint found.',
                    response_type: 'ephemeral'
                });
            }

            const sprintTasks = tasks.filter(t => t.sprintWeek === activeSprint.name);
            const stats = this.calculateSprintStats(sprintTasks);
            
            const statusText = `📊 *Sprint Status - ${activeSprint.name}*\n\n` +
                `• *Total Tasks:* ${stats.total}\n` +
                `• *Completed:* ${stats.completed} (${Math.round(stats.completed/stats.total*100)}%)\n` +
                `• *In Progress:* ${stats.inProgress}\n` +
                `• *Not Started:* ${stats.todo}\n` +
                `• *Blocked:* ${stats.blocked}`;

            respond({
                text: statusText,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Error retrieving sprint status.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleSprintCommand(args, respond) {
        try {
            const sprints = await googleSheetsService.getSprints();
            
            if (sprints.length === 0) {
                return respond({
                    text: '❌ No sprints found.',
                    response_type: 'ephemeral'
                });
            }

            const activeSprints = sprints.filter(s => s.status === 'Active');
            const upcomingSprints = sprints.filter(s => s.status === 'Planned').slice(0, 3);
            
            let sprintText = `🏃 *Sprint Information*\n\n`;
            
            if (activeSprints.length > 0) {
                sprintText += `*Active Sprints:*\n`;
                activeSprints.forEach(sprint => {
                    sprintText += `• ${sprint.name} (${sprint.startDate} - ${sprint.endDate})\n`;
                });
                sprintText += `\n`;
            }
            
            if (upcomingSprints.length > 0) {
                sprintText += `*Upcoming Sprints:*\n`;
                upcomingSprints.forEach(sprint => {
                    sprintText += `• ${sprint.name} (${sprint.startDate} - ${sprint.endDate})\n`;
                });
            }

            respond({
                text: sprintText,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Error retrieving sprint information.',
                response_type: 'ephemeral'
            });
        }
    }

    // Advanced scrum master command handlers
    async handleBurndownCommand(args, respond) {
        try {
            const sprintName = args.join(' ') || await this.getActiveSprintName();
            if (!sprintName) {
                return respond({
                    text: '❌ Please specify a sprint name or ensure there is an active sprint.',
                    response_type: 'ephemeral'
                });
            }

            const analysis = await this.scrumMaster.generateBurndownAnalysis(sprintName);
            if (!analysis) {
                return respond({
                    text: `❌ Could not generate burndown analysis for sprint: ${sprintName}`,
                    response_type: 'ephemeral'
                });
            }

            const burndownText = `📊 *Burndown Analysis - ${sprintName}*\n\n` +
                `• *Progress:* ${Math.round(analysis.completionPercentage)}% completed\n` +
                `• *Time Elapsed:* ${Math.round(analysis.timeElapsedPercentage)}%\n` +
                `• *Points:* ${analysis.completedPoints}/${analysis.totalPoints}\n` +
                `• *Velocity Trend:* ${analysis.velocityTrend >= 1 ? '📈' : '📉'} ${Math.round(analysis.velocityTrend * 100)}%\n` +
                `• *On Track:* ${analysis.isOnTrack ? '✅' : '⚠️'}\n` +
                `• *Projected Completion:* ${Math.round(analysis.projectedCompletion)} days`;

            respond({
                text: burndownText,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Error generating burndown analysis.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleWorkloadCommand(args, respond) {
        try {
            const analysis = await this.scrumMaster.analyzeTeamWorkload();
            if (!analysis) {
                return respond({
                    text: '❌ Could not analyze team workload.',
                    response_type: 'ephemeral'
                });
            }

            const topUsers = analysis.users
                .sort((a, b) => b.workloadScore - a.workloadScore)
                .slice(0, 5);

            let workloadText = `👥 *Team Workload Analysis*\n\n`;
            topUsers.forEach(user => {
                workloadText += `• *${user.name}:* ${user.totalTasks} tasks, ${Math.round(user.totalPoints)} points (${Math.round(user.efficiency * 100)}% complete)\n`;
            });

            if (analysis.recommendations.length > 0) {
                workloadText += `\n*Recommendations:*\n`;
                analysis.recommendations.forEach(rec => {
                    workloadText += `• ${rec.message}\n`;
                });
            }

            respond({
                text: workloadText,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Error analyzing team workload.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleReviewsCommand(args, respond) {
        try {
            const reminderCount = await this.scrumMaster.generateCodeReviewReminders();
            
            if (reminderCount === null) {
                respond({
                    text: '❌ Error generating code review reminders.',
                    response_type: 'ephemeral'
                });
            } else if (reminderCount === 0) {
                respond({
                    text: '✅ No tasks waiting for code review!',
                    response_type: 'ephemeral'
                });
            } else {
                respond({
                    text: `📝 Code review reminders sent for ${reminderCount} tasks.`,
                    response_type: 'ephemeral'
                });
            }

        } catch (error) {
            respond({
                text: '❌ Error handling review reminders.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleRetrospectiveCommand(args, respond) {
        try {
            const sprintName = args.join(' ') || await this.getActiveSprintName();
            if (!sprintName) {
                return respond({
                    text: '❌ Please specify a sprint name.',
                    response_type: 'ephemeral'
                });
            }

            const retroData = await this.scrumMaster.generateRetrospectiveData(sprintName);
            if (!retroData) {
                return respond({
                    text: `❌ Could not generate retrospective data for: ${sprintName}`,
                    response_type: 'ephemeral'
                });
            }

            const retroText = `🔄 *Retrospective - ${sprintName}*\n\n` +
                `• *Completion Rate:* ${Math.round((retroData.metrics.completedTasks / retroData.metrics.totalTasks) * 100)}%\n` +
                `• *Points Delivered:* ${retroData.metrics.completedPoints}/${retroData.metrics.totalPoints}\n` +
                `• *Blocked Tasks:* ${retroData.metrics.blockedTasks}\n` +
                `• *Spillover Tasks:* ${retroData.metrics.spilloverTasks}\n\n` +
                `*Key Recommendations:*\n` +
                retroData.recommendations.slice(0, 3).map(r => `• ${r.suggestion}`).join('\n');

            respond({
                text: retroText,
                response_type: 'in_channel'
            });

        } catch (error) {
            respond({
                text: '❌ Error generating retrospective data.',
                response_type: 'ephemeral'
            });
        }
    }

    async handleReleaseCommand(args, respond) {
        try {
            const version = args[0] || 'Next Release';
            const targetDate = args[1] || 'TBD';

            const featureCount = await this.scrumMaster.generateReleasePlan(version, targetDate);
            
            if (featureCount === null) {
                respond({
                    text: '❌ Error generating release plan.',
                    response_type: 'ephemeral'
                });
            } else {
                respond({
                    text: `🚀 Release plan generated for ${version} with ${featureCount} features.`,
                    response_type: 'ephemeral'
                });
            }

        } catch (error) {
            respond({
                text: '❌ Error handling release planning.',
                response_type: 'ephemeral'
            });
        }
    }

    async getActiveSprintName() {
        try {
            const sprints = await googleSheetsService.getSprints();
            const activeSprint = sprints.find(s => s.status === 'Active');
            return activeSprint ? activeSprint.name : null;
        } catch (error) {
            console.error('Error getting active sprint:', error);
            return null;
        }
    }

    async generateDailyStandupReport() {
        try {
            const tasks = await googleSheetsService.getTasks();
            const users = await googleSheetsService.getUsers();
            const sprints = await googleSheetsService.getSprints();
            
            const activeSprint = sprints.find(s => s.status === 'Active');
            if (!activeSprint) return;

            const sprintTasks = tasks.filter(t => t.sprintWeek === activeSprint.name);
            const stats = this.calculateSprintStats(sprintTasks);
            
            const report = this.buildStandupReport(activeSprint, stats, sprintTasks);
            
            // Send to configured standup channel
            const channel = process.env.SLACK_STANDUP_CHANNEL || '#standup';
            await this.client.chat.postMessage({
                channel: channel,
                blocks: report
            });

        } catch (error) {
            console.error('Error generating daily standup report:', error);
        }
    }

    async generateSprintHealthAlert() {
        try {
            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            
            const activeSprint = sprints.find(s => s.status === 'Active');
            if (!activeSprint) return;

            const sprintTasks = tasks.filter(t => t.sprintWeek === activeSprint.name);
            const health = this.analyzeSprintHealth(sprintTasks, activeSprint);
            
            if (health.alertLevel > 0) {
                const alert = this.buildHealthAlert(activeSprint, health);
                
                const channel = process.env.SLACK_ALERTS_CHANNEL || '#alerts';
                await this.client.chat.postMessage({
                    channel: channel,
                    blocks: alert
                });
            }

        } catch (error) {
            console.error('Error generating sprint health alert:', error);
        }
    }

    analyzeSprintHealth(tasks, sprint) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'DONE').length;
        const blockedTasks = tasks.filter(t => t.status === 'BLOCKED').length;
        const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
        const blockedRate = totalTasks > 0 ? (blockedTasks / totalTasks) : 0;
        
        // Calculate expected completion based on time elapsed
        const now = new Date();
        const startDate = new Date(sprint.startDate);
        const endDate = new Date(sprint.endDate);
        const totalDuration = endDate - startDate;
        const elapsed = now - startDate;
        const expectedCompletion = totalDuration > 0 ? (elapsed / totalDuration) : 0;
        
        let alertLevel = 0;
        let issues = [];
        
        // Check for issues
        if (completionRate < expectedCompletion - 0.2) {
            alertLevel = 2;
            issues.push('Sprint is significantly behind schedule');
        } else if (completionRate < expectedCompletion - 0.1) {
            alertLevel = 1;
            issues.push('Sprint is slightly behind schedule');
        }
        
        if (blockedRate > 0.2) {
            alertLevel = Math.max(alertLevel, 2);
            issues.push('High number of blocked tasks');
        } else if (blockedRate > 0.1) {
            alertLevel = Math.max(alertLevel, 1);
            issues.push('Some tasks are blocked');
        }
        
        return {
            alertLevel,
            issues,
            completionRate,
            blockedRate,
            expectedCompletion,
            totalTasks,
            completedTasks,
            blockedTasks,
            inProgressTasks
        };
    }

    setupScheduledJobs() {
        // Daily standup at 9 AM
        const standupJob = cron.schedule('0 9 * * 1-5', () => {
            this.generateDailyStandupReport();
        }, { scheduled: false });

        // Sprint health check twice daily
        const healthJob = cron.schedule('0 10,16 * * 1-5', () => {
            this.generateSprintHealthAlert();
        }, { scheduled: false });

        // Weekly sprint summary on Fridays at 5 PM
        const summaryJob = cron.schedule('0 17 * * 5', () => {
            this.scrumMaster.generateWeeklySprintSummary();
        }, { scheduled: false });

        // Code review reminders on Tuesday and Thursday at 2 PM
        const reviewJob = cron.schedule('0 14 * * 2,4', () => {
            this.scrumMaster.generateCodeReviewReminders();
        }, { scheduled: false });

        this.scheduledJobs = [standupJob, healthJob, summaryJob, reviewJob];

        // Start jobs if enabled
        if (process.env.SLACK_ENABLE_SCHEDULED_REPORTS === 'true') {
            this.scheduledJobs.forEach(job => job.start());
            console.log('✅ Scheduled Slack jobs started');
        }
    }

    async initializeUserMapping() {
        try {
            const users = await googleSheetsService.getUsers();
            
            // Get Slack workspace members
            const slackUsers = await this.client.users.list();
            
            // Map by email
            for (const slackUser of slackUsers.members) {
                if (slackUser.profile && slackUser.profile.email) {
                    const email = slackUser.profile.email.toLowerCase();
                    const kiraUser = users.find(u => u.email.toLowerCase() === email);
                    
                    if (kiraUser) {
                        this.userEmailMap.set(slackUser.id, {
                            email: kiraUser.email,
                            name: kiraUser.name,
                            role: kiraUser.role
                        });
                    }
                }
            }
            
            console.log(`✅ Mapped ${this.userEmailMap.size} Slack users to Kira accounts`);
            
        } catch (error) {
            console.error('Error initializing user mapping:', error);
        }
    }

    async getUserBySlackId(slackUserId) {
        return this.userEmailMap.get(slackUserId);
    }

    async getEmailBySlackId(slackUserId) {
        const user = this.userEmailMap.get(slackUserId);
        return user ? user.email : null;
    }

    buildTaskCreatedBlocks(task) {
        const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/task/${task.id}`;
        
        return [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `✅ *Task Created Successfully*\n*${task.task}*`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*ID:* ${task.id}` },
                    { type: 'mrkdwn', text: `*Priority:* ${task.priority}` },
                    { type: 'mrkdwn', text: `*Type:* ${task.type}` },
                    { type: 'mrkdwn', text: `*Assigned:* ${task.assignedTo || 'Unassigned'}` }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🔗 <${taskUrl}|View Task Details>`
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Mark Complete' },
                        action_id: 'task_complete',
                        value: task.id,
                        style: 'primary'
                    },
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Assign to Me' },
                        action_id: 'task_assign',
                        value: task.id
                    }
                ]
            }
        ];
    }

    calculateSprintStats(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'DONE').length;
        const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const blocked = tasks.filter(t => t.status === 'BLOCKED').length;
        const todo = tasks.filter(t => t.status === 'TODO').length;
        
        return { total, completed, inProgress, blocked, todo };
    }

    buildStandupReport(sprint, stats, tasks) {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🌅 Daily Standup - ${sprint.name}`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `📊 *Progress:* ${stats.completed}/${stats.total} tasks (${Math.round(stats.completed/stats.total*100)}%)`
                    },
                    {
                        type: 'mrkdwn',
                        text: `🚧 *In Progress:* ${stats.inProgress} tasks`
                    },
                    {
                        type: 'mrkdwn',
                        text: `🚫 *Blocked:* ${stats.blocked} tasks`
                    },
                    {
                        type: 'mrkdwn',
                        text: `📋 *To Do:* ${stats.todo} tasks`
                    }
                ]
            }
        ];
    }

    verifySlackRequest(signature, timestamp, body) {
        const signingSecret = process.env.SLACK_SIGNING_SECRET;
        const time = Math.floor(new Date().getTime() / 1000);
        
        if (Math.abs(time - timestamp) > 300) {
            return false;
        }
        
        const sigBasestring = 'v0:' + timestamp + ':' + body;
        const mySignature = 'v0=' + crypto
            .createHmac('sha256', signingSecret)
            .update(sigBasestring, 'utf8')
            .digest('hex');
        
        return crypto.timingSafeEqual(
            Buffer.from(mySignature, 'utf8'),
            Buffer.from(signature, 'utf8')
        );
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    async sendHelpMessage(channel, client) {
        const helpBlocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*🤖 Kira Task Manager Help*\n\nHere are the commands you can use:'
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Creating Tasks:*\n`@kira Fix login issue @john @jane P1 Feature due 2024-01-15 3 points`\n\n*Slash Commands:*\n• `/kira create Task title` - Create a new task\n• `/kira close TASK_ID` - Mark task as complete\n• `/kira status` - Show current sprint status\n• `/kira help` - Show this help message'
                }
            }
        ];

        await client.chat.postMessage({
            channel: channel,
            blocks: helpBlocks
        });
    }

    async sendSlashCommandHelp(respond) {
        respond({
            text: `*🤖 Kira Task Manager Commands*

*Basic Commands:*
• \`/kira create Task title\` - Create a new task
• \`/kira close TASK_ID\` - Mark task as complete  
• \`/kira assign TASK_ID @user\` - Assign task to user
• \`/kira status\` - Show current sprint status
• \`/kira sprint\` - Show sprint information

*Scrum Master Commands:*
• \`/kira burndown [sprint]\` - Show burndown analysis
• \`/kira workload\` - Analyze team workload
• \`/kira reviews\` - Send code review reminders
• \`/kira retrospective [sprint]\` - Generate retrospective data
• \`/kira release [version] [date]\` - Create release plan

*Other:*
• \`/kira help\` - Show this help

*Mention Commands:*
Create tasks by mentioning @kira: \`@kira Fix login bug @john @jane P1 Feature due 2024-01-15 3 points\``,
            response_type: 'ephemeral'
        });
    }

    // Additional methods for advanced features
    async generateBurndownChart() {
        // Implementation for burndown chart generation
        // This would calculate daily completion rates and generate alerts
    }

    async analyzeTeamWorkload() {
        // Implementation for team workload analysis
        // This would analyze task distribution and suggest rebalancing
    }

    async generateCodeReviewReminders() {
        // Implementation for code review reminders
        // This would track tasks waiting for review and send reminders
    }

    async notifyAssignedUsers(assignedUsers, task, client) {
        try {
            for (const slackUserId of assignedUsers) {
                const user = await this.getUserBySlackId(slackUserId);
                if (user) {
                    const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/task/${task.id}`;
                    
                    await client.chat.postMessage({
                        channel: slackUserId, // DM to the user
                        text: `📋 You have been assigned a new task: *${task.task}*\n\n🔗 <${taskUrl}|View Task Details>`,
                        unfurl_links: false
                    });
                }
            }
        } catch (error) {
            console.error('Error notifying assigned users:', error);
        }
    }

    cleanupOldThreads() {
        try {
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            let cleanedCount = 0;
            
            // Clean up entries based on their creation timestamp
            for (const [key, createdAt] of this.threadTimestamps) {
                if (now - createdAt > maxAge) {
                    this.threadToTaskMap.delete(key);
                    this.threadTimestamps.delete(key);
                    cleanedCount++;
                }
            }
            
            // Additional cleanup: remove orphaned entries without timestamps
            for (const [key] of this.threadToTaskMap) {
                if (!this.threadTimestamps.has(key)) {
                    // For Slack timestamp-based keys, use the timestamp itself
                    if (key.includes('.') && !isNaN(parseFloat(key))) {
                        const threadTime = parseFloat(key) * 1000;
                        if (now - threadTime > maxAge) {
                            this.threadToTaskMap.delete(key);
                            cleanedCount++;
                        }
                    } else {
                        // For other keys without known age, keep them but log warning
                        console.warn(`Found orphaned thread mapping without timestamp: ${key}`);
                    }
                }
            }
            
            // Log cleanup results
            if (cleanedCount > 0) {
                console.log(`✅ Cleaned up ${cleanedCount} old thread mappings`);
            }
            
            // Memory usage monitoring
            const threadMapSize = this.threadToTaskMap.size;
            const timestampMapSize = this.threadTimestamps.size;
            
            if (threadMapSize > 10000 || timestampMapSize > 10000) {
                console.warn(`⚠️ Large memory usage detected - ThreadMap: ${threadMapSize}, TimestampMap: ${timestampMapSize}`);
            }
            
        } catch (error) {
            console.error('Error cleaning up thread mappings:', error);
        }
    }

    // Graceful shutdown method
    async shutdown() {
        try {
            console.log('🔄 Shutting down Slack service...');
            
            // Stop scheduled jobs
            if (this.scheduledJobs && this.scheduledJobs.length > 0) {
                this.scheduledJobs.forEach(job => {
                    try {
                        job.stop();
                    } catch (error) {
                        console.error('Error stopping scheduled job:', error);
                    }
                });
                console.log(`✅ Stopped ${this.scheduledJobs.length} scheduled jobs`);
            }
            
            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
                console.log('✅ Stopped cleanup interval');
            }
            
            // Clear maps to free memory
            this.threadToTaskMap.clear();
            this.threadTimestamps.clear();
            this.userEmailMap.clear();
            
            // Clear scrum master cache if available
            if (this.scrumMaster && this.scrumMaster.clearCache) {
                this.scrumMaster.clearCache();
                console.log('✅ Cleared scrum master cache');
            }
            
            this.isInitialized = false;
            console.log('✅ Slack service shutdown completed');
            
        } catch (error) {
            console.error('Error during Slack service shutdown:', error);
        }
    }
}

module.exports = new SlackService();