# RFC: F-071 Second brain as a self-improvement engine

> Status: vision document — current code covers Phase 0 (capture, notes, bidirectional links, graph API). Phase 1+ are the next iterations.

## 1. Why this is one of Mimir's most important features

The second brain (F-071) is not just a note-taking surface. It is the **growth loop** that lets Mimir become more useful while it is idle:

- It captures ideas, pages, and observations.
- It links them into a graph.
- From that graph it can **propose new tools, skills, connectors, and workflows**.
- It **tests the proposal in a sandbox**.
- If the test passes, it **upgrades itself** like a video-game character learning a new skill.
- If the test or ingestion fails, it **reverts cleanly** and keeps running normally.

This loop is the foundation for:

- **Business research** — scan a market, synthesize a report, propose a new skill to do it again later.
- **Optimization** — observe repeated tasks, propose a routine/workflow, and automate it.
- **Report consolidation** — pull data from many connectors, learn the shape of the report, and expose it as a reusable report skill.
- **Crawlers** — generate and evolve site-specific crawlers from a few example links and a goal.

## 2. Core metaphor

Mimir's second brain is a **skill tree**.

- Every note is a node.
- Every `[[link]]` is an edge.
- Clusters of related notes that appear repeatedly are **skill quests**.
- When Mimir ingests a new skill, it "levels up" in that area.
- Failed upgrades are logged but do not corrupt the running system.

## 3. Architecture

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Capture    │────▶│  Link graph  │────▶│ Pattern detector │
│ (notes, web, │     │ (knowledge_  │     │ (cluster/trend/  │
│  screenshots,│     │  link graph) │     │  repetition)     │
│  chat)       │     │              │     │                  │
└──────────────┘     └──────────────┘     └──────────────────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Upgrade    │◀────│    Sandbox   │◀────│ Skill generator  │
│   (apply)    │     │ (gVisor/runsc│     │ (code + schema + │
│              │     │  + static    │     │  tests)          │
│              │     │  analysis)   │     │                  │
└──────────────┘     └──────────────┘     └──────────────────┘
        │
        ▼
┌──────────────┐
│   Rollback   │
│   on failure │
└──────────────┘
```

### 3.1 Capture

Already implemented in Phase 0:

- `POST /v1/capture` accepts text, classifies it, stores it as a `knowledge_item` of kind `note`.
- `[[wiki-links]]` are parsed and create bidirectional `knowledge_link` edges.
- Notes are chunked and embedded so they are searchable.

Future capture sources:

- Browser extension (page, selection, screenshot).
- Chat messages the user asks Mimir to "remember".
- Connector observations (e.g., "this Slack thread keeps coming up").

### 3.2 Link graph

The `knowledge_link` table is the graph. It supports:

- Outbound/inbound traversal (`GET /v1/capture/:id/related`).
- Whole-graph export (`GET /v1/knowledge/graph`).
- Link kinds: `link`, `relates_to`, `depends_on`, `implements`, `cites`.

Future work:

- Weighted edges (how often a link is traversed).
- Temporal edges (links valid only within a time window).
- Typed edges between notes and skills/connectors.

### 3.3 Pattern detector

When Mimir is idle or on a schedule, it scans the graph for:

- **Repeated clusters** — groups of notes that keep appearing together.
- **Unanswered questions** — notes that link to many stubs but have no resolved target.
- **Workflow-shaped patterns** — sequences of captures that look like a multi-step process.
- **Tool gaps** — tasks the user keeps asking for that no existing skill handles.

Output of the detector: a ranked list of **skill proposals**.

### 3.4 Skill generator

For each proposal, the generator produces:

- A skill manifest (name, description, inputs, outputs, tier, cost estimate).
- A handler implementation (TypeScript/Python, depending on the skill runtime).
- A JSON schema for inputs and outputs.
- A set of unit/property tests.
- A sandbox execution plan.

If the skill involves crawling, the generator also produces:

- Crawler config (start URLs, selectors, link-follow rules, rate limits).
- Extraction schema.
- Validation samples.

### 3.5 Sandbox + static analysis

Before any generated code is applied, it runs inside:

- **gVisor (`runsc`)** container with default-deny network.
- **Static analysis** gate (bandit, semgrep, plus Mimir-specific rules).
- **Resource limits** (CPU, memory, wall-clock time).
- **Tier enforcement** — the sandbox cannot access data wider than the request tier.

Only after the sandbox passes and the tests pass does the skill move to approval.

### 3.6 Approval gate

Self-upgrades are risky by definition. The workflow is:

1. Propose skill.
2. Run in sandbox.
3. Present summary to user (or auto-approve if policy allows low-risk skills).
4. On approval, apply upgrade atomically.
5. On failure, rollback.

The same approval/review loop used for connectors and tasks is reused here.

### 3.7 Rollforward / rollback

Every skill upgrade is versioned. On failure:

- The new skill version is marked `failed`.
- The previous version remains active.
- Mimir logs what failed and why (audit + telemetry).
- The user is notified if the failure is interesting.

On success:

- The skill is published to the skill registry.
- The graph is updated with `implements` / `depends_on` edges.
- Mimir can now use the skill in future tasks.

## 4. Phases

### Phase 0 — Done

- `knowledge_item` kind `note`.
- `knowledge_link` table with tenant RLS.
- `POST /v1/capture` with `[[wiki-link]]` parsing.
- `GET /v1/capture/:id/related` and `GET /v1/knowledge/graph`.
- Notes classified, chunked, embedded.

### Phase 1 — Skill proposal from graph

- Idle graph scan / pattern detector.
- Skill proposal schema and API.
- Human approval for proposals.
- Manual "promote note cluster to skill" action.

### Phase 2 — Generated skill sandbox

- Skill generator wired to the review loop.
- Sandbox execution of generated skills (gVisor + static analysis).
- Rollback on failure.

### Phase 3 — Crawlers and automation

- Crawler generator from example pages.
- Scheduled / event-triggered crawlers.
- Crawler output feeds back into the second brain as new notes.

### Phase 4 — Autonomous upgrade loop

- Mimir proposes, tests, and — when policy allows — applies low-risk skills without human intervention.
- High-risk upgrades still require approval.
- Continuous self-measurement: did the skill actually help? If not, mark for rework.

## 5. Heavy test plan

Because this feature lets Mimir mutate itself, it needs extraordinary test coverage:

| Layer | Tests |
|---|---|
| **Capture** | Property tests for `[[link]]` parsing, tenant isolation, classification fallback, empty content, unicode, injection attempts. |
| **Graph** | Cycle detection, orphaned-note cleanup, graph query correctness, large-graph pagination, tenant isolation. |
| **Pattern detector** | Synthetic note graphs with known clusters; verify proposals ranked correctly. |
| **Skill generator** | Golden-output tests, schema validation, generated code compiles, no hardcoded secrets. |
| **Sandbox** | Escape attempts, network egress blocked, resource limits enforced, malicious generated code contained. |
| **Rollback** | Inject failing skill, verify previous version still active, verify audit trail, verify no data loss. |
| **E2E** | Capture → link → propose skill → approve → sandbox → upgrade → use new skill → verify result. |
| **Crawler** | Static HTML, JS-rendered pages, pagination, rate-limit respect, error recovery, schema extraction. |

Target coverage for Phase 1+ code: **≥ 90%**.

## 6. Business impact

- **Research acceleration** — Mimir can learn a new domain from a handful of captures and start producing structured briefs.
- **Operational automation** — Repeated manual tasks become scheduled routines without a human writing code.
- **Data consolidation** — Reports that pull from many connectors become first-class, reusable skills.
- **Defensibility** — The more a user uses Mimir, the more Mimir adapts to them, creating a personal moat.

## 7. Security notes

- Generated skills must never run outside the gVisor sandbox until approved.
- The skill generator itself is a high-value target; its prompts and outputs are audited.
- Any network access from a generated skill is allow-listed per job, not broad.
- User data used to train/tune skills stays within the original privacy tier.

## 8. Out of scope for now

- Fine-tuning models on user data (privacy/compliance complexity).
- Distributed skill marketplace (Mimir-owned skills only until governance matures).
- Fully autonomous upgrades without any policy/approval gate.

---

*This document is the north star for F-071. The current codebase covers Phase 0; subsequent phases will be implemented as a stack of small, reviewed PRs following the process in `AGENTS.md`.*
