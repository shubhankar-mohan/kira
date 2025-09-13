const googleSheetsService = require('./googleSheets');

class ScrumMasterFeatures {
    constructor(slackClient) {
        this.client = slackClient;
        this.burndownData = new Map(); // Cache for burndown calculations
        this.teamMetrics = new Map(); // Cache for team performance metrics
        this.cache = new Map(); // General purpose cache
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
    }

    // Cache utility methods
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache(keyPattern = null) {
        if (keyPattern) {
            // Clear specific pattern
            for (const key of this.cache.keys()) {
                if (key.includes(keyPattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // Clear all cache
            this.cache.clear();
        }
    }

    // Advanced burndown chart analysis with predictive alerts
    async generateBurndownAnalysis(sprintName) {
        try {
            // Check cache first
            const cacheKey = `burndown-${sprintName}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            
            if (!sprintName) {
                // If no sprint specified, use active sprint
                const activeSprint = sprints.find(s => s.status === 'Active');
                if (!activeSprint) {
                    throw new Error('No active sprint found and no sprint specified');
                }
                sprintName = activeSprint.name;
            }
            
            // Allow analysis of any sprint (active, completed, or planned)
            const sprint = sprints.find(s => s.name === sprintName);
            if (!sprint) {
                throw new Error(`Sprint '${sprintName}' not found`);
            }

            const sprintTasks = tasks.filter(t => t.sprintWeek === sprintName);
            if (sprintTasks.length === 0) {
                console.warn(`No tasks found for sprint: ${sprintName}`);
            }
            
            const analysis = this.calculateBurndownMetrics(sprintTasks, sprint);
            analysis.sprintName = sprintName;
            analysis.sprintStatus = sprint.status;
            analysis.totalTasks = sprintTasks.length;
            
            // Cache the result
            this.setCachedData(cacheKey, analysis);
            
            return analysis;
        } catch (error) {
            console.error('Error generating burndown analysis:', error);
            return null;
        }
    }

    calculateBurndownMetrics(tasks, sprint) {
        // Input validation
        if (!tasks || !Array.isArray(tasks)) {
            throw new Error('Invalid tasks array provided');
        }
        if (!sprint || !sprint.startDate || !sprint.endDate) {
            throw new Error('Invalid sprint data provided');
        }

        const totalPoints = tasks.reduce((sum, task) => sum + Math.max(0, task.sprintPoints || 0), 0);
        const completedPoints = tasks
            .filter(t => t.status === 'DONE')
            .reduce((sum, task) => sum + Math.max(0, task.sprintPoints || 0), 0);
        
        const startDate = new Date(sprint.startDate);
        const endDate = new Date(sprint.endDate);
        const now = new Date();
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid sprint dates');
        }
        if (endDate <= startDate) {
            throw new Error('Sprint end date must be after start date');
        }
        
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.max(0, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
        const remainingDays = Math.max(0, totalDays - elapsedDays);
        
        // Safe mathematical operations with division by zero checks
        const idealProgressRate = totalDays > 0 ? totalPoints / totalDays : 0;
        const actualProgressRate = elapsedDays > 0 ? completedPoints / elapsedDays : 0;
        const expectedPointsCompleted = idealProgressRate * elapsedDays;
        
        // Predictive analysis with safety checks
        let projectedCompletion = Infinity;
        let isOnTrack = false;
        let velocityTrend = 0;
        
        if (actualProgressRate > 0 && totalPoints > 0) {
            projectedCompletion = Math.ceil(totalPoints / actualProgressRate);
            isOnTrack = projectedCompletion <= totalDays;
        } else if (totalPoints === 0) {
            // No work to do
            projectedCompletion = 0;
            isOnTrack = true;
        }
        
        if (idealProgressRate > 0) {
            velocityTrend = actualProgressRate / idealProgressRate;
        }
        
        // Safe percentage calculations
        const completionPercentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100 * 100) / 100 : 0;
        const timeElapsedPercentage = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100 * 100) / 100 : 0;

        return {
            totalPoints,
            completedPoints,
            remainingPoints: Math.max(0, totalPoints - completedPoints),
            totalDays,
            elapsedDays,
            remainingDays,
            idealProgressRate,
            actualProgressRate,
            expectedPointsCompleted,
            actualVsExpected: completedPoints - expectedPointsCompleted,
            projectedCompletion,
            isOnTrack,
            velocityTrend,
            completionPercentage,
            timeElapsedPercentage
        };
    }

    // Team workload analysis and balancing recommendations
    async analyzeTeamWorkload() {
        try {
            const tasks = await googleSheetsService.getTasks();
            const users = await googleSheetsService.getUsers();
            const sprints = await googleSheetsService.getSprints();
            
            const activeSprint = sprints.find(s => s.status === 'Active');
            if (!activeSprint) return null;

            const workloadAnalysis = this.calculateTeamWorkload(tasks, users, activeSprint);
            return workloadAnalysis;
        } catch (error) {
            console.error('Error analyzing team workload:', error);
            return null;
        }
    }

    calculateTeamWorkload(tasks, users, sprint) {
        const sprintTasks = tasks.filter(t => t.sprintWeek === sprint.name);
        const workloadByUser = new Map();
        
        // Initialize workload for all users
        users.forEach(user => {
            workloadByUser.set(user.email, {
                name: user.name,
                email: user.email,
                role: user.role,
                totalTasks: 0,
                totalPoints: 0,
                completedTasks: 0,
                completedPoints: 0,
                inProgressTasks: 0,
                blockedTasks: 0,
                workloadScore: 0,
                efficiency: 0
            });
        });

        // Calculate workload metrics
        sprintTasks.forEach(task => {
            const assignees = task.assignedTo ? task.assignedTo.split(',').map(a => a.trim()) : [];
            const pointsPerAssignee = (task.sprintPoints || 0) / Math.max(1, assignees.length);
            
            assignees.forEach(assignee => {
                const userWorkload = workloadByUser.get(assignee);
                if (userWorkload) {
                    userWorkload.totalTasks++;
                    userWorkload.totalPoints += pointsPerAssignee;
                    
                    if (task.status === 'DONE') {
                        userWorkload.completedTasks++;
                        userWorkload.completedPoints += pointsPerAssignee;
                    } else if (task.status === 'IN_PROGRESS') {
                        userWorkload.inProgressTasks++;
                    } else if (task.status === 'BLOCKED') {
                        userWorkload.blockedTasks++;
                    }
                }
            });
        });

        // Calculate workload scores and efficiency
        const workloadArray = Array.from(workloadByUser.values());
        workloadArray.forEach(user => {
            user.workloadScore = user.totalPoints + (user.totalTasks * 0.5);
            user.efficiency = user.totalTasks > 0 ? (user.completedTasks / user.totalTasks) : 0;
        });

        // Identify imbalances
        const avgWorkload = workloadArray.reduce((sum, user) => sum + user.workloadScore, 0) / workloadArray.length;
        const overloadedUsers = workloadArray.filter(user => user.workloadScore > avgWorkload * 1.5);
        const underloadedUsers = workloadArray.filter(user => user.workloadScore < avgWorkload * 0.5);
        
        return {
            users: workloadArray,
            averageWorkload: avgWorkload,
            overloadedUsers,
            underloadedUsers,
            recommendations: this.generateWorkloadRecommendations(overloadedUsers, underloadedUsers)
        };
    }

    generateWorkloadRecommendations(overloaded, underloaded) {
        const recommendations = [];
        
        if (overloaded.length > 0) {
            recommendations.push({
                type: 'redistribute',
                priority: 'high',
                message: `Consider redistributing tasks from overloaded team members: ${overloaded.map(u => u.name).join(', ')}`
            });
        }
        
        if (underloaded.length > 0 && overloaded.length > 0) {
            recommendations.push({
                type: 'rebalance',
                priority: 'medium',
                message: `Available capacity detected. Consider moving tasks from ${overloaded[0]?.name} to ${underloaded[0]?.name}`
            });
        }
        
        if (underloaded.length > 0) {
            recommendations.push({
                type: 'capacity',
                priority: 'low',
                message: `Team members with available capacity: ${underloaded.map(u => u.name).join(', ')}`
            });
        }
        
        return recommendations;
    }

    // Code review reminder system
    async generateCodeReviewReminders() {
        try {
            const tasks = await googleSheetsService.getTasks();
            const reviewTasks = tasks.filter(t => 
                t.status === 'IN_PROGRESS' && 
                t.type === 'Feature' &&
                t.devTestingDoneBy && 
                !t.productTestingDoneBy
            );

            if (reviewTasks.length === 0) return null;

            const reminderBlocks = this.buildCodeReviewReminderBlocks(reviewTasks);
            
            await this.client.chat.postMessage({
                channel: process.env.SLACK_DEV_CHANNEL || '#development',
                blocks: reminderBlocks
            });

            return reviewTasks.length;
        } catch (error) {
            console.error('Error generating code review reminders:', error);
            return null;
        }
    }

    buildCodeReviewReminderBlocks(reviewTasks) {
        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '👨‍💻 Code Review Reminders'
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${reviewTasks.length} tasks* are waiting for code review:`
                }
            }
        ];

        reviewTasks.slice(0, 5).forEach(task => { // Limit to 5 tasks to avoid message limits
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `• *${task.task}*\n  Dev tested by: ${task.devTestingDoneBy}\n  Assigned to: ${task.assignedTo}`
                }
            });
        });

        if (reviewTasks.length > 5) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `_...and ${reviewTasks.length - 5} more tasks_`
                }
            });
        }

        return blocks;
    }

    // Retrospective data collection
    async generateRetrospectiveData(sprintName) {
        try {
            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            const comments = await this.getAllComments(tasks);
            
            const sprint = sprints.find(s => s.name === sprintName);
            if (!sprint) return null;

            const sprintTasks = tasks.filter(t => t.sprintWeek === sprintName);
            const retrospectiveData = this.analyzeSprintForRetrospective(sprintTasks, comments, sprint);
            
            return retrospectiveData;
        } catch (error) {
            console.error('Error generating retrospective data:', error);
            return null;
        }
    }

    async getAllComments(tasks) {
        if (!tasks || !Array.isArray(tasks)) {
            return [];
        }

        const allComments = [];
        const maxConcurrency = 5; // Limit concurrent API calls
        const chunks = [];
        
        // Split tasks into chunks for better performance
        for (let i = 0; i < tasks.length; i += maxConcurrency) {
            chunks.push(tasks.slice(i, i + maxConcurrency));
        }
        
        try {
            // Process chunks sequentially, tasks within chunk concurrently
            for (const chunk of chunks) {
                const promises = chunk.map(async (task) => {
                    if (!task || !task.id) {
                        console.warn('Invalid task object:', task);
                        return [];
                    }
                    
                    try {
                        const taskComments = await googleSheetsService.getComments(task.id);
                        return Array.isArray(taskComments) ? taskComments : [];
                    } catch (error) {
                        console.error(`Error getting comments for task ${task.id}:`, error);
                        return []; // Return empty array on error, don't fail entire operation
                    }
                });
                
                const chunkResults = await Promise.allSettled(promises);
                
                chunkResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        allComments.push(...result.value);
                    } else {
                        console.error(`Failed to get comments for task ${chunk[index]?.id}:`, result.reason);
                    }
                });
                
                // Small delay between chunks to avoid API rate limits
                if (chunks.indexOf(chunk) < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('Error in getAllComments batch processing:', error);
        }
        
        return allComments;
    }

    analyzeSprintForRetrospective(tasks, comments, sprint) {
        const metrics = {
            sprintName: sprint.name,
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'DONE').length,
            blockedTasks: tasks.filter(t => t.status === 'BLOCKED').length,
            spilloverTasks: tasks.filter(t => t.sprintSpilloverTask === 'Yes').length,
            totalPoints: tasks.reduce((sum, t) => sum + (t.sprintPoints || 0), 0),
            completedPoints: tasks.filter(t => t.status === 'DONE').reduce((sum, t) => sum + (t.sprintPoints || 0), 0)
        };

        // Analyze task types and patterns
        const taskTypeAnalysis = this.analyzeTaskTypes(tasks);
        const blockageAnalysis = this.analyzeBlockages(tasks, comments);
        const velocityTrend = this.calculateVelocityTrend(metrics);
        
        return {
            metrics,
            taskTypeAnalysis,
            blockageAnalysis,
            velocityTrend,
            recommendations: this.generateRetrospectiveRecommendations(metrics, taskTypeAnalysis, blockageAnalysis)
        };
    }

    analyzeTaskTypes(tasks) {
        const typeBreakdown = {};
        const priorityBreakdown = {};
        
        tasks.forEach(task => {
            typeBreakdown[task.type] = (typeBreakdown[task.type] || 0) + 1;
            priorityBreakdown[task.priority] = (priorityBreakdown[task.priority] || 0) + 1;
        });
        
        return { typeBreakdown, priorityBreakdown };
    }

    analyzeBlockages(tasks, comments) {
        const blockedTasks = tasks.filter(t => t.status === 'BLOCKED');
        const blockageReasons = [];
        
        // Try to extract blockage reasons from comments
        blockedTasks.forEach(task => {
            const taskComments = comments.filter(c => c.taskId === task.id);
            const blockageComments = taskComments.filter(c => 
                c.comment.toLowerCase().includes('blocked') || 
                c.comment.toLowerCase().includes('waiting') ||
                c.comment.toLowerCase().includes('dependency')
            );
            
            if (blockageComments.length > 0) {
                blockageReasons.push({
                    taskId: task.id,
                    taskTitle: task.task,
                    reasons: blockageComments.map(c => c.comment)
                });
            }
        });
        
        return {
            totalBlocked: blockedTasks.length,
            blockageReasons,
            averageBlockageTime: this.calculateAverageBlockageTime(blockedTasks)
        };
    }

    calculateAverageBlockageTime(blockedTasks) {
        // This would require timestamp analysis - simplified for now
        return blockedTasks.length > 0 ? '2.5 days' : '0 days';
    }

    calculateVelocityTrend(metrics) {
        const completionRate = metrics.totalTasks > 0 ? (metrics.completedTasks / metrics.totalTasks) : 0;
        const pointsCompletionRate = metrics.totalPoints > 0 ? (metrics.completedPoints / metrics.totalPoints) : 0;
        
        return {
            taskCompletionRate: Math.round(completionRate * 100),
            pointsCompletionRate: Math.round(pointsCompletionRate * 100),
            velocity: metrics.completedPoints,
            predictedVelocity: metrics.totalPoints // Simplified prediction
        };
    }

    generateRetrospectiveRecommendations(metrics, taskTypes, blockages) {
        const recommendations = [];
        
        if (metrics.completedTasks / metrics.totalTasks < 0.8) {
            recommendations.push({
                category: 'Sprint Planning',
                suggestion: 'Consider reducing sprint scope - completion rate below 80%',
                priority: 'high'
            });
        }
        
        if (blockages.totalBlocked > metrics.totalTasks * 0.2) {
            recommendations.push({
                category: 'Process Improvement',
                suggestion: 'High number of blocked tasks - review dependency management',
                priority: 'high'
            });
        }
        
        if (metrics.spilloverTasks > 0) {
            recommendations.push({
                category: 'Estimation',
                suggestion: 'Review task estimation accuracy - multiple spillovers detected',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }

    // Release planning coordination
    async generateReleasePlan(version, targetDate) {
        try {
            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            
            const releaseTasks = tasks.filter(t => 
                t.type === 'Feature' && 
                (t.status === 'DONE' || t.status === 'IN_PROGRESS')
            );
            
            const planBlocks = this.buildReleasePlanBlocks(releaseTasks, version, targetDate);
            
            await this.client.chat.postMessage({
                channel: process.env.SLACK_RELEASES_CHANNEL || '#releases',
                blocks: planBlocks
            });
            
            return releaseTasks.length;
        } catch (error) {
            console.error('Error generating release plan:', error);
            return null;
        }
    }

    buildReleasePlanBlocks(tasks, version, targetDate) {
        const completedFeatures = tasks.filter(t => t.status === 'DONE');
        const inProgressFeatures = tasks.filter(t => t.status === 'IN_PROGRESS');
        
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🚀 Release Plan - ${version}`
                }
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Target Date:* ${targetDate}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Total Features:* ${tasks.length}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Completed:* ${completedFeatures.length}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*In Progress:* ${inProgressFeatures.length}`
                    }
                ]
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Release Readiness:* ${Math.round((completedFeatures.length / tasks.length) * 100)}%`
                }
            }
        ];
    }

    // Weekly sprint summary
    async generateWeeklySprintSummary() {
        try {
            const tasks = await googleSheetsService.getTasks();
            const sprints = await googleSheetsService.getSprints();
            const workloadAnalysis = await this.analyzeTeamWorkload();
            
            const activeSprint = sprints.find(s => s.status === 'Active');
            if (!activeSprint) return;

            const burndownAnalysis = await this.generateBurndownAnalysis(activeSprint.name);
            const summaryBlocks = this.buildWeeklySummaryBlocks(activeSprint, burndownAnalysis, workloadAnalysis);
            
            await this.client.chat.postMessage({
                channel: process.env.SLACK_REPORTS_CHANNEL || '#sprint-reports',
                blocks: summaryBlocks
            });
            
        } catch (error) {
            console.error('Error generating weekly sprint summary:', error);
        }
    }

    buildWeeklySummaryBlocks(sprint, burndown, workload) {
        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `📊 Weekly Sprint Summary - ${sprint.name}`
                }
            }
        ];

        if (burndown) {
            blocks.push({
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Progress:* ${Math.round(burndown.completionPercentage)}%`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Time Elapsed:* ${Math.round(burndown.timeElapsedPercentage)}%`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Velocity Trend:* ${burndown.velocityTrend >= 1 ? '📈' : '📉'} ${Math.round(burndown.velocityTrend * 100)}%`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*On Track:* ${burndown.isOnTrack ? '✅' : '⚠️'}`
                    }
                ]
            });
        }

        if (workload && workload.recommendations.length > 0) {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Team Workload Recommendations:*\n${workload.recommendations.map(r => `• ${r.message}`).join('\n')}`
                }
            });
        }

        return blocks;
    }
}

module.exports = ScrumMasterFeatures;