const express = require('express');
const router = express.Router();
const db = require('../services/dbAdapter');
const slackService = require('../services/slackService');

function mapStatusToEnum(status) {
    if (!status) return undefined;
    const normalized = String(status).trim().toLowerCase();
    const map = {
        'not started': 'PENDING',
        'pending': 'PENDING',
        'in progress': 'IN_PROGRESS',
        'dev testing': 'DEV_TESTING',
        'product testing': 'PRODUCT_BLOCKED',
        'awaiting release': 'DEV_TESTING',
        'done': 'DONE',
        'blocked - product': 'PRODUCT_BLOCKED',
        'blocked - engineering': 'ENGG_BLOCKED'
    };
    return map[normalized] || status;
}

function mapPriorityToEnum(priority) {
    if (!priority) return undefined;
    const normalized = String(priority).trim().toLowerCase();
    const map = {
        'p0': 'P0',
        'p1': 'P1',
        'p2': 'P2',
        'backlog': 'BACKLOG'
    };
    return map[normalized] || priority;
}

function mapTypeToEnum(type) {
    if (!type) return undefined;
    const normalized = String(type).trim().toLowerCase();
    const map = {
        'feature': 'Feature',
        'bug': 'Bug',
        'improvement': 'Improvement',
        'task': 'Task'
    };
    return map[normalized] || type;
}

// Get all tasks (with optional filters and pagination)
router.get('/', async (req, res) => {
    try {
        const { items, total } = await db.getTasksFiltered(req.query);
        res.json({ success: true, data: items, total, page: Number(req.query.page||1), pageSize: Number(req.query.pageSize||20), hasNext: (Number(req.query.page||1) * Number(req.query.pageSize||20)) < total });
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
        // Support lookup by shortId pattern kira-XXXXXX
        const isShort = /^kira-\d{1,10}$/i.test(req.params.id);
        let task = null;
        const tasks = await db.getTasks();
        if (isShort) {
            task = tasks.find(t => (t.shortId || '').toLowerCase() === req.params.id.toLowerCase());
        } else {
            task = tasks.find(t => t.id === req.params.id);
        }
        
        if (!task) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }

        // Get comments for this task (sorted: newest first)
        const comments = (await db.getComments(task.id)).sort((a, b) => {
            const ta = new Date(a.timestamp).getTime() || 0;
            const tb = new Date(b.timestamp).getTime() || 0;
            return tb - ta;
        });

        // Get activities for this task (sorted: newest first)
        const activities = (await db.getActivities(task.id)).sort((a, b) => {
            const ta = new Date(a.timestamp).getTime() || 0;
            const tb = new Date(b.timestamp).getTime() || 0;
            return tb - ta;
        });
        
        res.json({
            success: true,
            data: { ...task, comments, activities }
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
            createdBy: req.body.createdBy || 'API User',
            status: mapStatusToEnum(req.body.status),
            priority: mapPriorityToEnum(req.body.priority),
            type: mapTypeToEnum(req.body.type)
        };

        // Validate required fields
        if (!taskData.task) {
            return res.status(400).json({ 
                success: false, 
                error: 'Task title is required' 
            });
        }

        const newTask = await db.createTask(taskData);
        // Record activity
        try {
            await db.addActivity({
                taskId: newTask.id,
                user: taskData.createdBy || 'API User',
                action: 'created',
                details: `Task created: ${newTask.task}`,
                source: 'web'
            });
        } catch (e) { console.error('Failed to log activity (create):', e.message); }

        // Post a Slack thread for this dashboard-created task if not already linked
        try {
            const { channel, thread_ts } = await slackService.postTaskCreatedThread({ ...newTask, id: newTask.id });
            // Persist Slack thread & channel onto task
            await db.updateTask(newTask.id, {
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
            lastEditedBy: req.body.lastEditedBy || 'API User',
            status: mapStatusToEnum(req.body.status),
            priority: mapPriorityToEnum(req.body.priority),
            type: mapTypeToEnum(req.body.type)
        };
        
        const updatedTask = await db.updateTask(req.params.id, updates);
        // Record activity for updates
        try {
            const fields = Object.keys(updates).filter(k => !['lastEditedBy'].includes(k));
            await db.addActivity({
                taskId: req.params.id,
                user: updates.lastEditedBy,
                action: 'updated',
                details: fields.length > 0 ? `Fields: ${fields.join(', ')}` : 'Task updated',
                source: 'web'
            });
        } catch (e) { console.error('Failed to log activity (update):', e.message); }
        
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
        await db.deleteTask(req.params.id);
        
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

        const tasks = await db.getTasks();
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
        const newComment = await db.addComment({
            ...commentData,
            source: 'web',
            slackMessageTs,
            slackChannelId
        });
        // Record activity for comment
        try {
            await db.addActivity({
                taskId: req.params.id,
                user: newComment.user,
                action: 'commented',
                details: newComment.comment,
                source: 'web'
            });
        } catch (e) { console.error('Failed to log activity (comment):', e.message); }
        
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

// List comments for a task
router.get('/:id/comments', async (req, res) => {
    try {
        const items = await db.getComments(req.params.id);
        // newest first
        items.sort((a, b) => (new Date(b.timestamp).getTime()||0) - (new Date(a.timestamp).getTime()||0));
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error listing comments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get task statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const tasks = await db.getTasks();
        
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

// Search tasks (top matches by title/description)
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
        if (!q) return res.json({ success: true, data: [] });
        const items = await db.searchTasks(q, limit);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error searching tasks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk: delete tasks
router.post('/bulk/delete', async (req, res) => {
    try {
        const { taskIds } = req.body || {};
        if (!Array.isArray(taskIds) || taskIds.length === 0) return res.status(400).json({ success: false, error: 'taskIds required' });
        await db.deleteTasks(taskIds);
        res.json({ success: true, message: 'Tasks deleted' });
    } catch (error) {
        console.error('Error bulk deleting tasks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk: set status
router.post('/bulk/status', async (req, res) => {
    try {
        const { taskIds, status, user } = req.body || {};
        if (!Array.isArray(taskIds) || taskIds.length === 0 || !status) return res.status(400).json({ success: false, error: 'taskIds and status required' });
        await db.setTasksStatus(taskIds, mapStatusToEnum(status) || status, user);
        res.json({ success: true, message: 'Tasks status updated' });
    } catch (error) {
        console.error('Error bulk updating status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk: assign tasks to a user (by email)
router.post('/bulk/assign', async (req, res) => {
    try {
        const { taskIds, userEmail, assignedByEmail } = req.body || {};
        if (!Array.isArray(taskIds) || taskIds.length === 0 || !userEmail) return res.status(400).json({ success: false, error: 'taskIds and userEmail required' });
        await db.assignTasksToUser(taskIds, userEmail, assignedByEmail);
        res.json({ success: true, message: 'Tasks assigned' });
    } catch (error) {
        console.error('Error bulk assigning tasks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
