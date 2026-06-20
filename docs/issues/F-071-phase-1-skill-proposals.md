# F-071 Phase 1 — Second-brain skill proposals

**Tier:** Free · **Priority:** P1 · **Status:** Ready for implementation

## Problem / motivation

F-071 Phase 0 gives Mimir a capture surface and a linked knowledge graph, but the graph is passive. The product promise is that Mimir becomes more useful the more you use it. We need the first self-improvement loop: detect patterns in the graph, propose new skills/tools/routines, and let the user approve or reject them.

## Proposed solution

Add a pattern detector and skill proposal system on top of the existing `knowledge_link` graph.

1. **Pattern detector** (`services/skill-proposals/detector.ts`):
   - Scan note clusters for repeated tags/links.
   - Detect “unanswered questions” (notes linking to many stubs).
   - Identify workflow-shaped sequences (ordered captures with similar titles).
   - Surface tool gaps from task history (tasks that no existing skill handled well).
2. **Skill proposal schema** (`skill_proposal` table):
   - `id`, `tenant_id`, `title`, `description`, `rationale`
   - `proposal_type`: `tool`, `routine`, `connector`, `skill`
   - `source_notes` (JSON array of note IDs)
   - `generated_manifest` (JSON)
   - `state`: `proposed`, `approved`, `rejected`, `implemented`, `failed`
   - `proposed_at`, `decided_by`, `decided_at`
3. **API**:
   - `GET /v1/skill-proposals`
   - `POST /v1/skill-proposals/:id/approve`
   - `POST /v1/skill-proposals/:id/reject`
   - `POST /v1/skill-proposals/detect` (manual trigger)
4. **Approval gate**: reuse existing approval flow if the proposal involves writes/connectors; otherwise allow direct approve/reject with audit.
5. **Promotion (Phase 1 scope)**:
   - For `tool` proposals, generate a custom tool entry in the tool registry.
   - For `routine` proposals, create a draft routine (F-083) for the user to finalize.
   - For `skill`/`connector` proposals, mark as `approved` and create a follow-up task; full generated-code sandbox is Phase 2.
6. **Web UI**: new `/skill-proposals` page showing proposals with rationale, source notes, approve/reject buttons.

## Acceptance criteria

- [ ] Detector produces at least one proposal from a synthetic graph with a known cluster.
- [ ] `GET /v1/skill-proposals` returns proposals ranked by confidence.
- [ ] Approving a `tool` proposal creates a working custom tool the user can run.
- [ ] Approving a `routine` proposal creates a disabled draft routine.
- [ ] Rejecting a proposal updates state and removes it from active list.
- [ ] Every proposal decision is audit-logged.

## Test plan

- **Unit:** detector scores clusters correctly; manifest generator produces valid JSON schema.
- **Integration:** seed notes + links, call detect, approve a tool proposal, invoke the generated tool.
- **Contract:** OpenAPI covers proposal list and decision endpoints.
- **E2E (real local API + Playwright):**
  1. Capture several notes about a recurring topic (e.g., “weekly team updates”) with wiki-links.
  2. Go to `/skill-proposals`.
  3. Assert a proposal appears with rationale citing the notes.
  4. Approve a tool proposal.
  5. Go to `/tools`, run the new tool, verify it works.

## Out of scope

- Generated-code sandbox execution (Phase 2).
- Automatic promotion without human approval.
- Crawler-generated skills (Phase 3).
- Fully autonomous upgrade loop (Phase 4).
