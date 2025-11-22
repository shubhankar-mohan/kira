const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = require('../services/dbAdapter');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Creating awesome demo data for Kira Task Manager...');

    // Create demo users with fun personalities
    const adminPassword = await bcrypt.hash('admin123', 10);
    const managerPassword = await bcrypt.hash('manager123', 10);
    const devPassword = await bcrypt.hash('dev123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            name: 'Nidhi',
            role: 'Admin',
            passwordHash: adminPassword,
            isActive: true
        }
    });

    const manager = await prisma.user.upsert({
        where: { email: 'manager@example.com' },
        update: {},
        create: {
            email: 'manager@example.com',
            name: 'Kanisk',
            role: 'Manager',
            passwordHash: managerPassword,
            isActive: true
        }
    });

    const dev1 = await prisma.user.upsert({
        where: { email: 'dev@example.com' },
        update: {},
        create: {
            email: 'dev@example.com',
            name: 'Shubhankar',
            role: 'Developer',
            passwordHash: devPassword,
            isActive: true
        }
    });

    const dev2 = await prisma.user.create({
        data: {
            email: 'yash@example.com',
            name: 'Yash',
            role: 'Developer',
            passwordHash: devPassword,
            isActive: true
        }
    });

    const dev3 = await prisma.user.create({
        data: {
            email: 'siddharth@example.com',
            name: 'Siddharth',
            role: 'Developer',
            passwordHash: devPassword,
            isActive: true
        }
    });

    const dev4 = await prisma.user.create({
        data: {
            email: 'punam@example.com',
            name: 'Punam',
            role: 'Developer',
            passwordHash: devPassword,
            isActive: true
        }
    });

    console.log('✅ Created demo users');

    // Create meaningful sprints
    const currentSprint = await prisma.sprint.create({
        data: {
            name: 'Chai & Code Sprint',
            week: 47,
            status: 'Active',
            goal: 'Ship the MVP that makes users say "Kya baat hai!" ☕️',
            description: 'Focus on core features and user experience, fueled by chai breaks',
            isCurrent: true,
            startDate: new Date('2025-11-15'),
            endDate: new Date('2025-11-29'),
            createdById: manager.id
        }
    });

    const upcomingSprint = await prisma.sprint.create({
        data: {
            name: 'Diwali Dhamaka Release',
            week: 48,
            status: 'Planned',
            goal: 'Light up the product like Diwali diyas 🪔',
            description: 'Bug fixes, performance optimizations, and festive features',
            isCurrent: false,
            startDate: new Date('2025-12-01'),
            endDate: new Date('2025-12-15'),
            createdById: manager.id
        }
    });

    const completedSprint = await prisma.sprint.create({
        data: {
            name: 'Nayi Shururat (New Beginning)',
            week: 46,
            status: 'Completed',
            goal: 'Build the foundation like constructing a strong mandap 🏗️',
            description: 'Database setup, authentication, and basic task management',
            isCurrent: false,
            startDate: new Date('2025-11-01'),
            endDate: new Date('2025-11-14'),
            createdById: manager.id
        }
    });

    console.log('✅ Created demo sprints');

    // Create fun and meaningful tasks
    const tasks = [
        // Current Sprint Tasks
        {
            title: '🔐 Implement "Remember Me" login feature',
            description: 'Add a checkbox that saves login state for developers who are tired of typing passwords after every chai break',
            status: 'IN_PROGRESS',
            priority: 'P1',
            type: 'Feature',
            sprintId: currentSprint.id,
            storyPoints: 5,
            orderIndex: 1,
            createdById: manager.id,
            dueDate: new Date('2025-11-20')
        },
        {
            title: '🎨 Make the task board prettier than a Bollywood set',
            description: 'Add drag & drop animations, smooth transitions, and maybe some rangoli patterns ✨',
            status: 'DONE',
            priority: 'P2',
            type: 'Improvement',
            sprintId: currentSprint.id,
            storyPoints: 3,
            orderIndex: 2,
            createdById: dev1.id,
            completedAt: new Date('2025-11-12')
        },
        {
            title: '🚀 Add rocket-speed task search',
            description: 'Users should find tasks faster than finding good street food in Mumbai',
            status: 'PENDING',
            priority: 'P1',
            type: 'Feature',
            sprintId: currentSprint.id,
            storyPoints: 8,
            orderIndex: 3,
            createdById: admin.id,
            dueDate: new Date('2025-11-25')
        },
        {
            title: '🐛 Fix the bug that makes tasks disappear like magic',
            description: 'Sometimes tasks vanish like the last samosa in the office. Need to investigate this jadoo.',
            status: 'DEV_TESTING',
            priority: 'P0',
            type: 'Bug',
            sprintId: currentSprint.id,
            storyPoints: 13,
            orderIndex: 4,
            createdById: dev2.id,
            dueDate: new Date('2025-11-18')
        },
        {
            title: '📱 Mobile responsiveness: jugaad for small screens',
            description: 'Make the app work on devices smaller than a laptop. Even uncle\'s Android phone should work!',
            status: 'PRODUCT_TESTING',
            priority: 'P1',
            type: 'Feature',
            sprintId: currentSprint.id,
            storyPoints: 5,
            orderIndex: 5,
            createdById: dev3.id
        },
        {
            title: '⚡ Optimize database queries (slower than Mumbai traffic)',
            description: 'Current queries are so slow, users have time to make chai and read the newspaper while waiting',
            status: 'DONE',
            priority: 'P0',
            type: 'Improvement',
            sprintId: currentSprint.id,
            storyPoints: 8,
            orderIndex: 6,
            createdById: dev1.id,
            completedAt: new Date('2025-11-15')
        },

        // Upcoming Sprint Tasks
        {
            title: '🪔 Add Diwali theme for festive season',
            description: 'Diya animations, festive colors, and maybe some firework effects for the celebration',
            status: 'PENDING',
            priority: 'P2',
            type: 'Feature',
            sprintId: upcomingSprint.id,
            storyPoints: 3,
            orderIndex: 1,
            createdById: dev2.id
        },
        {
            title: '📊 Create analytics dashboard that actually makes sense',
            description: 'Show pretty charts that managers will screenshot for their presentations',
            status: 'PENDING',
            priority: 'P1',
            type: 'Feature',
            sprintId: upcomingSprint.id,
            storyPoints: 13,
            orderIndex: 2,
            createdById: manager.id
        },

        // Completed Sprint Tasks
        {
            title: '🗄️ Set up database (aka digital filing cabinet)',
            description: 'Create a place where our data can live, grow, and occasionally cause headaches',
            status: 'DONE',
            priority: 'P0',
            type: 'Task',
            sprintId: completedSprint.id,
            storyPoints: 8,
            orderIndex: 1,
            createdById: admin.id,
            completedAt: new Date('2025-11-03')
        },
        {
            title: '🔑 Build authentication system',
            description: 'So we know who\'s who and prevent chaos. Democracy is great, but not in our database.',
            status: 'DONE',
            priority: 'P0',
            type: 'Feature',
            sprintId: completedSprint.id,
            storyPoints: 13,
            orderIndex: 2,
            createdById: dev1.id,
            completedAt: new Date('2025-11-08')
        },

        // Backlog Items
        {
            title: '🤖 AI assistant that does everything (except make coffee)',
            description: 'Create an AI that helps with task management, predicts deadlines, and occasionally tells jokes',
            status: 'PENDING',
            priority: 'BACKLOG',
            type: 'Feature',
            storyPoints: 21,
            orderIndex: 1,
            createdById: dev3.id
        },
        {
            title: '🌙 Dark mode for night owl developers',
            description: 'Save the eyes of developers who code at 2 AM questioning their life choices',
            status: 'PENDING',
            priority: 'BACKLOG',
            type: 'Feature',
            storyPoints: 5,
            orderIndex: 2,
            createdById: dev2.id
        }
    ];

    // Create tasks using proper createTask function to get display IDs
    const createdTasks = [];
    for (const taskData of tasks) {
        // Convert our data format to the format expected by createTask
        const createTaskData = {
            task: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            type: taskData.type,
            sprintPoints: taskData.storyPoints,
            sprintId: taskData.sprintId,
            createdByEmail: taskData.createdById ? (await prisma.user.findUnique({ where: { id: taskData.createdById } }))?.email : undefined,
            dueDate: taskData.dueDate
        };

        const task = await db.createTask(createTaskData);
        createdTasks.push(task);

        // Assign tasks to users
        if (task.status !== 'Not started') {
            const developers = [dev1.id, dev2.id, dev3.id, dev4.id];
            const assignees = [
                { taskId: task.id, userId: developers[Math.floor(Math.random() * developers.length)], role: 'Assignee' },
                { taskId: task.id, userId: developers[Math.floor(Math.random() * developers.length)], role: 'Reviewer' }
            ];

            // Sometimes add admin as watcher
            if (Math.random() > 0.7) {
                assignees.push({ taskId: task.id, userId: admin.id, role: 'Watcher' });
            }

            for (const assignment of assignees) {
                await prisma.taskAssignment.create({
                    data: {
                        ...assignment,
                        assignedById: manager.id
                    }
                });
            }
        }
    }

    console.log('✅ Created demo tasks');

    // Add realistic and funny comments with Indian context
    const comments = [
        {
            taskId: createdTasks[0].id, // Remember Me feature
            content: 'Started working on this. The irony is I keep forgetting to implement the remember me feature 😅 Abhi chai break ke baad karunga!',
            userId: dev1.id, // Shubhankar
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[0].id,
            content: 'Added the checkbox UI. Now working on the backend logic. Should be done by EOD! 🤞',
            userId: dev2.id, // Yash
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[1].id, // Prettier task board
            content: 'Wah bhai! This looks amazing! The animations are so smooth. Kya baat hai! 🎉',
            userId: manager.id, // Kanisk
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[1].id,
            content: 'Thanks yaar! Added some CSS magic and a sprinkle of JavaScript masala ✨',
            userId: dev4.id, // Punam
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[3].id, // Bug fix
            content: 'Found the issue! Turns out the jadoo was actually a missing semicolon. Classic JavaScript ka drama 🎭',
            userId: dev3.id, // Siddharth
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[3].id,
            content: 'Arrey yaar! Of course it was a semicolon. Why is it always a semicolon? 😤',
            userId: dev2.id, // Yash
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[4].id, // Mobile responsiveness
            content: 'Testing on papa\'s phone... looks good! Even on uncle\'s 5-year-old Samsung it works 📱',
            userId: admin.id, // Nidhi
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[5].id, // Database optimization
            content: 'Performance improved by 2000%! Database queries now faster than Delhi Metro! 🚇',
            userId: dev1.id, // Shubhankar
            commentType: 'Comment'
        },
        {
            taskId: createdTasks[5].id,
            content: 'Shabash! This is why we pay you the big bucks (in samosas and cutting chai) 🥟☕',
            userId: manager.id, // Kanisk
            commentType: 'Comment'
        }
    ];

    for (const commentData of comments) {
        await prisma.comment.create({
            data: {
                ...commentData,
                source: 'Web'
            }
        });
    }

    console.log('✅ Created demo comments');

    // Add some activity logs
    const activities = [
        {
            entityType: 'Task',
            entityId: createdTasks[1].id,
            userId: dev1.id,
            action: 'status_changed',
            oldValues: { status: 'IN_PROGRESS' },
            newValues: { status: 'DONE' },
            source: 'Web'
        },
        {
            entityType: 'Task',
            entityId: createdTasks[5].id,
            userId: dev1.id,
            action: 'status_changed',
            oldValues: { status: 'IN_PROGRESS' },
            newValues: { status: 'DONE' },
            source: 'Web'
        },
        {
            entityType: 'Task',
            entityId: createdTasks[0].id,
            userId: manager.id,
            action: 'assigned',
            newValues: { assignee: 'dev@example.com' },
            source: 'Web'
        }
    ];

    for (const activityData of activities) {
        await prisma.activityLog.create({
            data: activityData
        });
    }

    console.log('✅ Created demo activities');
    console.log('🎉 Demo data creation complete! Ready for screenshots!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${await prisma.user.count()}`);
    console.log(`   🏃 Sprints: ${await prisma.sprint.count()}`);
    console.log(`   📋 Tasks: ${await prisma.task.count()}`);
    console.log(`   💬 Comments: ${await prisma.comment.count()}`);
    console.log('');
    console.log('👥 Your Indian Startup Team:');
    console.log('   🔑 Nidhi (Admin): admin@example.com / admin123');
    console.log('   👨‍💼 Kanisk (Manager): manager@example.com / manager123');
    console.log('   👨‍💻 Shubhankar (Developer): dev@example.com / dev123');
    console.log('   👨‍💻 Yash (Developer): yash@example.com / dev123');
    console.log('   👨‍💻 Siddharth (Developer): siddharth@example.com / dev123');
    console.log('   👩‍💻 Punam (Developer): punam@example.com / dev123');
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });