const express = require('express');
const router = express.Router();
const db = require('../services/dbAdapter');

// Get all sprints
router.get('/', async (req, res) => {
    try {
        const sprints = await db.getSprints();
        
        // Add task statistics for each sprint
        const tasks = await require('../services/dbAdapter').getTasks();
        const sprintsWithStats = sprints.map(sprint => {
            const sprintTasks = tasks.filter(task => 
                task.sprintWeek === sprint.name && task.year === sprint.year
            );
            
            const completedTasks = sprintTasks.filter(task => task.status === 'Done');
            const totalPoints = sprintTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
            const completedPoints = completedTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
            
            return {
                ...sprint,
                stats: {
                    totalTasks: sprintTasks.length,
                    completedTasks: completedTasks.length,
                    totalPoints,
                    completedPoints,
                    completionRate: sprintTasks.length > 0 ? 
                        Math.round((completedTasks.length / sprintTasks.length) * 100) : 0
                }
            };
        });
        
        res.json({
            success: true,
            data: sprintsWithStats
        });
    } catch (error) {
        console.error('Error fetching sprints:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get single sprint by ID
router.get('/:id', async (req, res) => {
    try {
        const sprints = await db.getSprints();
        const sprint = sprints.find(s => s.id === req.params.id);
        
        if (!sprint) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sprint not found' 
            });
        }

        // Get tasks for this sprint
        const tasks = await require('../services/dbAdapter').getTasks();
        const sprintTasks = tasks.filter(task => 
            task.sprintWeek === sprint.name && task.year === sprint.year
        );

        const completedTasks = sprintTasks.filter(task => task.status === 'Done');
        const totalPoints = sprintTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
        const completedPoints = completedTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);

        res.json({
            success: true,
            data: {
                ...sprint,
                tasks: sprintTasks,
                stats: {
                    totalTasks: sprintTasks.length,
                    completedTasks: completedTasks.length,
                    totalPoints,
                    completedPoints,
                    completionRate: sprintTasks.length > 0 ? 
                        Math.round((completedTasks.length / sprintTasks.length) * 100) : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching sprint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Create new sprint
router.post('/', async (req, res) => {
    try {
        const sprintData = {
            ...req.body,
            id: req.body.id || Date.now().toString(),
            createdBy: req.body.createdBy || 'API User'
        };

        // Validate required fields
        if (!sprintData.name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Sprint name is required' 
            });
        }

        // Check if sprint already exists
        const existingSprints = await db.getSprints();
        if (existingSprints.find(s => s.name === sprintData.name && s.year === sprintData.year)) {
            return res.status(409).json({ 
                success: false, 
                error: 'Sprint with this name already exists for this year' 
            });
        }

        const newSprint = await db.createSprint(sprintData);
        
        res.status(201).json({
            success: true,
            data: newSprint,
            message: 'Sprint created successfully'
        });
    } catch (error) {
        console.error('Error creating sprint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get sprint burndown chart data
router.get('/:id/burndown', async (req, res) => {
    try {
        const sprints = await db.getSprints();
        const sprint = sprints.find(s => s.id === req.params.id);
        
        if (!sprint) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sprint not found' 
            });
        }

        const tasks = await require('../services/dbAdapter').getTasks();
        const sprintTasks = tasks.filter(task => 
            task.sprintWeek === sprint.name && task.year === sprint.year
        );

        // Calculate burndown data (simplified version)
        const totalPoints = sprintTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
        const completedPoints = sprintTasks.filter(task => task.status === 'Done')
            .reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
        const remainingPoints = totalPoints - completedPoints;

        // This is a simplified version - in a real scenario, you'd track daily progress
        const burndownData = {
            sprintName: sprint.name,
            totalPoints,
            completedPoints,
            remainingPoints,
            dailyData: [
                { day: 1, remaining: totalPoints, completed: 0 },
                { day: 'Current', remaining: remainingPoints, completed: completedPoints }
            ]
        };

        res.json({
            success: true,
            data: burndownData
        });
    } catch (error) {
        console.error('Error fetching burndown data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get active sprint
router.get('/active/current', async (req, res) => {
    try {
        const sprints = await db.getSprints();
        const activeSprint = sprints.find(s => s.status === 'Active');
        
        if (!activeSprint) {
            return res.json({
                success: true,
                data: null,
                message: 'No active sprint found'
            });
        }

        // Get tasks for active sprint
        const tasks = await require('../services/dbAdapter').getTasks();
        const sprintTasks = tasks.filter(task => 
            task.sprintWeek === activeSprint.name && task.year === activeSprint.year
        );

        const completedTasks = sprintTasks.filter(task => task.status === 'Done');
        const totalPoints = sprintTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);
        const completedPoints = completedTasks.reduce((sum, task) => sum + (task.sprintPoints || 0), 0);

        res.json({
            success: true,
            data: {
                ...activeSprint,
                tasks: sprintTasks,
                stats: {
                    totalTasks: sprintTasks.length,
                    completedTasks: completedTasks.length,
                    totalPoints,
                    completedPoints,
                    completionRate: sprintTasks.length > 0 ? 
                        Math.round((completedTasks.length / sprintTasks.length) * 100) : 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching active sprint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Update sprint
router.put('/:id', async (req, res) => {
    try {
        const sprintId = req.params.id;
        const updateData = req.body;
        
        console.log(`🔄 Updating sprint ${sprintId} with data:`, updateData);

        const sprints = await db.getSprints();
        const sprintIndex = sprints.findIndex(s => s.id === sprintId || s.sprintWeek === sprintId);
        
        if (sprintIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sprint not found' 
            });
        }

        // Update sprint data  
        const updatedSprint = { ...sprints[sprintIndex], ...updateData };
        const result = await db.updateSprint(sprintId, updatedSprint);
        
        res.json({
            success: true,
            data: result,
            message: 'Sprint updated successfully'
        });
    } catch (error) {
        console.error('Error updating sprint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
