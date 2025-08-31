const express = require('express');
const router = express.Router();
const googleSheets = require('../services/googleSheets');

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await googleSheets.getUsers();
        
        // Remove password hashes from response
        const safeUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdDate: user.createdDate,
            active: user.active
        }));
        
        res.json({
            success: true,
            data: safeUsers
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get single user by ID
router.get('/:id', async (req, res) => {
    try {
        const users = await googleSheets.getUsers();
        const user = users.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Remove password hash from response
        const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdDate: user.createdDate,
            active: user.active
        };
        
        res.json({
            success: true,
            data: safeUser
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Create new user
router.post('/', async (req, res) => {
    try {
        const userData = {
            ...req.body,
            id: req.body.id || Date.now().toString(),
            passwordHash: req.body.password ? 'hashed_password_placeholder' : ''
        };

        // Validate required fields
        if (!userData.email || !userData.name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and name are required' 
            });
        }

        // Check if user already exists
        const existingUsers = await googleSheets.getUsers();
        if (existingUsers.find(u => u.email === userData.email)) {
            return res.status(409).json({ 
                success: false, 
                error: 'User with this email already exists' 
            });
        }

        const newUser = await googleSheets.createUser(userData);
        
        // Remove password hash from response
        const safeUser = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role
        };
        
        res.status(201).json({
            success: true,
            data: safeUser,
            message: 'User created successfully'
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get user tasks and statistics
router.get('/:id/tasks', async (req, res) => {
    try {
        const users = await googleSheets.getUsers();
        const user = users.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        const tasks = await googleSheets.getTasks();
        const userTasks = tasks.filter(task => 
            task.assignedTo && task.assignedTo.includes(user.email)
        );

        const stats = {
            total: userTasks.length,
            completed: userTasks.filter(t => t.status === 'Done').length,
            inProgress: userTasks.filter(t => t.status === 'In progress').length,
            blocked: userTasks.filter(t => t.status.includes('Blocked')).length,
            totalPoints: userTasks.reduce((sum, t) => sum + (t.sprintPoints || 0), 0),
            completedPoints: userTasks.filter(t => t.status === 'Done')
                .reduce((sum, t) => sum + (t.sprintPoints || 0), 0)
        };

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                tasks: userTasks,
                stats
            }
        });
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const updateData = req.body;

        const users = await googleSheets.getUsers();
        const userIndex = users.findIndex(u => u.id === userId || u.email === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Update user data
        const updatedUser = { ...users[userIndex], ...updateData };
        const result = await googleSheets.updateUser(userId, updatedUser);
        
        // Remove password hash from response
        const safeUser = {
            id: result.id,
            email: result.email,
            name: result.name,
            role: result.role,
            slackName: result.slackName,
            slackId: result.slackId,
            status: result.status
        };
        
        res.json({
            success: true,
            data: safeUser,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const users = await googleSheets.getUsers();
        const user = users.find(u => u.id === userId || u.email === userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        await googleSheets.deleteUser(userId);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
