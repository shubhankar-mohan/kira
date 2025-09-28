## Kira v2 Migration & Implementation Journal

Owner: Shubhankar Mohan  
Created: 2025-09-27  
Purpose: End-to-end execution log and runbook for migrating from Google Sheets to MySQL with a Slack-first, monolith-first approach. This file is the single source of truth to resume work at any point.

---

### Agreed Decisions (2025-09-27)
- ORM: Prisma
- IDs: UUID everywhere
- Architecture: Start as monolith (existing backend), introduce MySQL and Redis as separate Docker services; both must use persistent volumes via docker-compose
- Slack-first: Keep Slack as primary interface; bi-directional sync remains a requirement
- Status mapping: Keep all statuses as-is in DB; I will update the tasks and UI later to use the richer set

---

### Context & References
- Project guide: `claude.md`
- Deployment guide: `DEPLOYMENT.md`
- Slack integration: `SLACK_INTEGRATION_GUIDE.md`
- Migration plan: `MYSQL_MIGRATION_PLAN.md`
- Current Sheets service: `backend/services/googleSheets.js`

---

### Target Architecture (Phase 1 scope)
- Monolith Node/Express backend continues to serve API and static frontend
- MySQL 8.0 for primary data store (persistent volume)
- Redis (initially optional for caching/event-dedupe later; persistent volume)
- Prisma as ORM with migrations
- Feature-flag switch: `DB_TYPE={sheets|mysql}` for safe cutover
- Health endpoints for app and database

Future (post-cutover): optional Redis Streams event bus, background workers, eventual extraction to services behind Traefik (see `MYSQL_MIGRATION_PLAN.md`).

---

### Phases & Deliverables
1) Foundation & Tooling
   - Add Prisma to backend; define schema for: `users`, `sprints`, `tasks`, `task_assignments`, `comments`, `slack_threads`, `events`, `activity_log`
   - Create initial migrations; add DB connection; add `/api/health` and `/api/health/database`
   - Docker Compose services for `mysql` and `redis` with named volumes

2) Data Migration
   - Export from Sheets (via current service), transform, validate, import to MySQL
   - Dry-run and rollback scripts; row-count and referential integrity verification

3) API Refactor (DB cutover)
   - Repository/services layer on Prisma
   - Update routes (`tasks`, `users`, `sprints`, `auth`) to use DB layer
   - Add pagination/filtering/sorting; maintain response shapes

4) Slack Persistence
   - Persist `slack_thread_ts`, `slack_channel_id`, comment `slack_ts`
   - Event dedupe using `events.slack_event_id`; write to `activity_log`
   - Update `backend/routes/slack.js` handlers to MySQL

5) Ops & Hardening
   - Structured logging, backups, security/rate limits, slow query logs

6) Optional: Events/Workers & Traefik Services
   - Redis Streams events; scheduled jobs (standups, burndown, reminders)
   - Extract `task-service`/`slack-service` and route via Traefik

---

### Environment & Configuration
- New env variables (examples):
  - DB_TYPE=mysql
  - DB_HOST=localhost
  - DB_PORT=3307 # host port; container is 3306
  - DB_NAME=kira_db
  - DB_USER=kira_user
  - DB_PASSWORD=change_me
  - DATABASE_URL=mysql://kira_user:change_me@localhost:3307/kira_db
  - REDIS_URL=redis://localhost:6379
  - SLACK_RATE_LIMIT_WINDOW_MS=60000
  - SLACK_RATE_LIMIT_MAX=60

Note: In Docker, hosts will be service names (e.g., `mysql`, `redis`).

---

### Docker Compose (planned changes)
- Add services:
  - `mysql:8.0` with named volume `mysql_data` and init scripts
  - `redis:7-alpine` with `redis_data` volume
- Ensure persistent storage:
  - Host bind mounts: `./data/mysql` -> `/var/lib/mysql`, `./data/redis` -> `/data`
- Healthchecks: `mysqladmin ping`, `redis-cli ping`
 - Local testing: expose ports `3307:3306` (MySQL host→container), `6379:6379` (Redis)

---

### Prisma Setup (planned commands)
```bash
cd backend
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider mysql

# After schema is written
npx prisma migrate dev --name init
npx prisma generate

# Seed baseline data (admin, sprint, sample task)
npm run prisma:seed
```

Prisma schema outline (to be codified):
- users: email unique, role enum, active flag, timestamps
- sprints: name, week, dates, status enum, `is_current`
- tasks: title, description, status, priority, type, points, `sprintId`, `parentTaskId`, ordering, tags/metadata JSON, Slack fields, dueDate, timestamps, createdBy/updatedBy
- task_assignments: (taskId, userId, role) PK
- comments: linkage to task/user, content, type, Slack message ts/channel, source, timestamps
- slack_threads: (channelId, threadTs) unique, linked to task, active flag, counters
- events: event-sourcing for dedupe/audit; `slack_event_id` unique
- activity_log: normalized audit trail

Status policy: keep existing diverse statuses; UI/backend will accommodate all.

---

### Data Migration Flow (planned)
1) Export
   - Use `backend/services/googleSheets.js` to read Users, Sprints, Tasks, Comments
   - Normalize IDs to UUIDs (store original IDs in metadata)
2) Transform
   - Map fields 1:1 where possible; preserve Slack thread ts/channel
   - Build task assignments from `Assigned To`
3) Import
   - Upsert Users → Sprints → Tasks → Assignments → Comments → Slack Threads
   - Validate counts and FKs; write a report
4) Rollback
   - Truncate imported tables; re-run from export artifact

---

### Health & Observability (planned)
- `/api/health`: app status, version, uptime
- `/api/health/database`: DB connectivity and latency check
- Slow query log, structured logs with request IDs

---

### Backend Enhancements Implemented (Running)
- Task shortId support: `Task.displayId` auto-increment; API returns `shortId` as `kira-<displayId>`; GET `/api/tasks/:id` accepts shortId or UUID.
- Slack safety: skip posting threads when Slack client not initialized.
- Server-side filters & pagination: GET `/api/tasks` supports `status, priority, type, sprint, assignee, createdFrom, createdAfter, createdBefore, search, sort, dir, page, pageSize`; response `{ data, total, page, pageSize, hasNext }`.

- Bulk operations: `POST /api/tasks/bulk/status`, `POST /api/tasks/bulk/assign`, `POST /api/tasks/bulk/delete`.
- Search endpoint: `GET /api/tasks/search?q=&limit=`.
- Comments: `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/comments`.
- Activity feed: `GET /api/activity/feed?page=&pageSize=`.
- Auth routes wired to `authService` (MySQL-aware).
- Slack service migrated fully to `dbAdapter`.

---

### Pending Frontend Changes (to implement later)
- Use server-side filters/pagination when fetching tasks:
  - Update `frontend/js/api.js` to pass query params from board filters and pagination controls.
  - Update `TaskManager.loadTasks` to consume `{ data, total, page, pageSize, hasNext }` and store pagination state.
  - Add pagination UI controls on the board (next/prev, page size selector) and wire to `TaskBoardManager.applyFilters`.
- Prefer `shortId` display universally:
  - Ensure breadcrumbs, copy-to-clipboard, and any task links show `shortId` when present.
  - Update router deep link handling to accept `/task/kira-<num>` and resolve via API.
- Search:
  - When search term matches `kira-<num>`, call GET `/api/tasks/:id` to jump directly; otherwise use filtered list.
- Task detail page:
  - Show `shortId` prominently; add a copy button for `shortId`.
  - After save, re-fetch task to keep `shortId`/server fields in sync.

- Comments & activity:
  - Render `GET /api/tasks/:id/comments` on detail.
  - Add a recent activity widget using `/api/activity/feed`.
- Bulk operations UI (status, assign, delete) calling bulk endpoints.
- Filters for `tags` and `createdBy` in the UI; pass to API.
---

### API Reference (current)
- Health: `GET /health`, `GET /api/health/database`
- Tasks: `GET /api/tasks` (filters/pagination), `GET /api/tasks/:id` (UUID or shortId), `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`
- Comments: `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/comments`
- Bulk: `POST /api/tasks/bulk/status`, `POST /api/tasks/bulk/assign`, `POST /api/tasks/bulk/delete`
- Search: `GET /api/tasks/search?q=&limit=`
- Users: `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`
- Sprints: `GET /api/sprints`, `GET /api/sprints/:id`, `POST /api/sprints`, `PUT /api/sprints/:id`
- Activity: `GET /api/activity/feed?page=&pageSize=`
- Slack: `/api/slack/*` endpoints (DB-backed where relevant)

---

### New Chat Prompt (to kick off FE integration)
Copy-paste in a new chat to continue:

"""
You are continuing Kira FE integration. Repo: /Users/retailpulse/Documents/Shubhankar/kira
Context:
- Backend updated: shortId (kira-XXXXXX), server-side filters/pagination, comments, activity feed, bulk ops, search, Slack DB adapter. See IMPLEMENTATION_JOURNAL.md (Backend Enhancements Implemented, API Reference).
- Pending FE: listed under Pending Frontend Changes and Frontend Integration Plan (Next Chat).
Goals now:
1) Update frontend api.js for new endpoints and query params.
2) Wire task board to server-side filters/pagination; add pagination UI.
3) Show shortId everywhere; support /task/kira-<num> deep links.
4) Render comments on task detail.
5) Add recent activity feed widget.
6) Add bulk actions UI (status, assign, delete).
Constraints: keep existing styles, minimal invasive edits, ensure mobile UX.
Proceed step-by-step with diffs and test against http://localhost:3001.
"""

---

### Risks & Mitigations
- Migration accuracy: use validation reports and dry-runs
- Slack duplicate events: unique index on `events.slack_event_id`
- Performance: add indexes from plan; measure and tune
- Rollback: retain feature flag `DB_TYPE` and export artifacts

---

### How to Resume Work
1) Open this file and the referenced guides
2) Ensure Docker Desktop is running
3) Bring up infra (once compose is updated):
   ```bash
   mkdir -p data/mysql data/redis
   docker-compose up -d mysql redis
   ```
4) Create/update `.env` with DB and Redis variables
5) In `backend`:
   ```bash
   npm i
   npx prisma generate
   npm run dev
   ```
   Optionally seed baseline data:
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```
6) Verify health endpoints
7) Proceed with next TODO in this journal

---

### Live TODOs (mirror of task tracker)
- [x] Create implementation journal file with decisions and detailed plan
- [ ] Scaffold Prisma in backend with schema and migrations
- [x] Add MySQL and Redis services with persistent volumes to docker-compose
- [x] Implement DB connection layer and health endpoints
- [ ] Build Sheets export and MySQL import migration scripts
- [ ] Refactor API routes to use DB layer with filters/pagination
- [ ] Persist Slack threads/comments and event dedupe in DB
- [ ] Add backups, logging, and security hardening

---

### Changelog
- 2025-09-27: Initial journal created; decisions captured; phased plan, commands, and resumption steps outlined.
- 2025-09-27: Added MySQL/Redis services with persistent volumes to docker-compose. Added Prisma schema scaffold and backend scripts for Prisma.
- 2025-09-27: Added Prisma client singleton and `/api/health/database` endpoint.
- 2025-09-27: Exposed MySQL/Redis ports for local testing; added Prisma seed script and commands.


