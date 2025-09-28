let prismaClient = null;

try {
    const { PrismaClient } = require('@prisma/client');
    // Reuse Prisma instance in development to avoid exhausting connections on hot-reload
    const globalForPrisma = global;
    prismaClient = globalForPrisma.__kira_prisma__ || new PrismaClient();
    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.__kira_prisma__ = prismaClient;
    }
} catch (err) {
    // Prisma might not be generated yet; callers should handle null
    prismaClient = null;
}

module.exports = prismaClient;


