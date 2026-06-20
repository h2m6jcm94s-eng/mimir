# F-084 — Email digest delivery

**Tier:** Pro · **Priority:** P1 · **Status:** Implemented (Phase 1)

## Problem / motivation

Mimir generates notifications, tasks, approvals, and reports throughout the day, but users who are not actively using the web app can miss important updates. A periodic email digest gives them a low-friction, opt-in rollup that surfaces what matters without requiring another notification channel.

## Proposed solution

Add per-user email digest preferences and a scheduled SMTP-based digest sender.

1. **Schema** (`email_digest_preference` table):
   - `id`, `tenant_id`, `user_id`
   - `enabled`, `frequency` (`daily` | `weekly`)
   - `include_notifications`, `include_tasks`, `include_approvals`, `include_reports`
   - `email` (optional override)
   - `created_at`, `updated_at`
2. **API**:
   - `GET /v1/email-digest` — returns current preferences (creates defaults if missing)
   - `PUT /v1/email-digest` — updates preferences
   - `POST /v1/email-digest/send-now` — manually triggers a digest for the current user
3. **Digest service** (`services/email-digest/digest.ts`):
   - Aggregates notifications, tasks, approvals, and reports from the last window.
   - Builds plain-text and HTML bodies.
   - Sends via Nodemailer using SMTP env vars.
   - Resolves recipient from preference email, then user email, then user account email.
4. **Temporal workflow** (`digestWorkflow`) + schedules:
   - `email-digest:daily` at `0 8 * * *`
   - `email-digest:weekly` at `0 8 * * 1`
   - Schedule helpers create/update or delete schedules on startup/config change.
5. **Web UI**:
   - New **Email digest** section in Settings → Notifications.
   - Toggle enable/disable, frequency selector, and per-category checkboxes.

## Acceptance criteria

- [x] `email_digest_preference` table exists with RLS and a unique index on `(tenant_id, user_id)`.
- [x] `GET /v1/email-digest` returns preferences for the authenticated user.
- [x] `PUT /v1/email-digest` validates input and persists updates.
- [x] `POST /v1/email-digest/send-now` returns `{ sent, recipient }` or a clear error if no email/transport is configured.
- [x] Daily and weekly Temporal schedules trigger `digestWorkflow`.
- [x] Settings UI loads and saves digest preferences.
- [x] Integration tests cover preferences CRUD and manual send.

## Test plan

- **Unit:** format email body from aggregated content; recipient resolution order.
- **Integration:**
  1. `GET /v1/email-digest` returns defaults for a new user.
  2. `PUT /v1/email-digest` updates frequency and category toggles.
  3. `POST /v1/email-digest/send-now` succeeds when SMTP is configured and fails gracefully when it is not.
- **E2E (real local API + Playwright):**
  1. Log in to web app.
  2. Open Settings → Notifications.
  3. Enable email digest, select weekly, and uncheck a category.
  4. Refresh the page and verify selections persist.

## Out of scope

- Microsoft Graph / OAuth email provider (SMTP only for Phase 1).
- Per-digest customization beyond included categories.
- Unsubscribe/link tracking in emails.
- Digest open/click analytics.
