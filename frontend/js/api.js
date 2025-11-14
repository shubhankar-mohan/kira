// API Service for Kira Task Manager
class APIService {
    constructor() {
        // Use relative URL for single server deployment
        this.baseURL = '/api';
        this.token = localStorage.getItem('authToken');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // Get authentication headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    buildQueryString(params = {}) {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }

            if (Array.isArray(value)) {
                value
                    .filter(item => item !== undefined && item !== null && item !== '')
                    .forEach(item => searchParams.append(key, item));
                return;
            }

            if (value instanceof Date) {
                searchParams.append(key, value.toISOString());
                return;
            }

            if (typeof value === 'object') {
                // Allow objects that expose from/to or value keys (e.g. range filters)
                const entries = Object.entries(value);
                entries.forEach(([nestedKey, nestedValue]) => {
                    if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
                        searchParams.append(`${key}[${nestedKey}]`, nestedValue);
                    }
                });
                return;
            }

            if (value === '' || Number.isNaN(value)) {
                return;
            }

            searchParams.append(key, value);
        });

        const queryString = searchParams.toString();
        return queryString ? `?${queryString}` : '';
    }

    mapTaskStatus(status) {
        if (!status) return undefined;
        const normalized = String(status).trim().toLowerCase();
        const map = {
            'not started': 'PENDING',
            'pending': 'PENDING',
            'in progress': 'IN_PROGRESS',
            'dev testing': 'DEV_TESTING',
            'product testing': 'PRODUCT_TESTING',
            'awaiting release': 'DEV_TESTING',
            'done': 'DONE',
            'blocked - product': 'PRODUCT_BLOCKED',
            'blocked - engineering': 'ENGG_BLOCKED',
            'not required': 'NOT_REQUIRED'
        };
        return map[normalized] || status;
    }

    mapTaskPriority(priority) {
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

    mapTaskType(type) {
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

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        if (response.success && response.data.token) {
            this.setToken(response.data.token);
        }
        
        return response;
    }

    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        
        if (response.success && response.data.token) {
            this.setToken(response.data.token);
        }
        
        return response;
    }

    async verifyToken() {
        if (!this.token) {
            throw new Error('No token available');
        }
        
        return await this.request('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ token: this.token }),
        });
    }

    async getCurrentUser() {
        return await this.request('/auth/me');
    }

    logout() {
        this.setToken(null);
    }

    // Task methods
    async getTasks(params = {}) {
        const query = this.buildQueryString(params);
        return await this.request(`/tasks${query}`);
    }

    async searchTasks(term, limit = 10, options = {}) {
        if (!term || !term.trim()) {
            return { success: true, data: [] };
        }

        const query = this.buildQueryString({ q: term.trim(), limit, ...options });
        return await this.request(`/tasks/search${query}`);
    }

    async getTask(taskId) {
        return await this.request(`/tasks/${taskId}`);
    }

    async createTask(taskData) {
        return await this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify({
                ...taskData,
                status: this.mapTaskStatus(taskData.status),
                priority: this.mapTaskPriority(taskData.priority),
                type: this.mapTaskType(taskData.type)
            }),
        });
    }

    async updateTask(taskId, updates) {
        return await this.request(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
                ...updates,
                status: this.mapTaskStatus(updates.status),
                priority: this.mapTaskPriority(updates.priority),
                type: this.mapTaskType(updates.type)
            }),
        });
    }

    async deleteTask(taskId) {
        return await this.request(`/tasks/${taskId}`, {
            method: 'DELETE',
        });
    }

    async addComment(taskId, comment, user, userEmail) {
        return await this.request(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ comment, user, userEmail }),
        });
    }

    async getTaskComments(taskId, params = {}) {
        const query = this.buildQueryString(params);
        return await this.request(`/tasks/${taskId}/comments${query}`);
    }

    async getActivityFeed(params = {}) {
        const query = this.buildQueryString(params);
        return await this.request(`/activity/feed${query}`);
    }

    async bulkUpdateStatus(taskIds, status, user) {
        return await this.request('/tasks/bulk/status', {
            method: 'POST',
            body: JSON.stringify({ taskIds, status, user }),
        });
    }

    async bulkAssignTasks(taskIds, userEmail, assignedByEmail) {
        return await this.request('/tasks/bulk/assign', {
            method: 'POST',
            body: JSON.stringify({ taskIds, userEmail, assignedByEmail }),
        });
    }

    async bulkDeleteTasks(taskIds) {
        return await this.request('/tasks/bulk/delete', {
            method: 'POST',
            body: JSON.stringify({ taskIds }),
        });
    }

    async getTaskStats() {
        return await this.request('/tasks/stats/summary');
    }

    // User methods
    async getUsers() {
        return await this.request('/users');
    }

    async getUser(userId) {
        return await this.request(`/users/${userId}`);
    }

    async createUser(userData) {
        return await this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async updateUser(userId, userData) {
        return await this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(userId) {
        return await this.request(`/users/${userId}`, {
            method: 'DELETE',
        });
    }

    async getUserTasks(userId) {
        return await this.request(`/users/${userId}/tasks`);
    }

    // Sprint methods
    async getSprints() {
        return await this.request('/sprints');
    }

    async getSprint(sprintId) {
        return await this.request(`/sprints/${sprintId}`);
    }

    async createSprint(sprintData) {
        return await this.request('/sprints', {
            method: 'POST',
            body: JSON.stringify(sprintData),
        });
    }

    async updateSprint(sprintId, sprintData) {
        return await this.request(`/sprints/${sprintId}`, {
            method: 'PUT',
            body: JSON.stringify(sprintData),
        });
    }

    async getActiveSprint() {
        return await this.request('/sprints/active/current');
    }

    async getSprintBurndown(sprintId) {
        return await this.request(`/sprints/${sprintId}/burndown`);
    }

    // Slack integration methods
    async sendSlackNotification(message, channel = '#general') {
        try {
            return await this.request('/slack/notify', {
                method: 'POST',
                body: JSON.stringify({ message, channel }),
            });
        } catch (error) {
            console.error('Slack notification failed:', error);
            // Don't throw error for Slack failures
            return { success: false, error: error.message };
        }
    }

    // Slack task notification with thread support
    async sendSlackTaskNotification(message, taskId, channel = '#general') {
        try {
            return await this.request('/slack/notify', {
                method: 'POST',
                body: JSON.stringify({ message, taskId, channel }),
            });
        } catch (error) {
            console.error('Failed to send Slack task notification:', error);
            return { success: false, error: error.message };
        }
    }

    async sendTaskAssignedNotification(taskTitle, assignedTo, assignedBy) {
        try {
            return await this.request('/slack/task-assigned', {
                method: 'POST',
                body: JSON.stringify({ taskTitle, assignedTo, assignedBy }),
            });
        } catch (error) {
            console.error('Task assignment notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendTaskCompletedNotification(taskTitle, completedBy, sprintPoints) {
        try {
            return await this.request('/slack/task-completed', {
                method: 'POST',
                body: JSON.stringify({ taskTitle, completedBy, sprintPoints }),
            });
        } catch (error) {
            console.error('Task completion notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendTaskBlockedNotification(taskTitle, blockedBy, reason) {
        try {
            return await this.request('/slack/task-blocked', {
                method: 'POST',
                body: JSON.stringify({ taskTitle, blockedBy, reason }),
            });
        } catch (error) {
            console.error('Task blocked notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendSprintCreatedNotification(sprintName, goal, createdBy) {
        try {
            return await this.request('/slack/sprint-created', {
                method: 'POST',
                body: JSON.stringify({ sprintName, goal, createdBy }),
            });
        } catch (error) {
            console.error('Sprint creation notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Slack task update notification with thread support
    async sendTaskUpdateNotification(taskId, taskTitle, updatedBy, changes, threadTs, channelId) {
        try {
            return await this.request('/slack/task-updated', {
                method: 'POST',
                body: JSON.stringify({ taskId, taskTitle, updatedBy, changes, threadTs, channelId }),
            });
        } catch (error) {
            console.error('Task update notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Utility methods
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Error handling helper
    handleError(error) {
        console.error('API Error:', error);
        
        if (error.message.includes('401') || error.message.includes('403')) {
            // Token expired or invalid
            this.logout();
            window.location.reload();
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Create global API instance
const api = new APIService();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIService;
}
