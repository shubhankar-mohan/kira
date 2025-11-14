const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { getEmailDomain } = require('../config/appConfig');
const prisma = new PrismaClient();

async function main() {
  const emailDomain = getEmailDomain();
  const adminEmail = process.env.SEED_ADMIN_EMAIL || `admin@${emailDomain}`;
  const adminName = process.env.SEED_ADMIN_NAME || 'Admin';

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, isActive: true, role: 'Admin' },
    create: { email: adminEmail, name: adminName, isActive: true, role: 'Admin' }
  });

  // Upsert demo login accounts shown on the login page
  const demoUsers = [
    { email: `admin@${emailDomain}`, name: 'Admin', role: 'Admin', password: 'admin123' },
    { email: `manager@${emailDomain}`, name: 'Manager', role: 'Manager', password: 'manager123' },
    { email: `dev@${emailDomain}`, name: 'Developer', role: 'Developer', password: 'dev123' }
  ];

  for (const du of demoUsers) {
    const passwordHash = await bcrypt.hash(du.password, 10);
    await prisma.user.upsert({
      where: { email: du.email },
      update: { name: du.name, role: du.role, isActive: true, passwordHash },
      create: { email: du.email, name: du.name, role: du.role, isActive: true, passwordHash }
    });
  }

  // Create an initial sprint if none exists
  const sprintCount = await prisma.sprint.count();
  if (sprintCount === 0) {
    await prisma.sprint.create({
      data: {
        name: 'Sprint 1',
        week: 1,
        status: 'Planned',
        goal: 'Initial setup',
        isCurrent: true,
        createdById: admin.id
      }
    });
  }

  // Create a sample task if none exists
  const taskCount = await prisma.task.count();
  if (taskCount === 0) {
    const sprint = await prisma.sprint.findFirst({ where: { isCurrent: true } });
    const task = await prisma.task.create({
      data: {
        title: 'Welcome to Kira (DB-backed)',
        description: 'This is a sample task created by the seed script.',
        status: 'PENDING',
        priority: 'BACKLOG',
        type: 'Task',
        sprintId: sprint ? sprint.id : null,
        createdById: admin.id
      }
    });
    await prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        userId: admin.id,
        role: 'Assignee',
        assignedById: admin.id
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


