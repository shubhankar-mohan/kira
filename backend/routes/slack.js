const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('./auth');

// Slack notification endpoint
router.post('/notify', authenticateToken, async (req, res) => {
    try {
        const { message, channel = '#general' } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Check if Slack webhook URL is configured
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        
        if (!webhookUrl) {
            console.log('Slack webhook not configured, skipping notification');
            return res.json({
                success: true,
                message: 'Notification skipped (Slack not configured)'
            });
        }

        // Send to Slack webhook
        const slackPayload = {
            text: message,
            channel: channel,
            username: 'KiranaClub TaskManager',
            icon_emoji: ':office:',
            attachments: [{
                color: 'good',
                fields: [{
                    title: 'Task Manager Notification',
                    value: message,
                    short: false
                }],
                footer: 'KiranaClub Task Manager',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        await axios.post(webhookUrl, slackPayload);

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

// Task assignment notifications
router.post('/task-assigned', authenticateToken, async (req, res) => {
    try {
        const { taskTitle, assignedTo, assignedBy } = req.body;
        
        const message = `📋 *Task Assigned*\n` +
                       `Task: ${taskTitle}\n` +
                       `Assigned to: ${assignedTo}\n` +
                       `Assigned by: ${assignedBy}`;

        // Send notification
        await sendSlackNotification(message);

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

// Task completion notifications
router.post('/task-completed', authenticateToken, async (req, res) => {
    try {
        const { taskTitle, completedBy, sprintPoints } = req.body;
        
        const message = `✅ *Task Completed*\n` +
                       `Task: ${taskTitle}\n` +
                       `Completed by: ${completedBy}\n` +
                       `Sprint Points: ${sprintPoints || 0}`;

        await sendSlackNotification(message);

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

// Blocked task notifications
router.post('/task-blocked', authenticateToken, async (req, res) => {
    try {
        const { taskTitle, blockedBy, reason } = req.body;
        
        const message = `🚫 *Task Blocked*\n` +
                       `Task: ${taskTitle}\n` +
                       `Blocked by: ${blockedBy}\n` +
                       `Reason: ${reason || 'No reason provided'}`;

        await sendSlackNotification(message, '#alerts');

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

// Sprint notifications
router.post('/sprint-created', authenticateToken, async (req, res) => {
    try {
        const { sprintName, goal, createdBy } = req.body;
        
        const message = `🏃 *New Sprint Created*\n` +
                       `Sprint: ${sprintName}\n` +
                       `Goal: ${goal || 'No goal set'}\n` +
                       `Created by: ${createdBy}`;

        await sendSlackNotification(message);

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

// Daily standup reminder
router.post('/daily-reminder', authenticateToken, async (req, res) => {
    try {
        const { tasks, team } = req.body;
        
        const message = `🌅 *Daily Standup Reminder*\n` +
                       `Active tasks: ${tasks.length}\n` +
                       `Team members: ${team.join(', ')}\n` +
                       `Remember to update your task status!`;

        await sendSlackNotification(message, '#standup');

        res.json({
            success: true,
            message: 'Daily reminder sent'
        });

    } catch (error) {
        console.error('Daily reminder error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send daily reminder'
        });
    }
});

// Helper function to send Slack notifications
async function sendSlackNotification(message, channel = '#general') {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.log('Slack webhook not configured');
        return;
    }

    const payload = {
        text: message,
        channel: channel,
        username: 'KiranaClub TaskManager',
        icon_emoji: ':office:'
    };

    try {
        await axios.post(webhookUrl, payload);
        console.log('Slack notification sent successfully');
    } catch (error) {
        console.error('Failed to send Slack notification:', error.message);
    }
}

module.exports = router;
