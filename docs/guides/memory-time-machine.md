# Graph Memory + Time-Machine (F-016)

This guide covers Mimir's tenant-isolated graph memory and time-machine APIs.

## Data model

Three Postgres tables form the foundation:

- `memory_node` — a fact or concept. Kinds: `semantic` (facts/preferences), `episodic` (experiences), `procedural` (learned behaviors). Each row is bitemporal: `valid_from`/`valid_to` tracks when a value was current; updates soft-delete the old row and insert a new one.
- `memory_edge` — a relationship between two nodes (`source_id` → `target_id`) with a `rel` label and `weight` (0–1).
- `memory_checkpoint` — a point-in-time snapshot storing the active `memory_node` and `memory_edge` row IDs plus an optional `parent_id` for lineage.

Row-level security (RLS) enforces tenant isolation using `current_setting('app.tenant_id')::uuid`.

## API surface

All routes are under `/v1/memory` and require the `memory:read` or `memory:write` scope.

### Graph

- `GET /v1/memory/graph?limit=100` — returns `{ nodes, edges }` of the current active graph.
- `POST /v1/memory/nodes` — create a node. Body: `{ kind, key, value?, sourceId? }`.
- `PATCH /v1/memory/nodes/:id` — update a node's value (creates a new version).
- `POST /v1/memory/edges` — create an edge. Body: `{ sourceId, targetId, rel?, weight? }`.
- `DELETE /v1/memory/edges/:id` — soft-delete an edge.

### Time-machine

- `GET /v1/memory/checkpoints` — list checkpoints.
- `POST /v1/memory/checkpoints` — capture the current graph. Body: `{ label }`.
- `GET /v1/memory/checkpoints/:id/diff?compare=<otherId>` — diff against another checkpoint. If `compare` is omitted, the previous checkpoint is used.
- `POST /v1/memory/checkpoints/:id/restore` — restore the graph to that checkpoint. Creates a new restore checkpoint and is audited.
- `POST /v1/memory/branch` — capture a new checkpoint from an existing one. Body: `{ fromCheckpointId, label }`.

## Web UI

The **Memory** page (`/memory`) has two tabs:

- **Time Machine** — checkpoint timeline, hover-to-compare diff, Restore/Rewind/Branch actions, and a "Save checkpoint" button.
- **Graph Memory** — interactive React Flow visualization of active nodes and edges.

## Usage example

```bash
# Create a preference node
curl -s -H "content-type: application/json" \
  -H "Authorization: Bearer <session-or-test-token>" \
  -X POST http://localhost:3001/v1/memory/nodes \
  -d '{"kind":"semantic","key":"user.preference.language","value":{"lang":"en"}}'

# Create an edge to an episodic memory
curl -s -H "content-type: application/json" \
  -H "Authorization: Bearer <token>" \
  -X POST http://localhost:3001/v1/memory/edges \
  -d '{"sourceId":"<node-a>","targetId":"<node-b>","rel":"influenced","weight":0.9}'

# Save a checkpoint
curl -s -H "content-type: application/json" \
  -H "Authorization: Bearer <token>" \
  -X POST http://localhost:3001/v1/memory/checkpoints \
  -d '{"label":"before-preference-change"}'
```

## Implementation notes

- Updates are append-only; nothing is hard-deleted, preserving auditability.
- Restore re-inserts snapshot rows with new IDs so that history before the restore remains intact.
- Diff compares snapshot row IDs and keys/values; it does not do deep semantic diff today.
- All mutations emit `memory.*` audit events.
