# ADR 0024 — Durable routine scheduler with Temporal

**Status:** Proposed  
**Date:** 2026-06-21  
**Author:** devayan  

## Context

Mimir already uses Temporal for durable task execution. Users need recurring automation (routines) such as scheduled reports, periodic scraping, or daily briefings. The web app has a mocked `/routines` page. We must decide how to persist schedule definitions, how to trigger them, and how to keep schedule state in sync with the database.

## Options

| Option | Pros | Cons |
|---|---|---|
| A. Use Temporal Schedules as the source of truth | Durable, built-in cron parsing, handles missed invocations, scales with Temporal cluster | Adds Temporal dependency; schedule metadata lives outside Postgres |
| B. Postgres `routine` table + a polling cron worker | Single source of truth in Postgres; no extra Temporal feature | Must implement polling, missed-invocation logic, and fencing ourselves |
| C. Hybrid: Postgres rows + Temporal schedules | Postgres is user-facing truth; Temporal executes | Requires two-way sync; more complex |

## Recommendation

**Option C — Hybrid.**

- The `routine` table is the user-facing source of truth: name, cron, input, enabled state, run history.
- Temporal Schedule handles execution: created/updated/deleted by the scheduler service whenever the row changes.
- Run history and results are written back to Postgres by the `RoutineWorkflow`.
- On startup, the scheduler service reconciles any drift between `routine` rows and Temporal schedules.

This gives users queryable history and governance while leveraging Temporal for reliable cron execution.

## Decisions

1. **Schedule identity:** Temporal schedule handle ID = `routine:{tenant_id}:{routine_id}`.
2. **Cron expression format:** Unix cron strings stored as-is; UI helper builds them but does not hide the raw expression.
3. **Tier enforcement:** the routine’s `tier` is passed to the job dispatch path exactly like a one-off job; T0 routines require a local model/node.
4. **Governance:** routines that perform writes, external calls, or high-cost compute inherit the existing approval/cost policy for their job type.
5. **Manual trigger:** creates a one-off Temporal workflow execution independent of the schedule.

## Risks

- **Temporal schedule limit:** large numbers of routines could stress the scheduler. Mitigation: monitor handle count; document limits.
- **Clock/timezone confusion:** cron is UTC by default; timezone-aware cron is out of scope for v1.
- **Orphan schedules:** if a row is deleted outside the API, the schedule may linger. Mitigation: reconcile on startup and provide a cleanup endpoint.

## Related work

- F-083 implementation issue: `docs/issues/F-083-routine-scheduler.md`
- Existing Temporal setup: `apps/api/src/services/` workflows and `infra/temporal/`
