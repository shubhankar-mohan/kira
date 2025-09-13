const express = require('express');
const router = express.Router();
const googleSheets = require('../services/googleSheets');
const slackService = require('../services/slackService');

// Get all tasks
router.get('/', async (req, res) => {
    try {
        const tasks = await googleSheets.getTasks();
        
        // Apply filters if provided
        let filteredTasks = tasks;
        
        if (req.query.status) {
            filteredTasks = filteredTasks.filter(task => task.status === req.query.status);
        }
        
        if (req.query.assignee) {
            filteredTasks = filteredTasks.filter(task => 
                task.assignedTo && task.assignedTo.includes(req.query.assignee)
            );
        }
        
        if (req.query.sprint) {
            filteredTasks = filteredTasks.filter(task => task.sprintWeek === req.query.sprint);
        }
        
        if (req.query.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === req.query.priority);
        }

        res.json({
            success: true,
            data: filteredTasks,
            total: filteredTasks.length
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get single task by ID
router.get('/:id', async (req, res) => {
    try {
        const tasks = await googleSheets.getTasks();
        const task = tasks.find(t => t.id === req.params.id);
        
        if (!task) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }

        // Get comments for this task (sorted: newest first)
        const comments = (await googleSheets.getComments(req.params.id)).sort((a, b) => {
            const ta = new Date(a.timestamp).getTime() || 0;
            const tb = new Date(b.timestamp).getTime() || 0;
            return tb - ta;
        });
        
        res.json({
            success: true,
            data: { ...task, comments }
        });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Create new task
router.post('/', async (req, res) => {
    try {
        const taskData = {
            ...req.body,
            id: req.body.id || Date.now().toString(),
            createdBy: req.body.createdBy || 'API User'
        };

        // Validate required fields
        if (!taskData.task) {
            return res.status(400).json({ 
                success: false, 
                error: 'Task title is required' 
            });
        }

        const newTask = await googleSheets.createTask(taskData);

        // Post a Slack thread for this dashboard-created task if not already linked
        try {
            const { channel, thread_ts } = await slackService.postTaskCreatedThread({ ...newTask, id: newTask.id });
            // Persist Slack thread & channel onto task
            await googleSheets.updateTask(newTask.id, {
                slackThreadId: thread_ts,
                slackChannelId: channel,
                lastEditedBy: taskData.createdBy || 'API User'
            });
            newTask.slackThreadId = thread_ts;
            newTask.slackChannelId = channel;
        } catch (err) {
            console.error('Failed to start Slack thread for task:', err.message);
        }

        res.status(201).json({
            success: true,
            data: newTask,
            message: 'Task created successfully'
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Update task
router.put('/:id', async (req, res) => {
    try {
        const updates = {
            ...req.body,
            lastEditedBy: req.body.lastEditedBy || 'API User'
        };
        
        const updatedTask = await googleSheets.updateTask(req.params.id, updates);
        
        res.json({
            success: true,
            data: updatedTask,
            message: 'Task updated successfully'
        });
    } catch (error) {
        console.error('Error updating task:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                error: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
});

// Delete task
router.delete('/:id', async (req, res) => {
    try {
        await googleSheets.deleteTask(req.params.id);
        
        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add comment to task
router.post('/:id/comments', async (req, res) => {
    try {
        const commentData = {
            taskId: req.params.id,
            user: req.body.user || 'Anonymous',
            comment: req.body.comment
        };

        if (!commentData.comment) {
            return res.status(400).json({ 
                success: false, 
                error: 'Comment text is required' 
            });
        }

        const tasks = await googleSheets.getTasks();
        const task = tasks.find(t => t.id === req.params.id);

        let slackMessageTs = '';
        let slackChannelId = '';

        // If the task is linked to a Slack thread, post to Slack first to capture ts
        if (task && task.slackThreadId && task.slackChannelId) {
            try {
                slackChannelId = task.slackChannelId;
                // Bold author and separate message clearly
                const slackText = `*${commentData.user}*\n${commentData.comment}`;
                slackMessageTs = await slackService.postCommentToThread(task.slackChannelId, task.slackThreadId, slackText);
            } catch (err) {
                console.error('Failed to mirror comment to Slack:', err.message);
            }
        }

        // Add a single comment row in Sheets with Slack metadata if available
        const newComment = await googleSheets.addComment({
            ...commentData,
            source: 'web',
            slackMessageTs,
            slackChannelId
        });
        
        res.status(201).json({
            success: true,
            data: newComment,
            message: 'Comment added successfully'
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get task statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const tasks = await googleSheets.getTasks();
        
        const stats = {
            total: tasks.length,
            byStatus: {},
            byPriority: {},
            byType: {},
            totalPoints: 0,
            completedPoints: 0
        };

        tasks.forEach(task => {
            // Count by status
            stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
            
            // Count by priority
            stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
            
            // Count by type
            if (task.type) {
                stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
            }
            
            // Calculate points
            const points = task.sprintPoints || 0;
            stats.totalPoints += points;
            
            if (task.status === 'Done') {
                stats.completedPoints += points;
            }
        });

        stats.completionRate = stats.total > 0 ? 
            Math.round((stats.byStatus['Done'] || 0) / stats.total * 100) : 0;

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting task stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
