# F-089 — Device-scoped workflow runtime

**Tier:** Pro · **Priority:** P1 · **Status:** Roadmap

## Problem / motivation

Most Mimir execution is tenant-scoped, but some automations only make sense on a specific device (e.g., a daily CSV scan on a desktop, a photo backup on a phone). Users need a way to assign workflows to nodes and have the system respect device presence.

## Proposed solution

Add device binding to workflows/routines:

1. **Data model** — `routine.node_id` FK to `node.id`.
2. **API/UI** — node selector in workflow create/edit; `/workflows` shows device topology and assignments.
3. **Execution** — `routineWorkflow` checks `node.status` before running device-bound steps; fails with `NODE_UNAVAILABLE` if the device is down.
4. **Mesh awareness** — optionally prefer the tenant leader or a specific node kind for certain steps.

## Acceptance criteria

- [ ] Assign a workflow to a specific node.
- [ ] Execution skips/fails gracefully when the assigned node is offline.
- [ ] UI displays per-node workflow assignments.
- [ ] Device-bound runs record the target node and its status.

## Out of scope

- Automatic node failover.
- Workflow migration between devices.
