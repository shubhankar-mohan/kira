const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('./auth');
const slackService = require('../services/slackService');
const googleSheetsService = require('../services/googleSheets');

// Middleware to verify Slack requests
const verifySlackRequest = (req, res, next) => {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const body = JSON.stringify(req.body);

    if (!signature || !timestamp) {
        return res.status(400).json({ error: 'Missing Slack signature headers' });
    }

    if (!slackService.verifySlackRequest(signature, timestamp, body)) {
        return res.status(401).json({ error: 'Invalid Slack signature' });
    }

    next();
};

// Slack Events API endpoint
router.post('/events', verifySlackRequest, async (req, res) => {
    const { type, challenge, event } = req.body;

    // Handle URL verification challenge
    if (type === 'url_verification') {
        return res.json({ challenge });
    }

    // Handle events
    if (type === 'event_callback' && event) {
        try {
            switch (event.type) {
                case 'app_mention':
                    await slackService.handleAppMention(event, slackService.client);
                    break;
                case 'message':
                    if (event.thread_ts) {
                        await slackService.handleThreadMessage(event, slackService.client);
                    }
                    break;
                case 'reaction_added':
                    await slackService.handleReactionAdded(event, slackService.client);
                    break;
            }
        } catch (error) {
            console.error('Error handling Slack event:', error);
        }
    }

    res.json({ ok: true });
});

// Slash command endpoint
router.post('/commands', verifySlackRequest, async (req, res) => {
    const { command, text, user_id, channel_id, response_url } = req.body;

    if (command === '/kira') {
        try {
            const commandData = {
                text,
                user_id,
                channel_id,
                response_url
            };
            
            const respond = (response) => {
                res.json(response);
            };
            
            await slackService.handleSlashCommand(commandData, respond, slackService.client);
        } catch (error) {
            console.error('Slash command error:', error);
            res.json({
                text: '❌ Error processing command. Please try again.',
                response_type: 'ephemeral'
            });
        }
    } else {
        res.status(400).json({ error: 'Unknown command' });
    }
});

// Interactive components endpoint (buttons, modals, etc.)
router.post('/interactive', verifySlackRequest, async (req, res) => {
    const payload = JSON.parse(req.body.payload);
    const { type, actions, user, channel } = payload;

    try {
        if (type === 'button_action' && actions && actions[0]) {
            const action = actions[0];
            
            switch (action.action_id) {
                case 'task_complete':
                    await handleTaskComplete(action.value, user, channel);
                    break;
                case 'task_assign':
                    await handleTaskAssign(action.value, user, channel);
                    break;
            }
        }
    } catch (error) {
        console.error('Error handling interactive component:', error);
    }

    res.json({ ok: true });
});

// Handle task completion from button
async function handleTaskComplete(taskId, user, channel) {
    try {
        const slackUser = await slackService.getUserBySlackId(user.id);
        await googleSheetsService.updateTask(taskId, {
            status: 'DONE',
            lastEditedBy: slackUser ? slackUser.name : user.name
        });

        await slackService.client.chat.postMessage({
            channel: channel.id,
            text: `✅ Task ${taskId} marked as completed by <@${user.id}>!`
        });
    } catch (error) {
        console.error('Error completing task:', error);
    }
}

// Handle task assignment from button
async function handleTaskAssign(taskId, user, channel) {
    try {
        const slackUser = await slackService.getUserBySlackId(user.id);
        if (!slackUser) {
            return await slackService.client.chat.postMessage({
                channel: channel.id,
                text: `❌ Could not assign task - your Slack account is not linked to a Kira account.`
            });
        }

        await googleSheetsService.updateTask(taskId, {
            assignedTo: slackUser.email,
            lastEditedBy: slackUser.name
        });

        await slackService.client.chat.postMessage({
            channel: channel.id,
            text: `👤 Task ${taskId} assigned to <@${user.id}>!`
        });
    } catch (error) {
        console.error('Error assigning task:', error);
    }
}

// Legacy notification endpoints (maintained for backward compatibility)
router.post('/notify', authenticateToken, async (req, res) => {
    try {
        const { message, channel = '#general', taskId, threadTs } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // If taskId is provided, try to find the original thread
        let targetChannel = channel;
        let targetThreadTs = threadTs;
        
        if (taskId && !threadTs) {
            try {
                const task = await googleSheetsService.getTask(taskId);
                if (task && task.slackThreadId) {
                    targetThreadTs = task.slackThreadId;
                    targetChannel = task.slackChannelId || channel;
                }
            } catch (error) {
                console.log('Could not find Slack thread for task:', taskId);
            }
        }

        const messageOptions = {
            channel: targetChannel,
            text: message,
            username: 'KiranaClub TaskManager',
            icon_emoji: ':office:'
        };

        // Add thread_ts if we have it
        if (targetThreadTs) {
            messageOptions.thread_ts = targetThreadTs;
        }

        await slackService.client.chat.postMessage(messageOptions);

        res.json({
            success: true,
            message: 'Slack notification sent successfully'
        });

    } catch (error) {
        console.error('Slack notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send Slack notification'
        });
    }
});

// Enhanced task assignment notifications
router.post('/task-assigned', authenticateToken, async (req, res) => {
    try {
        const { taskId, taskTitle, assignedTo, assignedBy } = req.body;
        
        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `📋 *Task Assigned*\n*${taskTitle}*`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Assigned to:* ${assignedTo}` },
                    { type: 'mrkdwn', text: `*Assigned by:* ${assignedBy}` },
                    { type: 'mrkdwn', text: `*Task ID:* ${taskId}` }
                ]
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Mark Complete' },
                        action_id: 'task_complete',
                        value: taskId,
                        style: 'primary'
                    }
                ]
            }
        ];

        await slackService.client.chat.postMessage({
            channel: process.env.SLACK_NOTIFICATIONS_CHANNEL || '#general',
            blocks: blocks
        });

        res.json({
            success: true,
            message: 'Assignment notification sent'
        });

    } catch (error) {
        console.error('Task assignment notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send assignment notification'
        });
    }
});

// Enhanced task completion notifications
router.post('/task-completed', authenticateToken, async (req, res) => {
    try {
        const { taskId, taskTitle, completedBy, sprintPoints } = req.body;
        
        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `✅ *Task Completed*\n*${taskTitle}*`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Completed by:* ${completedBy}` },
                    { type: 'mrkdwn', text: `*Sprint Points:* ${sprintPoints || 0}` },
                    { type: 'mrkdwn', text: `*Task ID:* ${taskId}` }
                ]
            }
        ];

        await slackService.client.chat.postMessage({
            channel: process.env.SLACK_NOTIFICATIONS_CHANNEL || '#general',
            blocks: blocks
        });

        res.json({
            success: true,
            message: 'Completion notification sent'
        });

    } catch (error) {
        console.error('Task completion notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send completion notification'
        });
    }
});

// Enhanced blocked task notifications
router.post('/task-blocked', authenticateToken, async (req, res) => {
    try {
        const { taskId, taskTitle, blockedBy, reason } = req.body;
        
        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🚫 *Task Blocked*\n*${taskTitle}*`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Blocked by:* ${blockedBy}` },
                    { type: 'mrkdwn', text: `*Reason:* ${reason || 'No reason provided'}` },
                    { type: 'mrkdwn', text: `*Task ID:* ${taskId}` }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '⚠️ *This task requires immediate attention to prevent sprint delays.*'
                }
            }
        ];

        await slackService.client.chat.postMessage({
            channel: process.env.SLACK_ALERTS_CHANNEL || '#alerts',
            blocks: blocks
        });

        res.json({
            success: true,
            message: 'Blocked task notification sent'
        });

    } catch (error) {
        console.error('Blocked task notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send blocked task notification'
        });
    }
});

// Enhanced sprint notifications
router.post('/sprint-created', authenticateToken, async (req, res) => {
    try {
        const { sprintId, sprintName, goal, createdBy, startDate, endDate } = req.body;
        
        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🏃 *New Sprint Created*\n*${sprintName}*`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Goal:* ${goal || 'No goal set'}` },
                    { type: 'mrkdwn', text: `*Created by:* ${createdBy}` },
                    { type: 'mrkdwn', text: `*Start Date:* ${startDate || 'TBD'}` },
                    { type: 'mrkdwn', text: `*End Date:* ${endDate || 'TBD'}` }
                ]
            }
        ];

        await slackService.client.chat.postMessage({
            channel: process.env.SLACK_NOTIFICATIONS_CHANNEL || '#general',
            blocks: blocks
        });

        res.json({
            success: true,
            message: 'Sprint creation notification sent'
        });

    } catch (error) {
        console.error('Sprint creation notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send sprint creation notification'
        });
    }
});

// Enhanced task update notifications with thread support
router.post('/task-updated', authenticateToken, async (req, res) => {
    try {
        const { taskId, taskTitle, updatedBy, changes, threadTs, channelId } = req.body;
        
        // Find the original task to get thread information
        let targetChannel = channelId || process.env.SLACK_NOTIFICATIONS_CHANNEL || '#general';
        let targetThreadTs = threadTs;
        
        if (taskId && !threadTs) {
            try {
                const task = await googleSheetsService.getTask(taskId);
                if (task && task.slackThreadId) {
                    targetThreadTs = task.slackThreadId;
                    targetChannel = task.slackChannelId || targetChannel;
                }
            } catch (error) {
                console.log('Could not find Slack thread for task:', taskId);
            }
        }

        // Build change description
        const changeDescriptions = [];
        if (changes.status) changeDescriptions.push(`Status: ${changes.status}`);
        if (changes.priority) changeDescriptions.push(`Priority: ${changes.priority}`);
        if (changes.assignedTo) changeDescriptions.push(`Assigned to: ${changes.assignedTo}`);
        if (changes.description) changeDescriptions.push('Description updated');
        if (changes.sprintWeek) changeDescriptions.push(`Sprint: ${changes.sprintWeek}`);

        const changeText = changeDescriptions.length > 0 ? 
            `\n*Changes:* ${changeDescriptions.join(', ')}` : '';

        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `📝 *Task Updated*\n*${taskTitle}*${changeText}`
                }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Updated by:* ${updatedBy}` },
                    { type: 'mrkdwn', text: `*Task ID:* ${taskId}` }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `🔗 <${process.env.FRONTEND_URL || 'http://localhost:3001'}/task/${taskId}|View Task Details>`
                }
            }
        ];

        const messageOptions = {
            channel: targetChannel,
            blocks: blocks,
            username: 'KiranaClub TaskManager',
            icon_emoji: ':office:'
        };

        // Add thread_ts if we have it
        if (targetThreadTs) {
            messageOptions.thread_ts = targetThreadTs;
        }

        await slackService.client.chat.postMessage(messageOptions);

        res.json({
            success: true,
            message: 'Task update notification sent'
        });

    } catch (error) {
        console.error('Task update notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send task update notification'
        });
    }
});

// Manual report generation endpoints
router.post('/generate-standup', authenticateToken, async (req, res) => {
    try {
        await slackService.generateDailyStandupReport();
        res.json({
            success: true,
            message: 'Daily standup report generated'
        });
    } catch (error) {
        console.error('Error generating standup report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate standup report'
        });
    }
});

router.post('/generate-health-alert', authenticateToken, async (req, res) => {
    try {
        await slackService.generateSprintHealthAlert();
        res.json({
            success: true,
            message: 'Sprint health alert generated'
        });
    } catch (error) {
        console.error('Error generating health alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate health alert'
        });
    }
});

// User mapping endpoint
router.post('/sync-users', authenticateToken, async (req, res) => {
    try {
        await slackService.initializeUserMapping();
        res.json({
            success: true,
            message: 'User mapping synchronized'
        });
    } catch (error) {
        console.error('Error syncing users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync user mapping'
        });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const isSlackConnected = slackService.client !== null;
        const isSheetsConnected = await googleSheetsService.testConnection();
        
        res.json({
            success: true,
            status: {
                slack: isSlackConnected,
                googleSheets: isSheetsConnected.success
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

module.exports = router;
