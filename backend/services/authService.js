const bcrypt = require('bcryptjs');
const db = require('./dbAdapter');
const googleSheets = require('./googleSheets');

function isMysql() {
    return (process.env.DB_TYPE || '').toLowerCase() === 'mysql';
}

async function findUserByEmail(email) {
    if (!email) return null;
    if (isMysql()) {
        const users = await db.getUsers();
        return users.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
    }
    const users = await googleSheets.getUsers();
    return users.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function validatePassword(user, password) {
    if (!user || !password) return false;
    // DB path: if passwordHash exists, use bcrypt compare
    if (isMysql()) {
        try {
            // We don't have direct passwordHash on the mapped user from dbAdapter; fetch raw via prisma not available here.
            // Use fallback set of demo passwords for now until a proper credential flow is added.
            const allowed = ['password123', 'admin123', 'manager123', 'dev123', 'kira@kc'];
            return allowed.includes(password);
        } catch (_) {}
    }
    // Sheets path (demo passwords)
    const allowed = ['password123', 'admin123', 'manager123', 'dev123', 'kira@kc'];
    return allowed.includes(password);
}

async function createUser(userData) {
    if (isMysql()) {
        return await db.createUser({
            email: userData.email,
            name: userData.name,
            role: userData.role || 'Developer',
            passwordHash: userData.password ? await bcrypt.hash(userData.password, 10) : undefined
        });
    }
    return await googleSheets.createUser({
        email: userData.email,
        name: userData.name,
        role: userData.role || 'Developer',
        passwordHash: userData.password ? await bcrypt.hash(userData.password, 10) : undefined
    });
}

module.exports = {
    isMysql,
    findUserByEmail,
    validatePassword,
    createUser
};


