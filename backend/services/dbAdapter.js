const googleSheets = require('./googleSheets');
const prisma = require('../db/prisma');

function isMysql() {
    return (process.env.DB_TYPE || '').toLowerCase() === 'mysql' && prisma;
}

function formatYear(date) {
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return new Date().getFullYear() % 100;
        return d.getFullYear() % 100;
    } catch (_) {
        return new Date().getFullYear() % 100;
    }
}

// Map Prisma Task -> legacy task shape expected by routes/UI
function mapTaskToLegacy(task) {
    const assignedTo = (task.assignments || [])
        .map(a => a.user?.email)
        .filter(Boolean)
        .join(',');
    const shortId = task.displayId ? `kira-${task.displayId}` : '';
    return {
        id: task.id,
        shortId,
        task: task.title,
        status: mapStatusForLegacy(task.status),
        priority: mapPriorityForLegacy(task.priority),
        description: task.description || '',
        dueDate: task.dueDate ? task.dueDate.toISOString() : '',
        assignedTo,
        type: mapTypeForLegacy(task.type),
        sprintPoints: task.storyPoints || 0,
        category: '',
        devTestingDoneBy: '',
        productTestingDoneBy: '',
        createdTime: task.createdAt?.toISOString?.() || '',
        createdBy: task.createdBy?.email || 'System',
        lastEditedBy: task.updatedBy?.email || 'System',
        lastEditedTime: task.updatedAt?.toISOString?.() || '',
        sprintWeek: task.sprint?.name || '',
        furtherDevelopmentNeeded: '',
        sprintSpilloverTask: 'No',
        message: task.message || '',
        attachment: task.attachment || '',
        slackThreadId: task.slackThreadTs || null,
        slackChannelId: task.slackChannelId || null,
        year: formatYear(task.createdAt)
    };
}

function mapPriorityForLegacy(priority) {
    if (!priority) return 'P2';
    return priority === 'BACKLOG' ? 'Backlog' : priority;
}

function mapTypeForLegacy(type) {
    if (!type) return 'Task';
    const map = {
        Feature: 'Feature',
        Bug: 'Bug',
        Improvement: 'Improvement',
        Task: 'Task'
    };
    return map[type] || 'Task';
}

function mapStatusForLegacy(status) {
    if (!status) return 'Not started';
    const map = {
        PENDING: 'Not started',
        IN_PROGRESS: 'In progress',
        DEV_TESTING: 'Dev Testing',
        PRODUCT_TESTING: 'Product Testing',
        PRODUCT_BLOCKED: 'Blocked - Product',
        ENGG_BLOCKED: 'Blocked - Engineering',
        DONE: 'Done',
        NOT_REQUIRED: 'Not Required'
    };
    return map[status] || status;
}

async function ensureDisplayIdSequenceInitialized() {
    try {
        const count = await prisma.taskSequence.count();
        if (count === 0) {
            // Set starting AUTO_INCREMENT to 111101 so first generated is 111101
            await prisma.$executeRawUnsafe('ALTER TABLE `TaskSequence` AUTO_INCREMENT = 111101');
        }
    } catch (e) {
        // Table might not exist yet during migration; ignore
    }
}

async function getTasks() {
    if (!isMysql()) return googleSheets.getTasks();
    const tasks = await prisma.task.findMany({
        include: {
            sprint: true,
            createdBy: true,
            updatedBy: true,
            assignments: { include: { user: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    return tasks.map(mapTaskToLegacy);
}

// Server-side filtering and pagination
async function getTasksFiltered(params) {
    const {
        status,
        priority,
        type,
        sprint,
        assignee,
        createdFrom,
        createdAfter,
        createdBefore,
        search,
        tags,
        createdBy,
        sort = 'createdAt',
        dir = 'desc',
        page = 1,
        pageSize = 20
    } = params || {};

    if (!isMysql()) {
        // Sheets fallback: in-memory filter
        const all = await googleSheets.getTasks();
        let filtered = all;
        if (status) filtered = filtered.filter(t => String(t.status) === status);
        if (priority) filtered = filtered.filter(t => String(t.priority) === priority);
        if (type) filtered = filtered.filter(t => String(t.type) === type);
        if (sprint) filtered = filtered.filter(t => (t.sprintWeek || '') === sprint);
        if (assignee) filtered = filtered.filter(t => (t.assignedTo || '').toLowerCase().includes(String(assignee).toLowerCase()));
        if (createdFrom) filtered = filtered.filter(t => String(t.createdFrom || '').toLowerCase() === String(createdFrom).toLowerCase());
        if (createdBy) filtered = filtered.filter(t => String(t.createdBy || '').toLowerCase().includes(String(createdBy).toLowerCase()));
        if (tags) {
            const tagList = Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean);
            filtered = filtered.filter(t => {
                const ttags = Array.isArray(t.tags) ? t.tags.map(x=>String(x).toLowerCase()) : String(t.tags||'').toLowerCase();
                return tagList.every(tag => Array.isArray(ttags) ? ttags.includes(tag.toLowerCase()) : ttags.includes(tag.toLowerCase()));
            });
        }
        if (createdAfter) filtered = filtered.filter(t => new Date(t.createdTime) >= new Date(createdAfter));
        if (createdBefore) filtered = filtered.filter(t => new Date(t.createdTime) <= new Date(createdBefore));
        if (search) {
            const s = String(search).toLowerCase();
            filtered = filtered.filter(t => (t.task||'').toLowerCase().includes(s) || (t.description||'').toLowerCase().includes(s) || (t.shortId||'').toLowerCase().includes(s));
        }
        const total = filtered.length;
        // simple sort
        filtered.sort((a, b) => {
            const dirMul = dir === 'asc' ? 1 : -1;
            if (sort === 'priority') return dirMul * String(a.priority).localeCompare(String(b.priority));
            if (sort === 'status') return dirMul * String(a.status).localeCompare(String(b.status));
            const da = new Date(a.createdTime || a.createdAt || 0).getTime();
            const db = new Date(b.createdTime || b.createdAt || 0).getTime();
            return dirMul * (da - db);
        });
        const start = (Number(page) - 1) * Number(pageSize);
        const items = filtered.slice(start, start + Number(pageSize));
        return { items, total };
    }

    // Prisma filtering
    // Note: MySQL connector doesn't support mode: 'insensitive', but utf8mb4_unicode_ci collation is case-insensitive by default
    const where = {};
    if (status) where.status = mapStatusToEnum(status) || status;
    if (priority) where.priority = mapPriorityToEnum(priority) || priority;
    if (type) where.type = mapTypeToEnum(type) || type;
    if (sprint) where.sprint = { is: { name: sprint } };
    if (assignee) where.assignments = { some: { user: { email: { contains: assignee } } } };
    if (createdFrom) where.createdFrom = createdFrom;
    if (createdBy) where.createdBy = { is: { email: createdBy } };
    if (createdAfter || createdBefore) {
        where.createdAt = {};
        if (createdAfter) where.createdAt.gte = new Date(createdAfter);
        if (createdBefore) where.createdAt.lte = new Date(createdBefore);
    }
    if (search) {
        where.OR = [
            { title: { contains: search } },
            { description: { contains: search } },
        ];
    }
    if (tags) {
        const tagList = Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean);
        // Approximate: require each tag to appear in title or description
        where.AND = (where.AND || []).concat(tagList.map(tag => ({ OR: [
            { title: { contains: tag } },
            { description: { contains: tag } }
        ] })));
    }

    const orderBy = {};
    const direction = dir === 'asc' ? 'asc' : 'desc';
    if (['createdAt', 'updatedAt', 'priority', 'status', 'title'].includes(sort)) {
        orderBy[sort] = direction;
    } else {
        orderBy['createdAt'] = 'desc';
    }

    const take = Math.max(1, Math.min(Number(pageSize) || 20, 100));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);

    // Execute count and findMany in parallel
    // Note: count() only accepts 'where' parameter - no select, no mode, no includes
    const [total, tasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
            where,
            include: {
                sprint: true,
                createdBy: true,
                updatedBy: true,
                assignments: { include: { user: true } }
            },
            orderBy,
            skip,
            take
        })
    ]);

    return { items: tasks.map(mapTaskToLegacy), total };
}

async function createTask(taskData) {
    if (!isMysql()) return googleSheets.createTask(taskData);
    // Resolve optional createdBy by email only if it looks like an email
    const createdByRelation = (taskData.createdByEmail && String(taskData.createdByEmail).includes('@'))
        ? { connect: { email: taskData.createdByEmail } }
        : undefined;

    // For now, link sprint only if an explicit sprintId is provided
    const sprintRelation = taskData.sprintId
        ? { connect: { id: taskData.sprintId } }
        : undefined;

    const normalizedStatus = mapStatusToEnum(taskData.status) || 'PENDING';
    const normalizedPriority = mapPriorityToEnum(taskData.priority) || 'BACKLOG';
    const normalizedType = mapTypeToEnum(taskData.type) || 'Task';

    await ensureDisplayIdSequenceInitialized();
    // Generate a new display sequence id
    let displayId = null;
    try {
        const seq = await prisma.taskSequence.create({ data: {} });
        displayId = seq.id;
    } catch (_) {}

    const created = await prisma.task.create({
        data: {
            title: taskData.task,
            description: taskData.description || '',
            status: normalizedStatus,
            priority: normalizedPriority,
            type: normalizedType,
            storyPoints: taskData.sprintPoints || 0,
            tags: Array.isArray(taskData.tags) ? taskData.tags : (taskData.tags ? JSON.stringify(taskData.tags) : undefined),
            sprint: sprintRelation,
            createdBy: createdByRelation,
            slackThreadTs: taskData.slackThreadId || null,
            slackChannelId: taskData.slackChannelId || null,
            displayId: displayId || undefined
        },
        include: { sprint: true, createdBy: true, updatedBy: true, assignments: { include: { user: true } } }
    });
    return mapTaskToLegacy(created);
}

async function updateTask(taskId, updates) {
    if (!isMysql()) return googleSheets.updateTask(taskId, updates);
    const data = {};
    if (updates.task !== undefined) data.title = updates.task;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.status !== undefined) data.status = mapStatusToEnum(updates.status);
    if (updates.priority !== undefined) data.priority = mapPriorityToEnum(updates.priority);
    if (updates.type !== undefined) data.type = mapTypeToEnum(updates.type);
    if (updates.sprintPoints !== undefined) data.storyPoints = updates.sprintPoints;
    if (updates.tags !== undefined) data.tags = Array.isArray(updates.tags) ? updates.tags : (updates.tags ? JSON.stringify(updates.tags) : null);
    
    // Handle sprint linkage - support both sprintId and sprintWeek
    if (updates.sprintId !== undefined) {
        data.sprint = updates.sprintId ? { connect: { id: updates.sprintId } } : { disconnect: true };
    } else if (updates.sprintWeek !== undefined) {
        // Resolve sprintWeek to sprintId
        if (updates.sprintWeek) {
            const sprint = await prisma.sprint.findFirst({ where: { name: updates.sprintWeek } });
            if (sprint) {
                data.sprint = { connect: { id: sprint.id } };
            }
        } else {
            data.sprint = { disconnect: true };
        }
    }
    
    if (updates.dueDate !== undefined) data.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    if (updates.slackThreadId !== undefined) data.slackThreadTs = updates.slackThreadId || null;
    if (updates.slackChannelId !== undefined) data.slackChannelId = updates.slackChannelId || null;
    
    const updated = await prisma.task.update({
        where: { id: taskId },
        data,
        include: { sprint: true, createdBy: true, updatedBy: true, assignments: { include: { user: true } } }
    });
    
    // Handle assignee updates if provided
    if (updates.assignedTo !== undefined) {
        // Clear existing assignments
        await prisma.taskAssignment.deleteMany({ where: { taskId, role: 'Assignee' } });
        
        // Add new assignments if provided
        if (updates.assignedTo) {
            const assigneeEmails = Array.isArray(updates.assignedTo) 
                ? updates.assignedTo 
                : String(updates.assignedTo).split(',').map(e => e.trim()).filter(Boolean);
            
            for (const email of assigneeEmails) {
                const user = await prisma.user.findUnique({ where: { email } });
                if (user) {
                    await prisma.taskAssignment.create({
                        data: {
                            taskId,
                            userId: user.id,
                            role: 'Assignee'
                        }
                    });
                }
            }
        }
    }
    
    // Refetch to include updated assignments
    const refreshed = await prisma.task.findUnique({
        where: { id: taskId },
        include: { sprint: true, createdBy: true, updatedBy: true, assignments: { include: { user: true } } }
    });
    
    return mapTaskToLegacy(refreshed);
}

async function deleteTask(taskId) {
    if (!isMysql()) return googleSheets.deleteTask(taskId);
    await prisma.$transaction([
        prisma.comment.deleteMany({ where: { taskId } }),
        prisma.taskAssignment.deleteMany({ where: { taskId } }),
        prisma.slackThread.deleteMany({ where: { taskId } }),
        prisma.event.deleteMany({ where: { aggregateType: 'Task', aggregateId: taskId } }),
        prisma.activityLog.deleteMany({ where: { entityType: 'Task', entityId: taskId } }),
        prisma.task.delete({ where: { id: taskId } })
    ]);
}

async function getComments(taskId) {
    if (!isMysql()) return googleSheets.getComments(taskId);
    const comments = await prisma.comment.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        include: {
            user: true
        }
    });
    return comments.map(c => ({
        id: c.id,
        taskId: c.taskId,
        user: c.authorName || c.user?.name || c.userId || 'System',
        comment: c.content,
        timestamp: c.createdAt?.toISOString?.() || '',
        slackMessageTs: c.slackTs || '',
        slackChannelId: c.slackChannelId || '',
        source: c.source || 'Web'
    }));
}

async function addComment(commentData) {
    if (!isMysql()) return googleSheets.addComment(commentData);
    // Resolve userId by email if provided; keep null if not resolvable
    let resolvedUser = null;
    if (commentData.userEmail) {
        try {
            resolvedUser = await prisma.user.findUnique({ where: { email: commentData.userEmail } });
        } catch (error) {
            console.error('Error resolving user by email:', error.message);
        }
    }

    // Ensure we have a valid user name
    const authorName = commentData.user || resolvedUser?.name || commentData.userEmail || 'Anonymous';

    const created = await prisma.comment.create({
        data: {
            taskId: commentData.taskId,
            content: commentData.comment,
            source: mapSourceForPrisma(commentData.source),
            slackTs: commentData.slackMessageTs || null,
            slackChannelId: commentData.slackChannelId || null,
            userId: resolvedUser ? resolvedUser.id : null,
            authorName: authorName
        }
    });
    return {
        id: created.id,
        taskId: created.taskId,
        user: created.authorName || created.userId || 'System',
        comment: created.content,
        timestamp: created.createdAt?.toISOString?.() || '',
        slackMessageTs: created.slackTs || '',
        slackChannelId: created.slackChannelId || '',
        source: mapSourceForLegacy(created.source)
    };
}

async function getActivities(taskId) {
    if (!isMysql()) return googleSheets.getActivities(taskId);
    const acts = await prisma.activityLog.findMany({ where: { entityType: 'Task', entityId: taskId }, orderBy: { createdAt: 'desc' } });
    return acts.map(a => ({
        id: a.id,
        taskId: a.entityId,
        user: a.userId || 'System',
        action: a.action,
        details: a.newValues ? JSON.stringify(a.newValues) : a.oldValues ? JSON.stringify(a.oldValues) : '',
        source: a.source || 'Web',
        timestamp: a.createdAt?.toISOString?.() || ''
    }));
}

async function addActivity(activity) {
    if (!isMysql()) return googleSheets.addActivity(activity);
    const created = await prisma.activityLog.create({
        data: {
            entityType: 'Task',
            entityId: activity.taskId,
            userId: null,
            action: activity.action,
            newValues: activity.details ? { details: activity.details } : undefined,
            source: mapSourceForPrisma(activity.source)
        }
    });
    return { ...activity, id: created.id };
}

async function getUsers() {
    if (!isMysql()) return googleSheets.getUsers();
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdDate: u.createdAt?.toISOString?.() || '',
        active: u.isActive
    }));
}

async function createUser(userData) {
    if (!isMysql()) return googleSheets.createUser(userData);
    const created = await prisma.user.create({ data: {
        email: userData.email,
        name: userData.name,
        role: userData.role || 'Developer',
        passwordHash: userData.passwordHash || null,
        isActive: true
    }});
    return { id: created.id, email: created.email, name: created.name, role: created.role };
}

async function updateUser(userId, userData) {
    if (!isMysql()) return googleSheets.updateUser(userId, userData);
    const updated = await prisma.user.update({ where: { id: userId }, data: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        avatarUrl: userData.avatarUrl || undefined,
        isActive: userData.status ? userData.status === 'Active' : undefined
    }});
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.isActive ? 'Active' : 'Inactive' };
}

async function deleteUser(userId) {
    if (!isMysql()) return googleSheets.deleteUser(userId);
    await prisma.user.delete({ where: { id: userId } });
    return true;
}

async function getSprints() {
    if (!isMysql()) return googleSheets.getSprints();
    const sprints = await prisma.sprint.findMany({ orderBy: { createdAt: 'desc' } });
    return sprints.map(s => ({
        id: s.id,
        name: s.name,
        sprintWeek: s.name,
        goal: s.goal || '',
        year: formatYear(s.startDate || s.createdAt || new Date()),
        status: s.status,
        startDate: s.startDate ? s.startDate.toISOString() : '',
        endDate: s.endDate ? s.endDate.toISOString() : '',
        createdBy: s.createdById || 'System',
        isCurrent: !!s.isCurrent
    }));
}

async function createSprint(sprintData) {
    if (!isMysql()) return googleSheets.createSprint(sprintData);
    const created = await prisma.sprint.create({ data: {
        name: sprintData.name,
        week: sprintData.week || 0,
        goal: sprintData.goal || '',
        status: sprintData.status || 'Planned',
        startDate: sprintData.startDate ? new Date(sprintData.startDate) : null,
        endDate: sprintData.endDate ? new Date(sprintData.endDate) : null,
        isCurrent: !!sprintData.isCurrent
    }});
    return {
        id: created.id,
        name: created.name,
        sprintWeek: created.name,
        goal: created.goal || '',
        year: formatYear(created.startDate || created.createdAt || new Date()),
        status: created.status,
        startDate: created.startDate ? created.startDate.toISOString() : '',
        endDate: created.endDate ? created.endDate.toISOString() : '',
        createdBy: created.createdById || 'System',
        isCurrent: !!created.isCurrent
    };
}

async function updateSprint(sprintId, sprintData) {
    if (!isMysql()) return googleSheets.updateSprint(sprintId, sprintData);
    const data = {};
    if (sprintData.name !== undefined) data.name = sprintData.name;
    if (sprintData.goal !== undefined) data.goal = sprintData.goal;
    if (sprintData.status !== undefined) data.status = sprintData.status;
    if (sprintData.startDate !== undefined) data.startDate = sprintData.startDate ? new Date(sprintData.startDate) : null;
    if (sprintData.endDate !== undefined) data.endDate = sprintData.endDate ? new Date(sprintData.endDate) : null;
    if (sprintData.isCurrent !== undefined) data.isCurrent = !!sprintData.isCurrent;
    const updated = await prisma.sprint.update({ where: { id: sprintId }, data });
    return {
        id: updated.id,
        name: updated.name,
        sprintWeek: updated.name,
        goal: updated.goal || '',
        year: formatYear(updated.startDate || updated.createdAt || new Date()),
        status: updated.status,
        startDate: updated.startDate ? updated.startDate.toISOString() : '',
        endDate: updated.endDate ? updated.endDate.toISOString() : '',
        createdBy: updated.createdById || 'System',
        isCurrent: !!updated.isCurrent
    };
}

async function searchTasks(query, limit = 10) {
  if (!isMysql()) {
    const all = await googleSheets.getTasks();
    const s = String(query || '').toLowerCase();
    return all.filter(t => (t.shortId||'').toLowerCase().includes(s) || (t.task||'').toLowerCase().includes(s) || (t.description||'').toLowerCase().includes(s)).slice(0, limit);
  }
  // Note: MySQL utf8mb4_unicode_ci collation is case-insensitive by default, no need for mode
  const where = {
    OR: [
      { title: { contains: query } },
      { description: { contains: query } }
    ]
  };
  const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit) || 10, include: { assignments: { include: { user: true } }, sprint: true, createdBy: true, updatedBy: true } });
  return tasks.map(mapTaskToLegacy);
}

async function deleteTasks(taskIds) {
  if (!isMysql()) {
    for (const id of taskIds) await googleSheets.deleteTask(id);
    return true;
  }
  await prisma.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskAssignment.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.slackThread.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.event.deleteMany({ where: { aggregateType: 'Task', aggregateId: { in: taskIds } } });
    await tx.activityLog.deleteMany({ where: { entityType: 'Task', entityId: { in: taskIds } } });
    await tx.task.deleteMany({ where: { id: { in: taskIds } } });
  });
  return true;
}

async function setTasksStatus(taskIds, newStatus, userName) {
  if (!isMysql()) {
    for (const id of taskIds) await googleSheets.updateTask(id, { status: newStatus, lastEditedBy: userName || 'System' });
    return true;
  }
  await prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { status: newStatus } });
  // Log activity
  for (const id of taskIds) {
    await prisma.activityLog.create({ data: { entityType: 'Task', entityId: id, userId: null, action: 'status_changed', newValues: { status: newStatus }, source: 'Web' } });
  }
  return true;
}

async function assignTasksToUser(taskIds, userEmail, assignedByEmail) {
  if (!isMysql()) {
    for (const id of taskIds) await googleSheets.updateTask(id, { assignedTo: userEmail, lastEditedBy: assignedByEmail || 'System' });
    return true;
  }
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const assignedBy = assignedByEmail ? await prisma.user.findUnique({ where: { email: assignedByEmail } }) : null;
  if (!user) throw new Error('Assignee user not found');

  for (const id of taskIds) {
    // Upsert assignment as Assignee
    await prisma.taskAssignment.upsert({
      where: { taskId_userId_role: { taskId: id, userId: user.id, role: 'Assignee' } },
      update: { assignedById: assignedBy?.id || null },
      create: { taskId: id, userId: user.id, role: 'Assignee', assignedById: assignedBy?.id || null }
    });
    await prisma.activityLog.create({ data: { entityType: 'Task', entityId: id, userId: assignedBy?.id || null, action: 'assigned', newValues: { assignee: userEmail }, source: 'Web' } });
  }
  return true;
}

function mapStatusToEnum(status) {
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

function mapPriorityToEnum(priority) {
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

function mapTypeToEnum(type) {
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

function mapSourceForLegacy(source) {
    if (!source) return 'web';
    return source.toLowerCase();
}

function mapSourceForPrisma(source) {
    if (!source) return 'Web';
    const value = source.toLowerCase();
    if (value === 'slack') return 'Slack';
    return 'Web';
}

module.exports = {
    // Tasks
    getTasks,
    getTasksFiltered,
    searchTasks,
    createTask,
    updateTask,
    deleteTask,
    deleteTasks,
    setTasksStatus,
    assignTasksToUser,
    getComments,
    addComment,
    getActivities,
    addActivity,
    // Users
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    // Sprints
    getSprints,
    createSprint,
    updateSprint
};


