# Comments Display Fix

## Issue
Comments on task detail page were showing "Unknown Just now" instead of actual comment data.

## Root Causes

### 1. Wrong Task ID Type
**Problem**: Using shortId (e.g., "kira-111125") instead of database UUID for API calls.

**Evidence**:
```bash
# This failed (shortId):
GET /api/tasks/kira-111125/comments → { data: [] }

# This worked (UUID):
GET /api/tasks/23cd6e95-fd26-4514-8ecf-ef35e4707949/comments → { data: [comments] }
```

### 2. Mismatched Field Names
**Problem**: Code expected different field names than API returned.

**API Returns**:
```json
{
  "user": "System",
  "comment": "no email",
  "timestamp": "2025-10-02T06:22:04.364Z"
}
```

**Code Expected**:
- `authorName` or `author` (API returns `user`)
- `text` (API returns `comment`)
- `createdAt` (API returns `timestamp`)

## Solutions Implemented

### Fix 1: Use Database UUID for API Calls
```javascript
// Before
const response = await api.getTaskComments(taskId);

// After
const apiTaskId = window.router.currentTaskDbId || taskId;
const response = await api.getTaskComments(apiTaskId);
```

### Fix 2: Handle Multiple Field Name Variants
```javascript
// Handle all possible field name variations
const author = comment.authorName || comment.author || comment.user || 'Unknown';
const text = comment.text || comment.comment || '';
const timestamp = comment.createdAt || comment.timestamp;
```

### Fix 3: Escape Author Name for XSS Protection
```javascript
// Before
<span class="task-comment-author">${author}</span>

// After
<span class="task-comment-author">${this.escapeHtml(author)}</span>
```

## Files Modified

1. **`frontend/js/app.js`** (lines 558-593)
   - `loadPageComments()`: Use DB ID, handle field variants, escape HTML
   - `loadPageActivity()`: Use DB ID for consistency

2. **`frontend/js/modules/modal-manager.js`** (lines 1371-1398)
   - `addPageComment()`: Use DB ID when posting new comments

## Testing

### Before Fix
```
Display: "Unknown Just now"
API Call: GET /api/tasks/kira-111125/comments
Result: Empty array
```

### After Fix
```
Display: "System" + "no email" + "22 days ago"
API Call: GET /api/tasks/23cd6e95-fd26-4514-8ecf-ef35e4707949/comments
Result: Correct comment data
```

## Impact

✅ **Comments now display correctly with**:
- Proper author name (handles `user`, `author`, `authorName`)
- Actual comment text (handles `comment`, `text`)
- Formatted timestamp (handles `timestamp`, `createdAt`)
- XSS protection via HTML escaping
- Correct API calls using database UUID

## Related Fixes

This is part of a larger fix that ensures all task detail page operations use the correct ID:
- ✅ Task updates (save button)
- ✅ Comment fetching
- ✅ Comment posting
- ✅ Activity log fetching

All now use `window.router.currentTaskDbId` (UUID) for API calls while maintaining user-friendly shortId URLs.

---

**Status**: ✅ Complete and Tested  
**Verified**: Comments display correctly on http://localhost:3001/task/kira-111125

