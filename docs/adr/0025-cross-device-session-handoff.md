# ADR 0025 — Cross-device session handoff and sync

**Status:** Accepted  
**Date:** 2026-06-21  
**Author:** devayan  

## Context

Mimir promises “one brain, many screens.” The `session` table already has `parent_id` for lineage, and F-056 mesh discovery finds nodes, but there is no protocol for resuming a session on a different device. We need a simple, correct way to sync session state across nodes.

## Options

| Option | Pros | Cons |
|---|---|---|
| A. Centralized brain as sync hub | Simple, single source of truth; any node pulls from the laptop/brain | Brain must be online; single point of failure |
| B. Gossip/CRDT across all nodes | Works peer-to-peer, resilient to individual node failures | Complex conflict resolution; overkill for v1 |
| C. Session state snapshots in Postgres + node polling | Straightforward; leverages existing DB | Polling latency; requires DB connectivity |

## Recommendation

**Option A for v1, with Option C as the fallback/sync mechanism.**

- The brain/laptop node remains the authoritative session store (Postgres/LibSQL).
- Any node can call `GET /v1/sessions/:id/state` to fetch the latest snapshot.
- `POST /v1/sessions/:id/resume` creates a child session on the current device; the child’s messages are persisted back to the same store.
- When a non-brain node comes online, it pulls the active session list from the brain via the mesh HTTP API (F-056).
- Conflict resolution is last-write-wins at the message level; concurrent edits branch with `parent_id`.

## Decisions

1. **Snapshot contents:** messages (ordered by `created_at`), pinned memory node keys, active approvals, and in-flight job IDs. Not the full memory graph.
2. **Resume semantics:** a resume creates a new `session` row with `parent_id` set to the original session. Messages are shared through the same underlying store, so parent and child see the same conversation.
3. **Active session list:** `GET /v1/sessions/active` returns sessions with activity in the last 7 days, filtered by tenant/user RLS.
4. **Offline behavior:** if the brain is unreachable, the node shows cached state read-only and queues new messages for sync (out of scope for v1 — v1 fails gracefully with a hint).

## Risks

- **Latency:** every resume fetches from the brain. Mitigation: keep snapshots small and add caching later.
- **Split-brain:** if two nodes edit concurrently, messages may interleave. Mitigation: last-write-wins is acceptable for chat; branching preserves history.
- **Privacy:** session sync crosses nodes but stays within the tenant/Tailnet; no wider tier widening.

## Related work

- F-086 implementation issue: `docs/issues/F-086-cross-device-session-handoff.md`
- F-056 mesh discovery implementation
- Session schema: `apps/api/src/db/schema/sessions.ts`
