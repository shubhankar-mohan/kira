require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path'); // Added for path.join
const { getFrontendBaseUrl } = require('./config/appConfig');

// Route imports
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const sprintsRouter = require('./routes/sprints');
const slackRouter = require('./routes/slack');
const { router: authRouter } = require('./routes/auth');
const slackSecurity = require('./middleware/slackSecurity');

const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001 for single server
// Respect X-Forwarded-* headers from reverse proxies/load balancers
app.set('trust proxy', 1);

// Security middleware with custom CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

// CORS configuration - allow all origins in production
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? true : (process.env.FRONTEND_URL || 'http://localhost:3001'),
    credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Slack routes: capture raw body via body-parser verify hook, then verify signature
const saveRawBody = (req, res, buf, encoding) => {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
    }
};

app.use(
    '/api/slack',
    slackSecurity.logSlackRequests,
    slackSecurity.slackRateLimit,
    slackSecurity.validateSlackConfig,
    slackSecurity.ipWhitelist,
    // Parse urlencoded first (slash commands, interactive), capturing raw body
    express.urlencoded({ extended: true, verify: saveRawBody }),
    // Also parse JSON for Events API, capturing raw body
    express.json({ type: ['application/json', 'application/*+json'], verify: saveRawBody }),
    // Now that req.rawBody is set, verify Slack signature
    slackSecurity.verifySlackRequest,
    slackRouter
);

// Body parsing middleware for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory with proper MIME types
app.use(express.static(path.join(__dirname, '../frontend'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/sprints', sprintsRouter);

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

// Handle client-side routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Serve index.html for all other routes (client-side routing)
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 KiranaClub Task Manager running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API docs: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/`);
    console.log(`🔗 Frontend Base URL (env): ${process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'not set'}`);
    console.log(`🔗 Frontend Base URL (resolved): ${getFrontendBaseUrl()}`);
});

module.exports = app;
