# Kira Task Manager - Next Chat Kickoff (Bugs + Testing Plan)

## Context Snapshot
- Backend: Prisma/MySQL with Redis; shortId (kira-xxxxxx) supported; filters/pagination implemented.
- Frontend: API module updated; Task Board wired; comments via GET endpoint; Recent Activity widget added.
- Start with monolith; use docker-compose for MySQL/Redis.

## Reported Issues (from manual testing)
1) Dashboard
   - Duplicate API calls on startup
   - Current Sprint Overview shows empty/zero values
   - Recent Activity lacks formatting (needs table/list)
2) Task Board / Tasks
   - Search: Prisma `count` error with `mode: 'insensitive'` in count
   - Edit modal: success true but UI shows failure toast
   - Edit modal: assignee/sprint changes not persisted
   - Edit modal: duplicate save and duplicate list reload
   - Priority filter incorrect (server and UI reflection)
   - Validate all filters mapping end-to-end
   - Disallow transitions to Product Testing / Awaiting Release (or remap)
   - New task default sprint should preselect current sprint
   - Duplicate task creation observed
   - Comments: Prisma schema missing `authorName` (migration + code)
   - Slack comment also failing (same cause)
   - Board footer buttons layout stretches columns
3) Sprints
   - “+ New Sprint” creates duplicate entry
4) Team
   - Create user: password field readonly; Generate/Copy not working

## High-Priority Fixes (order)
1. Fix Prisma count for search (use `count({ where })` only; remove select/mode in count)
2. Add/ensure `Comment.authorName` migration applied; align code
3. Prevent duplicate creations (tasks/sprints) and double saves (debounce or guard)
4. Persist assignee/sprint on updateTask; fix false negative toast
5. Dashboard optimizations: remove duplicate fetches; compute current sprint metrics; format Recent Activity
6. Filters: repair priority mapping, audit all filters end-to-end
7. UI polish: board footer layout; default current sprint in create modal
8. Team: enable password input; implement Generate/Copy

## Ready-to-Use Prompt for New Chat

Paste this as your first message in a new chat:

"""
You are resuming work on Kira Task Manager. Use Prisma/MySQL (Docker), Redis, and the existing monolith. Keep shortId support and server-side filtering/pagination.

Goals for this session:
1) Fix critical backend issues:
   - Search count error in `dbAdapter.getTasksFiltered` (remove unsupported fields from count; use `count({ where })`).
   - Apply Prisma migration to add `Comment.authorName` and update code paths (web + Slack comments).
   - Prevent duplicate creations (tasks/sprints) and duplicate save/refetch on edit.
   - Ensure `updateTask` persists assignee/sprint and remove false error toast.
2) Dashboard:
   - Remove duplicate API calls on init.
   - Implement current sprint overview numbers.
   - Redesign Recent Activity as a clean table/list.
3) Filters & UI:
   - Fix priority filter and audit all Task Board filters end-to-end.
   - Disallow invalid status transitions (Product Testing/Awaiting Release) or remap.
   - New task modal: default current sprint preselected.
   - Board footer buttons layout fix.
4) Team page:
   - Enable password field, implement Generate/Copy.

Artifacts to update:
- `backend/services/dbAdapter.js`
- `backend/prisma/schema.prisma` + new migration
- `frontend/js/modules/*`, `frontend/js/task-board.js`, `frontend/js/app.js`, `frontend/js/modules/modal-manager.js`, `frontend/js/modules/ui-manager.js`

Validation:
- Run `start.sh`, verify health.
- cURL smoke: tasks list/search, create/update/delete, comments add/list, activity feed; validate filters; bulk endpoints.
- Manual FE test: board search, filters, pagination, edit modal save, comments, activity, sprints, team user creation.

Use `TESTING_PLAN_NEXT_CHAT.md` and existing TODO list to track progress. Make atomic commits per fix.
"""

## Notes
- Ensure `start.sh` runs `prisma migrate` successfully; include new migration for comments.
- Keep Slack-first approach with safe guards.

