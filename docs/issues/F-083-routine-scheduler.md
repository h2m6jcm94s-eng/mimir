# F-083 — Routine scheduler to turn jobs into recurring automation

**Tier:** Free · **Priority:** P1 · **Status:** Implemented

## Problem / motivation

Mimir has a durable job queue and Temporal workflows, but every job today is one-off. Users cannot say *“summarize my unread email every morning at 8”* or *“scan this public page every hour and alert me on change”*. The `/routines` page in the web app is mocked with static client-side data. We need persisted, governable, cron-style automation.

## Proposed solution

Introduce a `routine` entity backed by Temporal schedules.

1. **Schema** (`routine` table):
   - `id`, `tenant_id`, `name`, `description`
   - `cron` expression or `interval_seconds`
   - `job_type`, `job_input` (JSON), `tier`
   - `enabled`, `next_run_at`, `last_run_at`, `last_run_status`
   - `created_by`, `policy_id` (optional governance policy)
2. **API**:
   - `GET /v1/routines`
   - `POST /v1/routines`
   - `GET /v1/routines/:id`
   - `PATCH /v1/routines/:id` (enable/disable, update cron/input)
   - `DELETE /v1/routines/:id`
   - `POST /v1/routines/:id/run` (manual trigger)
   - `GET /v1/routines/:id/runs` (run history)
3. **Scheduler service**: wraps Temporal schedule client; creates/updates/deletes schedules; maps schedule handle to `routine` row.
4. **Workflow**: `RoutineWorkflow` calls the existing task/job dispatch path with the routine’s input and records run history.
5. **Governance**: routines inherit approval/cost policy based on tier and job type; destructive/high-cost routines require approval.
6. **Web UI**: replace the mocked `/routines` page with a real list, create/edit form (cron helper), run history, enable/disable toggle.

## Acceptance criteria

- [x] `POST /v1/routines` creates a routine and a Temporal schedule.
- [x] Temporal triggers the routine on the configured cron/interval.
- [x] Each run creates a run-history row linked to the resulting job.
- [x] `PATCH /v1/routines/:id/enabled` pauses/resumes the schedule without deleting it.
- [x] Manual trigger `POST /v1/routines/:id/run` executes immediately and records history.
- [x] Web `/routines` page lists real routines, shows next run, and allows create/edit/pause/delete.
- [x] Routine runs respect tier: T0 routines use local model/node; T2 routines use cloud worker.

## Test plan

- **Unit:** cron parser validates expressions; scheduler service maps routine ↔ Temporal schedule correctly.
- **Integration:** create a routine with a 1-minute interval, assert Temporal fires it at least once and run history is recorded.
- **Contract:** OpenAPI covers all CRUD + run endpoints.
- **E2E (real local API + Playwright):**
  1. Log in to web app.
  2. Navigate to `/routines`.
  3. Create a routine that runs every minute and posts a capture note.
  4. Wait ~90s.
  5. Verify a new note appears in `/knowledge` and the run history shows success.
  6. Pause the routine and verify no new notes appear in the next minute.

## Out of scope

- Event-triggered routines (webhooks, file-system watchers) — this issue is time/cron only.
- Routine templates/library.
- Multi-timezone-aware cron UI (use UTC cron strings for v1).
- Automatic retry/backoff beyond Temporal’s default policy.
