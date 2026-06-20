# F-086 — Cross-device session handoff

**Tier:** Free · **Priority:** P1 · **Status:** Implemented

## Problem / motivation

Mimir is supposed to be “one brain, many screens.” Today a chat session started on the laptop is trapped on the laptop; the phone or desktop has no way to resume it. `session.parent_id` already exists for branching/compression lineage, and F-056 mesh discovery finds nodes, but there is no sync/resume protocol.

## Proposed solution

Build session handoff so any authenticated node can resume the latest session state.

1. **Session sync API**:
   - `GET /v1/sessions/:id/state` — latest messages + memory context + pending approvals.
   - `POST /v1/sessions/:id/resume` — create or resume a child session on the current device.
   - `GET /v1/sessions/active` — list sessions active across the user’s nodes.
2. **State snapshot**: a deterministic, versioned snapshot of session messages, pinned memory nodes, and in-flight jobs.
3. **Node-to-node sync**: when a node comes online, it pulls active sessions from the brain/laptop via the existing mesh HTTP endpoint (F-056).
4. **Conflict resolution**: last-write-wins at the message level; concurrent edits create a branch with `parent_id`.
5. **Web UI**: session switcher/dropdown in `/console` showing active sessions and “continue on this device” button.
6. **Mobile consideration**: expose the same APIs to the phone client; no separate phone UI in this issue.

## Acceptance criteria

- [x] `GET /v1/sessions/:id/state` returns the session’s latest messages and context.
- [x] `POST /v1/sessions/:id/resume` creates a child session and returns its ID.
- [x] A message sent in the child session appears when the parent session is fetched.
- [x] `GET /v1/sessions/active` lists sessions across nodes for the tenant/user.
- [x] Console UI shows active sessions and allows resuming another session.

## Test plan

- **Unit:** snapshot serializer/deserializer; conflict resolver picks latest message per ID.
- **Integration:** create session, add messages, resume from another simulated node, assert continuity.
- **Contract:** OpenAPI covers state/resume/active endpoints.
- **E2E (real local API + Playwright):**
  1. Open `/console` in Browser A, start a session, send a message.
  2. Open `/console` in Browser B (same user, same tenant), click the session switcher.
  3. Select the session from Browser A.
  4. Assert the conversation appears and a new reply in B is visible when A refreshes.

## Out of scope

- Real-time collaboration (simultaneous typing in the same session).
- Offline-first sync queue.
- End-to-end encryption for session sync (relies on existing Tailscale/zero-trust transport).
- Phone native UI.
