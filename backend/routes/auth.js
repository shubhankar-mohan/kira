const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const googleSheets = require('../services/googleSheets');
const authService = require('../services/authService');
const db = require('../services/dbAdapter');

// Bootstrap DB on first successful login if using MySQL and database is empty
async function bootstrapIfNeeded() {
  try {
    if ((process.env.DB_TYPE || '').toLowerCase() !== 'mysql') return;
    const prisma = require('../db/prisma');
    if (!prisma) return;
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.sprint.count(),
      prisma.task.count()
    ]);
    const [userCount, sprintCount, taskCount] = counts;
    if (userCount > 0 || sprintCount > 0 || taskCount > 0) return;

    // Seed minimal data inline to avoid requiring CLI
    const admin = await prisma.user.upsert({
      where: { email: 'admin@kira.local' },
      update: { name: 'Kira Admin', isActive: true, role: 'Admin' },
      create: { email: 'admin@kira.local', name: 'Kira Admin', isActive: true, role: 'Admin' }
    });
    const sprint = await prisma.sprint.create({
      data: { name: 'Sprint 1', week: 1, status: 'Planned', goal: 'Bootstrap', isCurrent: true, createdById: admin.id }
    });
    const task = await prisma.task.create({
      data: {
        title: 'Bootstrap Task',
        description: 'Created automatically on first login.',
        status: 'PENDING',
        priority: 'BACKLOG',
        type: 'Task',
        sprintId: sprint.id,
        createdById: admin.id
      }
    });
    await prisma.taskAssignment.create({ data: { taskId: task.id, userId: admin.id, role: 'Assignee', assignedById: admin.id } });
  } catch (e) {
    console.error('Bootstrap error:', e.message);
  }
}

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user (mysql or sheets)
        const found = await authService.findUserByEmail(email);
        const userActive = found && (found.active === undefined ? true : !!found.active);
        const user = userActive ? found : null;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Validate password
        const validPassword = await authService.validatePassword(user, password);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        // Fire-and-forget bootstrap (non-blocking)
        bootstrapIfNeeded();

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                token
            },
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Register endpoint (for creating new users)
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required'
            });
        }

        // Check if user already exists
        const existing = await authService.findUserByEmail(email);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Create user via authService
        const newUser = await authService.createUser({ email, name, role, password });

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                email: newUser.email, 
                role: newUser.role 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role
                },
                token
            },
            message: 'Registration successful'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Verify token endpoint
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

        // Get fresh user data (mysql or sheets)
        let user = null;
        if ((process.env.DB_TYPE || '').toLowerCase() === 'mysql') {
            const users = await db.getUsers();
            user = users.find(u => u.id === decoded.userId && (u.active === undefined ? true : !!u.active));
        } else {
            const users = await googleSheets.getUsers();
            user = users.find(u => u.id === decoded.userId && u.active);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
});

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid token'
            });
        }
        req.user = user;
        next();
    });
};

// Test protected endpoint
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const users = await googleSheets.getUsers();
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user data'
        });
    }
});

module.exports = { router, authenticateToken };
