const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Slack request verification middleware
const verifySlackRequest = (req, res, next) => {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const body = req.rawBody || JSON.stringify(req.body);

    // Check for required headers
    if (!signature || !timestamp) {
        console.warn('Missing Slack signature headers', { ip: req.ip });
        return res.status(400).json({ 
            error: 'Missing Slack signature headers',
            code: 'MISSING_HEADERS'
        });
    }

    // Verify request timestamp (prevent replay attacks)
    const time = Math.floor(new Date().getTime() / 1000);
    if (Math.abs(time - timestamp) > 300) { // 5 minutes tolerance
        console.warn('Slack request timestamp too old', { 
            timestamp, 
            currentTime: time,
            ip: req.ip 
        });
        return res.status(401).json({ 
            error: 'Request timestamp too old',
            code: 'TIMESTAMP_TOO_OLD'
        });
    }

    // Verify Slack signature
    if (!verifySignature(signature, timestamp, body)) {
        console.warn('Invalid Slack signature', { 
            signature: signature.substring(0, 10) + '...', 
            ip: req.ip 
        });
        return res.status(401).json({ 
            error: 'Invalid Slack signature',
            code: 'INVALID_SIGNATURE'
        });
    }

    next();
};

// Helper function to verify Slack signature
function verifySignature(signature, timestamp, body) {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    
    if (!signingSecret) {
        console.error('SLACK_SIGNING_SECRET not configured');
        return false;
    }
    
    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature = 'v0=' + crypto
        .createHmac('sha256', signingSecret)
        .update(sigBasestring, 'utf8')
        .digest('hex');
    
    try {
        return crypto.timingSafeEqual(
            Buffer.from(mySignature, 'utf8'),
            Buffer.from(signature, 'utf8')
        );
    } catch (error) {
        console.error('Error comparing signatures:', error);
        return false;
    }
}

// Rate limiting for Slack endpoints (env-driven)
const WINDOW_MS = parseInt(process.env.SLACK_RATE_LIMIT_WINDOW_MS || '', 10);
const MAX_REQ = parseInt(process.env.SLACK_RATE_LIMIT_MAX || '', 10);
const windowMs = Number.isFinite(WINDOW_MS) && WINDOW_MS > 0 ? WINDOW_MS : 60 * 1000;
const max = Number.isFinite(MAX_REQ) && MAX_REQ > 0 ? MAX_REQ : 60;

const slackRateLimit = rateLimit({
    windowMs,
    max,
    message: {
        error: 'Too many requests from this IP',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: `${Math.round(windowMs / 1000)} seconds`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn('Rate limit exceeded', { 
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            error: 'Too many requests from this IP',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: `${Math.round(windowMs / 1000)} seconds`
        });
    }
});

// Middleware to capture raw body for signature verification
const captureRawBody = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', chunk => {
        data += chunk;
    });
    
    req.on('end', () => {
        req.rawBody = data;
        next();
    });
};

// Environment validation middleware
const validateSlackConfig = (req, res, next) => {
    const requiredEnvVars = [
        'SLACK_BOT_TOKEN',
        'SLACK_SIGNING_SECRET'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('Missing required Slack configuration:', missingVars);
        return res.status(500).json({
            error: 'Slack integration not properly configured',
            code: 'MISSING_CONFIG',
            missingVars: missingVars
        });
    }
    
    next();
};

// IP whitelist middleware (optional)
const ipWhitelist = (req, res, next) => {
    const allowedIPs = process.env.SLACK_ALLOWED_IPS;
    
    if (!allowedIPs) {
        return next(); // Skip if no whitelist configured
    }
    
    const allowedIPList = allowedIPs.split(',').map(ip => ip.trim());
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPList.includes(clientIP)) {
        console.warn('IP not in whitelist', { 
            clientIP, 
            allowedIPs: allowedIPList 
        });
        return res.status(403).json({
            error: 'IP address not allowed',
            code: 'IP_NOT_ALLOWED'
        });
    }
    
    next();
};

// Request logging middleware
const logSlackRequests = (req, res, next) => {
    const start = Date.now();
    
    // Log request
    console.log('Slack request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        console.log('Slack request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        });
        originalSend.call(this, data);
    };
    
    next();
};

// Comprehensive security middleware stack
const slackSecurityMiddleware = [
    logSlackRequests,
    slackRateLimit,
    validateSlackConfig,
    ipWhitelist,
    captureRawBody,
    verifySlackRequest
];

// Error handling middleware for Slack routes
const slackErrorHandler = (error, req, res, next) => {
    console.error('Slack route error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    
    // Don't expose internal errors to Slack
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
};

// Utility function to sanitize Slack data
function sanitizeSlackData(data) {
    if (typeof data === 'string') {
        // Remove potential XSS and script injection
        return data
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }
    
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeSlackData(value);
        }
        return sanitized;
    }
    
    return data;
}

// Middleware to sanitize request data
const sanitizeSlackInput = (req, res, next) => {
    if (req.body) {
        req.body = sanitizeSlackData(req.body);
    }
    
    if (req.query) {
        req.query = sanitizeSlackData(req.query);
    }
    
    next();
};

module.exports = {
    verifySlackRequest,
    slackRateLimit,
    captureRawBody,
    validateSlackConfig,
    ipWhitelist,
    logSlackRequests,
    slackSecurityMiddleware,
    slackErrorHandler,
    sanitizeSlackInput,
    sanitizeSlackData
};