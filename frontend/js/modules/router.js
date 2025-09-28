// Router Module - Handles all navigation and routing
class Router {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentTaskId = null;
        this.pendingTaskNavigation = false;
        this.setupRouter();
    }

    setupRouter() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateToPage(e.state.page, false);
            }
        });

        // Check for initial URL
        const path = window.location.pathname;
        const page = this.getPageFromPath(path);
        if (page && page !== 'dashboard') {
            this.currentPage = page;
            
            // If it's a task detail page, we'll handle navigation after auth check
            if (page === 'task-detail') {
                this.pendingTaskNavigation = true;
            }
        }
    }

    getPageFromPath(path) {
        const routes = {
            '/': 'dashboard',
            '/dashboard': 'dashboard',
            '/board': 'board',
            '/sprints': 'sprints',
            '/users': 'users',
            '/team': 'users'
        };
        
        // Handle task detail pages
        if (path.startsWith('/task/')) {
            const rawId = path.split('/')[2];
            if (rawId) {
                const isShort = /^kira-\d{1,10}$/i.test(rawId);
                this.currentTaskId = rawId;
                this.currentTaskIsShort = isShort;
                return 'task-detail';
            }
        }
        
        return routes[path] || 'dashboard';
    }

    getPathFromPage(page) {
        const paths = {
            'dashboard': '/dashboard',
            'board': '/board',
            'sprints': '/sprints',
            'users': '/users'
        };
        
        if (page === 'task-detail' && this.currentTaskId) {
            return `/task/${this.currentTaskId}`;
        }
        
        return paths[page] || '/dashboard';
    }

    navigateToPage(page, updateHistory = true) {
        console.log('Navigating to page:', page);
        
        // Handle special case for task detail page
        if (page === 'task-detail' && this.currentTaskId) {
            if (window.app && typeof window.app.showTaskDetailPage === 'function') {
                window.app.showTaskDetailPage(this.currentTaskId);
            } else if (window.modalManager && typeof window.modalManager.openTaskDetails === 'function') {
                window.modalManager.openTaskDetails(this.currentTaskId);
            }
            return;
        }
        
        // Update current page
        this.currentPage = page;
        
        // Update URL if needed
        if (updateHistory) {
            const path = this.getPathFromPage(page);
            window.history.pushState({ page }, '', path);
        }
        
        // Update breadcrumb
        this.updateBreadcrumb(page);
        
        // Hide all page sections
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show the selected page
        const targetSection = document.getElementById(page + 'Section');
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-section="${page}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        // Load page-specific content
        console.log('🧭 Router: Loading page content for:', page);
        if (window.taskManager) {
            console.log('📋 Using taskManager.loadPageContent (async)');
            window.taskManager.loadPageContent(page).catch(console.error);
        } else if (window.app) {
            console.log('📱 Using app.loadPageContent (fallback)');
            window.app.loadPageContent(page);
        } else {
            console.log('❌ No app or taskManager available for page loading');
        }
    }

    updateBreadcrumb(page) {
        const breadcrumbMap = {
            'dashboard': 'Dashboard',
            'board': 'Task Board',
            'sprints': 'Sprints',
            'users': 'Team',
            'task-detail': `Task ${this.currentTaskId || ''}`
        };
        
        const breadcrumbElement = document.getElementById('breadcrumbPath');
        if (breadcrumbElement) {
            if (typeof page === 'string' && page.startsWith('Task ')) {
                breadcrumbElement.textContent = page;
            } else {
                breadcrumbElement.textContent = breadcrumbMap[page] || 'Dashboard';
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
} else if (typeof window !== 'undefined') {
    window.Router = Router;
} 