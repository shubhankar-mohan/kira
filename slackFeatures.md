# Kira Slack Capabilities

This document explains what the Kira Slack app can do, how it is configured, and examples to use each capability effectively.

## Installation and Configuration

- Install the app to your Slack workspace and to channels where you want to use it (`/invite @Kira`).
- Required OAuth scopes (Bot Token):
  - commands, chat:write, app_mentions:read
  - channels:history, groups:history, im:history, mpim:history (to receive message events)
  - users:read, users:read.email (for user mapping)
  - reactions:read (for reaction handling)
- Slash command: `/kira` → Request URL: `<api>/api/slack/commands`.
- Events (Request URL: `<api>/api/slack/events`): `app_mention`, `message.channels`, `message.groups`, `reaction_added`.
- Interactivity: `<api>/api/slack/interactive`.

## Capabilities

### 1) Create Tasks from Mentions

Mention the bot to create tasks quickly.

Example:
`@kira Fix login issue @U123 @U456 P1 Feature due 2025-01-15 3 points`

Notes:
- Priority: P0/P1/P2
- Type: bug/feature/improvement
- Due date: `YYYY-MM-DD` or `MM/DD/YYYY`
- Points: `N points`
- All mentioned users after the bot are assigned to the task (email-mapped).
- Replies are posted in the same thread.

### 2) Convert a Thread into a Task

Reply in a thread with:
`@kira create task`

- The first message becomes the title; subsequent messages are added as comments.
- Duplicate protection prevents creating multiple tasks for the same thread.

### 3) Slash Commands

`/kira create Fix login issue`
`/kira close 123`
`/kira assign 123 @user`
`/kira status`
`/kira sprint`
`/kira burndown [sprint]`
`/kira workload`
`/kira reviews`
`/kira retrospective [sprint]`
`/kira release [version] [date]`

Implementation details:
- The server acknowledges immediately and replies via `response_url` (works in any channel and threads when Slack provides `thread_ts`).

### 4) Interactive Buttons

- Tasks posted by the bot include buttons:
  - Mark Complete → marks the task as DONE
  - Assign to Me → assigns the task to the clicker

### 5) Scheduled Reports (optional)

- Daily standup, sprint health alerts, and weekly summaries (enabled via `SLACK_ENABLE_SCHEDULED_REPORTS=true`).

## Reliability & Safety

- Slack signature verification with raw body capture.
- Immediate ACK of Events API requests; events processed asynchronously.
- Event deduplication using Slack `event_id`.
- Thread-level creation locks to prevent duplicate tasks when multiple messages arrive quickly.
- Input sanitization for interactive payloads.

## Troubleshooting

- 401 on Slack endpoints: verify `SLACK_SIGNING_SECRET` and raw body capture is active.
- channel_not_found when replying: ensure app is in the channel or rely on `response_url`.
- Not receiving non-mention messages: ensure message.* events and history scopes are added and the bot is in the channel.


