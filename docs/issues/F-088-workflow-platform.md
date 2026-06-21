# F-088 — Workflow platform: n8n ingestion & visual builder

**Tier:** Pro · **Priority:** P1 · **Status:** Roadmap

## Problem / motivation

F-083 gives Mimir cron routines, but they are single-job scripts. Users already build automations in n8n and want a visual way to compose multi-step workflows inside Mimir. A workflow platform makes routines composable, importable, and optimizable.

## Proposed solution

Build a workflow layer on top of `routine`:

1. **Data model** — extend `routine` with `workflow_json` (node graph), `source_format` (`native` | `n8n`), `node_id`, and `optimization_log`.
2. **n8n ingestion** — `POST /v1/workflows/import/n8n` parses exported n8n JSON and maps common node types to Mimir connector actions or sandboxed custom-code nodes.
3. **Workflow generation** — `POST /v1/workflows/generate` turns a natural-language description into a draft workflow graph.
4. **AI optimizer** — `POST /v1/workflows/:id/optimize` suggests the right tier, agent role, and model for each action node using the existing `AgentRoleRegistry`.
5. **Visual editor** — new `/workflows` page with a node canvas (e.g. React Flow), node palette of triggers/actions/conditions/transforms, and a property panel.
6. **Execution** — extend `routineWorkflow` / activities to topologically sort and execute the graph, carrying outputs between nodes.

## Acceptance criteria

- [ ] Import a sample n8n workflow and persist it as a Mimir routine.
- [ ] Generate a draft workflow from a description.
- [ ] Optimize an existing workflow and persist the suggestion log.
- [ ] Build and save a workflow in the visual editor.
- [ ] Execute a workflow and record per-node status.

## Out of scope

- Two-way n8n export.
- Real-time collaborative editing.
- Marketplace publishing of workflows (F-090).
