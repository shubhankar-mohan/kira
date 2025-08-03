// Configuration for Kira Task Manager
class Config {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        // Try to get BASE_URL from environment or use default
        this.BASE_URL = this.getBaseUrl();
    }

    getBaseUrl() {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            // In browser, use current location as base
            return window.location.origin;
        }
        
        // Fallback for server-side or default
        return 'http://localhost:3001';
    }

    getBackendUrl() {
        // Since backend and frontend are on same server now
        return this.BASE_URL;
    }

    getTaskUrl(taskId) {
        return `${this.BASE_URL}/task/${taskId}`;
    }

    getApiUrl(endpoint) {
        return `${this.BASE_URL}/api/${endpoint}`;
    }
}

// Create global config instance
window.config = new Config(); 