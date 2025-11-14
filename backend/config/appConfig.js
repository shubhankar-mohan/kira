// Centralized application configuration helpers

function getFrontendBaseUrl() {
    // Prefer explicit env vars
    const envUrl = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL;
    if (envUrl && typeof envUrl === 'string') {
        return envUrl.replace(/\/$/, '');
    }
    // Default to backend server origin in single-server mode
    return 'http://localhost:3001';
}

function getCompanyName() {
    return process.env.COMPANY_NAME || 'Task Manager';
}

function getEmailDomain() {
    return process.env.EMAIL_DOMAIN || 'example.com';
}

function getAppName() {
    return `${getCompanyName()} Task Manager`;
}

module.exports = {
    getFrontendBaseUrl,
    getCompanyName,
    getEmailDomain,
    getAppName
};


