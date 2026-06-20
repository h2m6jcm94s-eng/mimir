# F-079 — Values & decision journal

**Tier:** Pro · **Priority:** P2 · **Status:** Implemented

## Problem / motivation

Mimir makes recommendations and automations, but it has no explicit model of what the user cares about. A values and decision journal gives users a structured way to record their priorities, log important decisions, and track outcomes so Mimir can align future suggestions with stated values.

## Proposed solution

Introduce three tenant-scoped, user-scoped entities:

1. **Value statement** (`value_statement` table)
   - `name`, `description`, `weight` (1-10), `active`
2. **Decision** (`decision` table)
   - `title`, `context`, `options`, `chosen_option`, `value_ids`, `decided_at`
3. **Decision outcome** (`decision_outcome` table)
   - `decision_id`, `outcome`, `alignment_score`, `notes`, `recorded_at`

## API

- `GET /v1/values` — list active values
- `POST /v1/values` — create value
- `PATCH /v1/values/:id` — update value
- `DELETE /v1/values/:id` — archive value
- `GET /v1/values/decisions` — list decisions
- `POST /v1/values/decisions` — log a decision
- `GET /v1/values/decisions/:id` — get decision with outcomes
- `POST /v1/values/decisions/:id/outcome` — record outcome
- `GET /v1/values/decisions/:id/alignment` — compute alignment score

## Alignment scoring

A simple heuristic matches keywords from the chosen option against each referenced value's name and description. The score is the sum of matching weights divided by total referenced weight, normalized to 0-100.

## Web UI

New `/values` page with three tabs:
- **Values** — add, edit weight, archive
- **Decisions** — log decisions and link values
- **Outcomes** — record outcomes and alignment scores

## Acceptance criteria

- [x] Users can create and archive values.
- [x] Users can log decisions and reference values.
- [x] Alignment score is computed for a decision.
- [x] Outcomes can be recorded and retrieved.
- [x] All changes are tenant/user isolated with RLS.
- [x] Unit, integration, and E2E tests pass.

## Test plan

- **Unit:** alignment scoring edge cases.
- **Integration:** create value → log decision → compute alignment → record outcome.
- **E2E:** create a value, log a decision, verify it appears.

## Out of scope

- LLM-generated value suggestions.
- Automatic decision extraction from chat/tasks.
- Correlation with actual behavior data.
- Public sharing of values or decisions.
