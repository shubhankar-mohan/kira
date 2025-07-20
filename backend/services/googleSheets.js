const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsService {
    constructor() {
        this.doc = null;
        this.isInitialized = false;
        this.sheets = {};
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Create JWT auth instance
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
                key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file'
                ],
            });

            // Initialize the spreadsheet
            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SPREADSHEET_ID, serviceAccountAuth);
            await this.doc.loadInfo();

            console.log(`📊 Connected to Google Sheet: ${this.doc.title}`);
            
            // Cache sheet references
            this.sheets = {
                tasks: this.doc.sheetsByTitle['Tasks'] || await this.createTasksSheet(),
                users: this.doc.sheetsByTitle['Users'] || await this.createUsersSheet(),
                sprints: this.doc.sheetsByTitle['Sprints'] || await this.createSprintsSheet(),
                comments: this.doc.sheetsByTitle['Comments'] || await this.createCommentsSheet()
            };

            this.isInitialized = true;
            console.log('✅ Google Sheets service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets service:', error.message);
            throw new Error('Google Sheets initialization failed: ' + error.message);
        }
    }

    async createTasksSheet() {
        console.log('📝 Creating Tasks sheet...');
        const sheet = await this.doc.addSheet({ 
            title: 'Tasks',
            headerValues: [
                'Task ID', 'Task', 'Status', 'Priority', 'Description', 'Due date',
                'Assigned To', 'Type', 'Sprint Points', 'Category', 'Dev Testing Done By',
                'Product Testing Done By', 'Created time', 'Created by', 'Last edited by',
                'Last edited time', 'Sprint Week', 'Further Development Needed',
                'Sprint Spillover Task', 'Message', 'Attachment', 'Year'
            ]
        });
        return sheet;
    }

    async createUsersSheet() {
        console.log('👥 Creating Users sheet...');
        const sheet = await this.doc.addSheet({ 
            title: 'Users',
            headerValues: ['ID', 'Email', 'Name', 'Role', 'Password Hash', 'Created Date', 'Active']
        });
        return sheet;
    }

    async createSprintsSheet() {
        console.log('🏃 Creating Sprints sheet...');
        const sheet = await this.doc.addSheet({ 
            title: 'Sprints',
            headerValues: ['ID', 'Sprint Week', 'Goal', 'Year', 'Status', 'Start Date', 'End Date', 'Created By']
        });
        return sheet;
    }

    async createCommentsSheet() {
        console.log('💬 Creating Comments sheet...');
        const sheet = await this.doc.addSheet({ 
            title: 'Comments',
            headerValues: ['ID', 'Task ID', 'User', 'Comment', 'Timestamp']
        });
        return sheet;
    }

    // Task operations
    async getTasks() {
        await this.initialize();
        const rows = await this.sheets.tasks.getRows();
        
        return rows.map(row => ({
            id: row.get('Task ID'),
            task: row.get('Task'),
            status: row.get('Status'),
            priority: row.get('Priority'),
            description: row.get('Description'),
            dueDate: row.get('Due date'),
            assignedTo: row.get('Assigned To'),
            type: row.get('Type'),
            sprintPoints: parseInt(row.get('Sprint Points')) || 0,
            category: row.get('Category'),
            devTestingDoneBy: row.get('Dev Testing Done By'),
            productTestingDoneBy: row.get('Product Testing Done By'),
            createdTime: row.get('Created time'),
            createdBy: row.get('Created by'),
            lastEditedBy: row.get('Last edited by'),
            lastEditedTime: row.get('Last edited time'),
            sprintWeek: row.get('Sprint Week'),
            furtherDevelopmentNeeded: row.get('Further Development Needed'),
            sprintSpilloverTask: row.get('Sprint Spillover Task'),
            message: row.get('Message'),
            attachment: row.get('Attachment'),
            year: parseInt(row.get('Year')) || new Date().getFullYear() % 100,
            _rowNumber: row.rowNumber
        }));
    }

    async createTask(taskData) {
        await this.initialize();
        
        const taskId = taskData.id || Date.now().toString();
        const timestamp = new Date().toLocaleString();
        
        const newRow = await this.sheets.tasks.addRow({
            'Task ID': taskId,
            'Task': taskData.task,
            'Status': taskData.status || 'Not started',
            'Priority': taskData.priority || 'P2',
            'Description': taskData.description || '',
            'Due date': taskData.dueDate || '',
            'Assigned To': taskData.assignedTo || '',
            'Type': taskData.type || 'Feature',
            'Sprint Points': taskData.sprintPoints || 0,
            'Category': taskData.category || '',
            'Dev Testing Done By': '',
            'Product Testing Done By': '',
            'Created time': timestamp,
            'Created by': taskData.createdBy || 'System',
            'Last edited by': taskData.createdBy || 'System',
            'Last edited time': timestamp,
            'Sprint Week': taskData.sprintWeek || '',
            'Further Development Needed': '',
            'Sprint Spillover Task': taskData.sprintSpilloverTask || 'No',
            'Message': taskData.message || '',
            'Attachment': taskData.attachment || '',
            'Year': taskData.year || new Date().getFullYear() % 100
        });
        
        console.log(`✅ Task created: ${taskData.task}`);
        return { ...taskData, id: taskId };
    }

    async updateTask(taskId, updates) {
        await this.initialize();
        const rows = await this.sheets.tasks.getRows();
        
        const taskRow = rows.find(row => row.get('Task ID') === taskId.toString());
        if (!taskRow) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            const columnName = this.mapFieldToColumn(key);
            if (columnName) {
                taskRow.set(columnName, updates[key]);
            }
        });

        // Always update last edited time
        taskRow.set('Last edited time', new Date().toLocaleString());
        taskRow.set('Last edited by', updates.lastEditedBy || 'System');

        await taskRow.save();
        console.log(`✅ Task updated: ${taskId}`);
        
        return updates;
    }

    async deleteTask(taskId) {
        await this.initialize();
        const rows = await this.sheets.tasks.getRows();
        
        const taskRow = rows.find(row => row.get('Task ID') === taskId.toString());
        if (taskRow) {
            await taskRow.delete();
            console.log(`🗑️ Task deleted: ${taskId}`);
        }
    }

    // User operations
    async getUsers() {
        await this.initialize();
        const rows = await this.sheets.users.getRows();
        
        return rows.map(row => ({
            id: row.get('ID'),
            email: row.get('Email'),
            name: row.get('Name'),
            role: row.get('Role'),
            passwordHash: row.get('Password Hash'),
            createdDate: row.get('Created Date'),
            active: row.get('Active') !== 'false'
        }));
    }

    async createUser(userData) {
        await this.initialize();
        
        const userId = userData.id || Date.now().toString();
        
        await this.sheets.users.addRow({
            'ID': userId,
            'Email': userData.email,
            'Name': userData.name,
            'Role': userData.role || 'Developer',
            'Password Hash': userData.passwordHash,
            'Created Date': new Date().toLocaleString(),
            'Active': 'true'
        });
        
        console.log(`✅ User created: ${userData.email}`);
        return { ...userData, id: userId };
    }

    // Sprint operations
    async getSprints() {
        await this.initialize();
        const rows = await this.sheets.sprints.getRows();
        
        return rows.map(row => ({
            id: row.get('ID'),
            name: row.get('Sprint Week'),
            goal: row.get('Goal'),
            year: parseInt(row.get('Year')) || new Date().getFullYear() % 100,
            status: row.get('Status'),
            startDate: row.get('Start Date'),
            endDate: row.get('End Date'),
            createdBy: row.get('Created By')
        }));
    }

    async createSprint(sprintData) {
        await this.initialize();
        
        const sprintId = sprintData.id || Date.now().toString();
        
        await this.sheets.sprints.addRow({
            'ID': sprintId,
            'Sprint Week': sprintData.name,
            'Goal': sprintData.goal || '',
            'Year': sprintData.year || new Date().getFullYear() % 100,
            'Status': sprintData.status || 'Planning',
            'Start Date': sprintData.startDate || '',
            'End Date': sprintData.endDate || '',
            'Created By': sprintData.createdBy || 'System'
        });
        
        console.log(`✅ Sprint created: ${sprintData.name}`);
        return { ...sprintData, id: sprintId };
    }

    // Comments operations
    async getComments(taskId) {
        await this.initialize();
        const rows = await this.sheets.comments.getRows();
        
        return rows
            .filter(row => row.get('Task ID') === taskId.toString())
            .map(row => ({
                id: row.get('ID'),
                taskId: row.get('Task ID'),
                user: row.get('User'),
                comment: row.get('Comment'),
                timestamp: row.get('Timestamp')
            }));
    }

    async addComment(commentData) {
        await this.initialize();
        
        const commentId = Date.now().toString();
        
        await this.sheets.comments.addRow({
            'ID': commentId,
            'Task ID': commentData.taskId,
            'User': commentData.user,
            'Comment': commentData.comment,
            'Timestamp': new Date().toLocaleString()
        });
        
        return { ...commentData, id: commentId };
    }

    // Helper method to map internal field names to sheet columns
    mapFieldToColumn(fieldName) {
        const mapping = {
            'task': 'Task',
            'status': 'Status',
            'priority': 'Priority',
            'description': 'Description',
            'dueDate': 'Due date',
            'assignedTo': 'Assigned To',
            'type': 'Type',
            'sprintPoints': 'Sprint Points',
            'category': 'Category',
            'sprintWeek': 'Sprint Week',
            'year': 'Year',
            'devTestingDoneBy': 'Dev Testing Done By',
            'productTestingDoneBy': 'Product Testing Done By',
            'furtherDevelopmentNeeded': 'Further Development Needed',
            'sprintSpilloverTask': 'Sprint Spillover Task',
            'message': 'Message',
            'attachment': 'Attachment'
        };
        return mapping[fieldName];
    }

    // Utility method to check connection
    async testConnection() {
        try {
            await this.initialize();
            return { success: true, message: 'Connected to Google Sheets' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = new GoogleSheetsService();
