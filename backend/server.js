require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path'); // Added for path.join
const { getFrontendBaseUrl } = require('./config/appConfig');

// Route imports
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const sprintsRouter = require('./routes/sprints');
const slackRouter = require('./routes/slack');
const { router: authRouter } = require('./routes/auth');
const activityRouter = express.Router();
const db = require('./services/dbAdapter');
const slackSecurity = require('./middleware/slackSecurity');

const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001 for single server
// Respect X-Forwarded-* headers from reverse proxies/load balancers
app.set('trust proxy', 1);
// Lazy import to avoid crash before Prisma is generated
const prisma = require('./db/prisma');

// Security middleware with secure CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Required for dynamic styles
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false // Disable for now if causing issues
}));

// CORS configuration - secure origins only
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) || ['https://yourdomain.com']
    : (process.env.FRONTEND_URL || 'http://localhost:3001').split(',').filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Rate limiting - general API protection
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/health') // Skip rate limiting for health checks
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Apply input validation to API routes (except Slack webhook which needs raw body)
app.use('/api/', (req, res, next) => {
    if (req.path.startsWith('/api/slack')) {
        return next();
    }
    validateInput(req, res, next);
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth', authLimiter);

// Input validation middleware
const validateInput = (req, res, next) => {
    // Basic input sanitization
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.trim().replace(/[<>\"'&]/g, '');
    };

    // Sanitize common fields
    if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string') {
                req.body[key] = sanitizeString(value);
            }
        }
    }

    if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
                req.query[key] = sanitizeString(value);
            }
        }
    }

    next();
};

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

// Activity feed
activityRouter.get('/feed', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize, 10) || 20, 100));
        const offset = (page - 1) * pageSize;
        if (!db || !db.getActivities) return res.json({ success: true, data: [], total: 0 });
        // Simple feed: latest task activities
        const tasks = await db.getTasks();
        const all = [];
        for (const t of tasks) {
            const acts = await db.getActivities(t.id);
            acts.forEach(a => all.push({ ...a, taskId: t.id, taskTitle: t.task }));
        }
        all.sort((a, b) => (new Date(b.timestamp).getTime()||0) - (new Date(a.timestamp).getTime()||0));
        const total = all.length;
        const items = all.slice(offset, offset + pageSize);
        res.json({ success: true, data: items, total, page, pageSize, hasNext: (page * pageSize) < total });
    } catch (e) {
        console.error('Activity feed error:', e);
        res.status(500).json({ success: false, error: 'Failed to load activity feed' });
    }
});
app.use('/api/activity', activityRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV 
    });
});

// Database health endpoint
app.get('/api/health/database', async (req, res) => {
    if (!prisma) {
        return res.status(503).json({ status: 'UNAVAILABLE', message: 'Prisma client not initialized' });
    }
    const started = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        const latencyMs = Date.now() - started;
        return res.json({ status: 'OK', latencyMs });
    } catch (err) {
        return res.status(500).json({ status: 'ERROR', error: err.message });
    }
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
