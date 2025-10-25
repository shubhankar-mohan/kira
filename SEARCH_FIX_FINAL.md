# Search API - Final Fix

## Issue
`GET /api/tasks?search=...` was failing with Prisma errors:
- `mode: 'insensitive'` not supported by MySQL connector
- `select` in count queries (though this wasn't actually present)

## Root Cause
Prisma's MySQL connector doesn't support `mode: 'insensitive'` parameter in string filters. Two places in the code were using it:

1. **getTasksFiltered()** - Main search endpoint (lines 185-186)
2. **searchTasks()** - Quick search endpoint (lines 563-564)

## Solution
Removed `mode: 'insensitive'` from all Prisma queries. This is safe because:
- MySQL database uses `utf8mb4_unicode_ci` collation
- This collation is **case-insensitive by default**
- No explicit mode parameter needed

## Changes Made

### File: `backend/services/dbAdapter.js`

#### Change 1: getTasksFiltered (lines 184-189)
```javascript
// BEFORE (broken):
if (search) {
    where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
    ];
}

// AFTER (working):
if (search) {
    where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
    ];
}
```

#### Change 2: searchTasks (lines 563-565)
```javascript
// BEFORE (broken):
const where = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } }
    ]
};

// AFTER (working):
const where = {
    OR: [
      { title: { contains: query } },
      { description: { contains: query } }
    ]
};
```

#### Change 3: Assignee filter (line 176)
```javascript
// BEFORE (broken):
if (assignee) where.assignments = { some: { user: { email: { contains: assignee, mode: 'insensitive' } } } };

// AFTER (working):
if (assignee) where.assignments = { some: { user: { email: { contains: assignee } } } };
```

## Verification

All count() queries verified clean (no select parameter):
- `prisma.task.count({ where })` ✅ Only uses where
- `prisma.taskSequence.count()` ✅ No params
- `prisma.sprint.count()` ✅ No params  
- `prisma.user.count()` ✅ No params

## Testing

```bash
# Test main search endpoint
curl "http://localhost:3001/api/tasks?search=bug"
curl "http://localhost:3001/api/tasks?search=FEATURE"  # Case-insensitive
curl "http://localhost:3001/api/tasks?search=test&page=1&pageSize=20"

# Test quick search endpoint
curl "http://localhost:3001/api/tasks/search?q=task&limit=5"

# Test with assignee filter
curl "http://localhost:3001/api/tasks?assignee=john@example.com"

# Test board search in browser
# Open http://localhost:3001/board
# Use search box - should work without errors
```

## Expected Behavior
- ✅ Search works case-insensitively (due to MySQL collation)
- ✅ No Prisma errors in console
- ✅ Correct result counts returned
- ✅ Pagination works properly
- ✅ Search box in Task Board works
- ✅ Quick search API works

## Why This Works
MySQL's `utf8mb4_unicode_ci` collation comparison rules:
- `WHERE title LIKE '%bug%'` matches "Bug", "BUG", "bug"
- `WHERE email LIKE '%john%'` matches "John", "JOHN", "john"
- No need for explicit LOWER() or mode parameters

## All Occurrences Fixed
Confirmed: Zero remaining instances of `mode: 'insensitive'` in backend code (except in comment).

