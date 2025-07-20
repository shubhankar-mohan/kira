require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Route imports
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const sprintsRouter = require('./routes/sprints');
const slackRouter = require('./routes/slack');
const { router: authRouter } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static('../frontend'));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/slack', slackRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV 
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({ 
        message: 'KiranaClub Task Manager API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            tasks: '/api/tasks',
            users: '/api/users',
            sprints: '/api/sprints',
            slack: '/api/slack'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}` 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 KiranaClub Task Manager API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API docs: http://localhost:${PORT}/`);
});

module.exports = app;
