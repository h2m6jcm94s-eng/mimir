<div align="center">

# Mimir — Master Roadmap, Architecture, Features, Risks, Analytics & Go/No‑Go

**The living source of truth for the plan.** The welcoming overview is in [`README.md`](./README.md).

`status: pre‑alpha (Milestone 0)` · `kickoff: 2026‑06` · `owner: @h2m6jcm94s‑eng` · `doc version: 0.2`

</div>

---

## 0. Document control

| Field | Value |
|---|---|
| Purpose | Single, authoritative, *living* plan: vision → architecture → features → milestones → risks → analytics → commercialization. |
| Audience | Core team + incoming contributors (incl. partner engineers from large vendors) + AI coding agents. |
| How to read | Skim §0–§5 for orientation; engineers go deep in §6–§19; PMs/leads live in §22–§27; everyone respects §21 (process). |
| Update cadence | Every PR that changes scope updates the relevant section + the features table (§23) + CHANGELOG. |
| Companion docs | `README.md` (overview), `AGENTS.md` (contributor/agent law), `docs/adr/*` (decisions), `hermesh_validation.agent.final.md` (brutal go/no‑go dossier). |

> **RAG‑first authoring rule (mirrors the product):** every market figure, failure rate, and risk
> is **drawn from the research/validation corpus, not invented.** Citations like `[wide03]`,
> `[sec02]`, `[validation A2]` point into the files listed in **§30 Sources & RAG provenance**.
> Anything not in the sources is explicitly marked **_(assumption)_**. We do not hallucinate.

### Conventions used in this document

- **Status glyphs:** ⬜ todo · 🟦 in‑progress · ✅ done · ⛔ blocked · 🔜 next.
- **Priority:** P0 (must, blocks release) · P1 (should) · P2 (nice) · P3 (later).
- **Severity:** 🔴 critical · 🟠 high · 🟡 medium · ⚪ low.
- **Tiers:** **Free** (OSS core) · **Pro** ($49–99/user/mo) · **Ent** (custom).
- **Privacy tiers:** **T0** private/local · **T1** local compute · **T2** cloud ephemeral.
- **Targets** are relative to the **2026‑06** kickoff unless a calendar date is given.

---

## Table of contents

- **Orientation:** §0 Document control · §1 Vision & principles · §2 Market & validation · §3 Personas & use cases · §4 Product & UX laws · §5 Architecture overview
- **Engineering deep‑dives:** §6 Data model & multi‑tenancy · §7 API design standards · §8 RAG & knowledge · §9 Graph memory · §10 Orchestration · §11 Resilience & consensus · §12 Security & threat model · §13 Governance & audit · §14 Web app spec · §15 Connector specs · §16 Delivery & notifications · §17 Cost governance · §18 Observability · §19 Testing strategy · §20 CI/CD & release
- **Execution & business:** §21 Engineering process · §22 Milestone plan (issue‑level) · §23 Features list (master table) · §24 Risk register · §25 Commercialization & GTM · §26 Analytics & KPIs · §27 Compliance roadmap
- **Reference:** §28 Glossary · §29 ADR index · §30 Sources & RAG provenance · §31 Appendices

---

## 1. Vision & non‑negotiable principles

**Vision.** Mimir is the AI built to help humans: a **privacy‑tiered AI orchestration mesh** and
universal companion that can be a friend, researcher, coder, marketer, financial advisor, HR
partner, CEO coach, creative collaborator, and lifelong assistant — all inside one always‑on
"brain." It owns your memory and coordinates a fleet of nodes (laptop, desktop, optional cloud,
phone) as a single trustworthy mind — controllable from a chat prompt or a friendly UI, grounded in
your own data, and never leaking sensitive information off the hardware you control.

**Why it exists.** ~**88% of AI‑agent projects fail before production** [wide03]; Gartner expects
**40%+ cancelled by 2027** [sec02]. The causes are **systems‑engineering** — orchestration,
reliability/observability, cost, governance — **not** model capability [wide06 §5; chaos/SRE
reviews]. Mimir is engineered around those failure modes.

### The five principles (hard constraints on every feature)

1. **RAG‑first / no hallucination.** For any "reference the data" use case, **retrieve + cite real
   sources**; answer *"not in my sources"* over guessing; the audit log shows provenance for every
   answer. Generic generation is used only where citation isn't expected (e.g. brainstorming).
2. **Kid‑simple → expert‑complex.** Every capability is reachable from **UI *and* prompt**. Default
   surface is one‑box simple with smart defaults; power users progressively unlock full control.
3. **Privacy by tier.** T0 private/local · T1 local compute · T2 cloud ephemeral (air‑gapped). A
   **data‑classification gateway** enforces routing; sensitive data never leaves T0/T1.
4. **Determinism over vibes.** Durable workflows (Temporal), idempotency keys, bounded retries,
   circuit breakers, and hard cost ceilings — so behavior is predictable and debuggable.
5. **Universal companion / one brain, many hats.** The same mesh serves a homework helper, a
   coding partner, a financial advisor, a marketing assistant, an HR partner, and a CEO coach — by
   composing shared skills, memory, connectors, and governance, not by building separate products.
6. **Harden before you sell.** We never make a reliability/governance claim we haven't **survived
   ourselves** (30‑day dogfood, zero critical incidents) — see §25/§24.

### Design tenets (how we build)

- **Single source of truth** for any shared schema (Zod in `@mimir/shared-types`).
- **Thin edges, fat services**: routers/handlers are glue; logic lives in services; data in repos.
- **Tenancy from commit 1**: `tenant_id` + Postgres RLS everywhere; isolation is a CI gate.
- **Small PRs, descriptive issues, ADRs for decisions** (see §21).
- **Boring, proven tech** chosen on purpose (Temporal, Postgres, Redis, Fastify, Next.js).

---

## 2. Market context & the honest thesis (RAG‑grounded)

### 2.1 The opportunity (cited)

| Metric | Value | Source |
|---|---|---|
| AI agent orchestration market | $5.8B (2025) → $38.6B (2034), 23.7% CAGR | [wide01][sec01] |
| Broad AI orchestration | $9.6B (2024) → $65.4B (2034), 19.8% CAGR | [sec06] |
| Privacy‑tiered orchestration SAM | $4.06B (2025) → $63.6B, ~36% CAGR | [sec01][wide05] |
| Agent‑project failure rate (pre‑prod) | ~88%; avg cost ~$340K | [wide03] |
| Gartner cancellation forecast | 40%+ of agentic projects by 2027 | [sec02][wide01] |
| Avg enterprise AI spend | $85,521/mo (2025), +36% YoY | [sec03][wide04] |
| AI gross margins | 50–60% (vs SaaS 80–90%) | [perf review][wide04] |
| Adoption vs governance gap | 79% adopted agents; only 21% mature governance | [wide01][sec01] |

### 2.2 The brutal validation (what must be true before we sell)

Full detail in `hermesh_validation.agent.final.md`. Headlines:

- **EU AI Act is a checkbox for now, not a budget trigger.** High‑risk deadline slipped to **Dec
  2027** (Digital Omnibus); early enforcement targets egregious cases. → **Lead with developer
  velocity + cost control, not fines.** [validation A2]
- **First buyer = developer/CTO**, not CISO — we lack SOC 2/legal today, and the CISO sale needs
  them. [validation A3]
- **Hybrid (personal↔enterprise) is two half‑products** unless validated (Docker Desktop didn't
  sell Docker Enterprise). Pick **enterprise as the revenue ICP**, keep the personal mesh as OSS
  proof‑of‑capability + recruiting. [validation B1]
- **Distribution is scorched earth** (LangChain ~110K★, Dify ~100K★, CrewAI ~48–52K★, Mastra
  ~22K★ [wide03]). Our wedge is **"instantly deterministic, production‑safe DX."** Narrow to **one**
  competitor to displace: Mastra users hitting production walls. [validation B3]
- **Survive the security audit first.** Four confirmed defects contradict the sales claim (§24).
  Selling before closing them = becoming one of the 88%. [validation C1, D2]

### 2.3 What we will/won't claim

| We say | We do **not** say |
|---|---|
| "We eliminate the *infrastructure* reasons agent projects die." | "We fix the 88%." |
| "Deterministic execution, bounded cost, sandboxed data." | "Better answers than model X." |
| "Pre‑position for governance; audit‑ready by design." | "Buy now or get fined." |

---

## 3. Personas & use cases

### 3.1 Personas

| Persona | Goal | Pain today | Mimir value | Tier |
|---|---|---|---|---|
| **Alex — everyday human** | "An AI that actually gets me" | Fragmented apps; lonely chatbots; no memory; privacy fears | One companion for life, work, learning, and creativity that remembers and keeps secrets | Free |
| **Devi — solo power user** | "A supercomputer in my pocket" | Context scattered; cloud privacy worries; cost surprises | One private brain, heavy jobs on demand, cited answers, phone control | Free |
| **Tara — tech lead, 8‑person team** | Ship agent features without 3am pages | Flaky agents, no audit, runaway bills | Durable orchestration, cost ceilings, audit, connectors | Pro |
| **Omar — platform eng, regulated mid‑market** | Govern AI across teams | No tenancy/RBAC/residency story | Multi‑tenant, policy‑as‑code, immutable audit, residency | Ent |
| **Riya — CISO (later)** | Approve safely | Black‑box agents, data exfil risk | gVisor isolation, zero‑trust, SOC2‑ready evidence | Ent |

### 3.2 Representative end‑to‑end use cases

**UC‑1 — "Summarize and cite my docs" (T0, kid‑mode).**
Prompt: *"Summarize everything under /research and cite sources."* → classification gateway tags
**T0** → local/Private model + RAG over the local knowledge base → answer with citations + audit
provenance. No data leaves the laptop.

**UC‑2 — "Build this feature" (review loop).**
Prompt: *"Add pagination to the reports endpoint."* → workhorse drafts code → reviewer critiques via
AST‑diff + JSON‑patch (max 3 rounds, cycle‑detected) → applied → recorded in memory with rationale.

**UC‑3 — "Heavy render on the desktop" (T1, WoL).**
Prompt: *"Render the deck and ping me when done."* → Temporal workflow → Wake‑on‑LAN the desktop →
Docker/gVisor job → result delivered to phone → desktop suspends.

**UC‑4 — "Watch a public page and report" (T2, ship‑and‑wipe).**
Routine on the **air‑gapped cloud worker** scrapes a public page on change → report shipped to T0
`~/Reports/` via a short‑lived signed webhook → instance wiped/stopped. Sensitive data never involved.

**UC‑5 — "Approve a risky action" (governance).**
Agent wants to send an email → **approval gate**: blast‑radius preview, tiered timeout, PIN →
on approve, send; on timeout, **queue for review (never silent deny)**; everything audited.

**UC‑6 — "What did we decide last week?" (RAG + time‑machine).**
Prompt retrieves the ADR + the session message, cites both; user can **rewind** memory to that
checkpoint to see full context.

**UC‑7 — "Help me feel less overwhelmed" (companion mode).**
Prompt: *"I have too much going on — can you help me untangle it?"* → Mimir listens, asks gentle
clarifying questions, surfaces recent calendar/tasks/memory, and co-creates a manageable plan — all
Tier 0, never leaving the laptop.

**UC‑8 — "Build my monthly budget and flag weird spend" (personal finance).**
Prompt: *"Look at my transactions and tell me where money is leaking."* → connectors pull bank/card
CSV or Stripe/Paddle revenue (Tier 2 for public data; Tier 0 for personal files) → categorized
report with anomalies cited and visualized.

**UC‑9 — "Plan and write this week's marketing content" (creator/marketer).**
Prompt: *"Draft a launch thread, two LinkedIn posts, and an email from our roadmap."* → Mimir
researches the product updates from memory, writes in the brand voice, schedules posts, and queues
approval for publish actions.

**UC‑10 — "Prep my 1:1s and draft growth feedback" (HR/people partner).**
Prompt: *"Help me prepare 1:1s for my team with notes from last month."* → Mimir pulls recent
session memory, project updates, and goal progress → private prep doc with suggested talking points
and draft feedback, all tenant-isolated.

**UC‑11 — "What's the health of the business?" (CEO/operator).**
Prompt: *"Give me a CEO dashboard: burn, revenue, active tasks, risks, and next week's priorities."*
→ Mimir aggregates cost, connector revenue, task status, audit risks, and calendar into a single
cited briefing with drill-down links.

### 3.3 Human‑first feature themes

These themes guide feature invention. A capability is "Mimir‑shaped" when it helps a real person in
everyday life while staying private, cited, and dual‑surface.

| Theme | What it means | Example prompts |
|---|---|---|
| **Companion** | Be present, remember, check in, listen. | *"How am I doing this week?"* · *"Remind me to call Mom."* |
| **Memory** | Hold the user's life context and surface it when useful. | *"What was that restaurant I loved in Lisbon?"* · *"Resurface my ideas about climate tech."* |
| **Learning** | Teach anything at the user's level, with patience and structure. | *"Explain quantum computing like I'm 12."* · *"Build me a Python study plan."* |
| **Health & wellbeing** | Support sleep, nutrition, fitness, and mental health without judging. | *"Plan dinners for the week."* · *"I slept badly — what might help?"* |
| **Life admin** | Remove overhead: renewals, maintenance, travel, schedules. | *"What expires this month?"* · *"Plan a weekend trip to the mountains."* |
| **Relationships** | Help the user be more thoughtful with people they care about. | *"What should I ask Sarah about?"* · *"Gift ideas for Dad."* |
| **Communication** | Draft, triage, and follow up across channels. | *"Draft a kind no to this invite."* · *"Summarize my unread email."* |
| **Creativity & legacy** | Capture ideas, stories, and creative work for the long term. | *"Help me write the story of how my grandparents met."* |
| **Accessibility** | Lower barriers for users with different abilities or contexts. | *"Read this page aloud."* · *"Simplify this legal letter."* |
| **Decision support** | Lay out options, trade‑offs, and values — but let the human decide. | *"Should I take this job?"* · *"What are the risks of this move?"* |

---

## 4. Product & UX laws (with examples)

### 4.1 Kid‑simple → expert‑complex (progressive disclosure)

- **Default:** one input, plain language, smart defaults; the system picks the model/tier/node.
- **Reveal on demand:** "show steps" exposes the plan; "advanced" exposes model choice, budget,
  policy, target node, and the raw tool calls.
- **Same power both ways:** anything doable in the UI is doable by prompt and vice‑versa
  (the API is the single substrate; UI and prompt are two clients of it).

> Example — same task, three depths:
> - Kid: *"clean up my screenshots folder"*
> - Intermediate: Knowledge → Screenshots → **Auto‑tag + dedupe** → review → apply
> - Expert: write a routine with a policy (`tier:0`, `model:local`, `budget:$0`) triggered on new files

### 4.2 RAG‑first interaction contract

- Answers that reference data **must** carry citations or an explicit "not in my sources."
- The UI renders a **📎 Sources** affordance on every grounded answer; the audit log stores the
  retrieved chunks + scores.
- A visible **confidence/trust badge** + **model badge** + **privacy‑tier badge** on every AI surface.

### 4.3 Safety‑forward UX (from the UX review)

- **Notification tiers** P0 call / P1 push / P2 badge / P3 digest; **dedup token** (dismiss once =
  dismissed everywhere); one channel per concern (kills alert fatigue).
- **Humane approvals:** tiered timeouts (low 24h / med 4h / high 15m+call); timeout = **queued for
  review, never silent deny**; PIN/biometric for destructive actions.
- **Emergency HALT** reachable from every screen + a phone shortcut; auto circuit‑breaker on runaway
  cost/spawn.
- **Visual status** (node topology, colors), never a JSON dump.

---

## 5. System architecture overview

```
        Phone (chat) ─┐
                      ▼
   Desktop ─────▶  LAPTOP = BRAIN  ◀────── you, anywhere (Tailscale zero-trust)
   (T1, WoL)         ┌──────────────────────────────────────────────┐
                     │ apps/api (Fastify)                            │
                     │  ├─ auth + tenancy (Postgres RLS) + RBAC      │
                     │  ├─ memory: Postgres authoritative + LibSQL   │
                     │  │   embedded replicas for failover           │
                     │  ├─ orchestration: Temporal workflows         │
                     │  ├─ classification gateway (tier routing)     │
                     │  ├─ models: workhorse · reviewer · local      │
                     │  ├─ RAG + graph memory + time-machine         │
                     │  ├─ governance: policy-as-code + hash-chain   │
                     │  └─ cost governor + observability             │
                     └───────────────┬──────────────────────────────┘
        apps/web (Next.js PWA) ──────┤ OpenAPI contract
        services/ (Python workers) ──┘ Temporal task queues
                                         │ dispatch
                                         ▼
                     Cloud worker (T2, air-gapped, ship-and-wipe; returns via short-lived signed webhook)
                     untrusted/generated code → gVisor sandbox
```

**Component map.**

| Component | Tech | Responsibility |
|---|---|---|
| API | Fastify + TS | HTTP/WS edge, auth, tenancy, routes → services |
| Orchestrator | Temporal | durable workflows, retries, idempotency, scheduling |
| Memory store | LibSQL (SQLite‑compatible) | authoritative state + embedded replicas for failover |
| Graph memory | graph store (Cognee/Neo4j‑style) | cross‑session/agent semantic+episodic+procedural memory |
| Classification gateway | service + policy engine | route requests to model/node by privacy tier |
| Model layer | workhorse · reviewer · local (Ollama) | build/execute · review/plan · offline fallback |
| Governance | OPA/Rego + hash‑chain log | policy enforcement + immutable, replayable audit |
| Cost governor | service | metering, budgets, throttle, forecasting |
| Workers | Python (uv) | RAG, render, ingest, heavy compute |
| Web | Next.js PWA | the dual UI (kid‑simple → expert) |
| Gateway | service | chat surfaces (Telegram/Discord/Slack) + connectors |

**Key invariants.**
- **Single writer**; replicas are read‑only until a fencing‑epoch promotion (no split‑brain).
- **Tier‑0 data never egresses** to T2/cloud (packet‑verified isolation test in CI).
- **No untrusted code on the host** — only in gVisor sandboxes.
- **Every external/destructive action is fenced + audited**; risky ones are approval‑gated.

### 5.1 Engine design: inspired by Hermes, implemented by Mimir

Mimir is a **self‑contained system**. It implements its own orchestration, model providers,
tool registry, skill runtime, connector gateway, sandboxing, cron/routines, subagent
delegation, and memory/FTS. Hermes (Nous, `~/.hermes/hermes-agent`) is **not a runtime
dependency** — it is a **design reference** for the breadth and shape of a capable agent
surface. Where Hermes has a good connector pattern, tool abstraction, or skill model, Mimir
learns from it and builds a privacy‑tiered, governed, multi‑node equivalent. Where Mimir's
requirements differ, we **rebuild freely**.

**Rule:** Mimir owns the engine room and the bridge. We do not hide an external runtime
underneath.

| Subsystem | Decision | Why |
|---|---|---|
| Model providers + failover + MoA | **BUILD** | Mimir implements its own adapters and classified failover chain so tier enforcement is impossible to bypass |
| Subagent delegation | **BUILD** | Temporal + Mimir's own `delegate_task`/Kanban semantics; no external runtime owns spawn semantics |
| Connectors / chat surfaces | **BUILD** | Hermes' gateway is a design reference; Mimir implements its own GitHub/Telegram/Discord/Slack/Mail/etc. engines with tier tags, vaulting, and audit |
| Cron / routines | **BUILD** | Mimir's own durable cron + approval gates + cost ceilings |
| Skills + session memory + FTS | **BUILD** | Mimir's own skill runtime, cite‑or‑abstain, tier‑isolated embeddings, graph memory, and time‑machine |
| Execution sandbox | **BUILD** | gVisor `runsc` backend inside Mimir's env abstraction (R‑01) |
| State / persistence | **BUILD** | Mimir‑owned multi‑tenant, replicated, encrypted store |
| Classification gateway, multi‑node mesh, multi‑tenancy/RLS, hash‑chain audit, cost **governance**, web/PWA UI | **BUILD** | the moat — Mimir‑specific |
| Control/integration protocol | **BUILD** | Internal Mimir RPC/activity protocol; no ACP dependency |

**Hermes references** (where we look for inspiration): connector/tool/skill surface breadth,
provider adapter patterns, gateway conventions, sandbox/env abstractions. Nothing is invoked
directly; everything is reimplemented under Mimir's governance model.

### 5.2 Hermes upstream ingestion process

Because Mimir is **inspired by** Hermes but **not built on** it, we must actively pull relevant
Hermes innovations into Mimir rather than passively inherit them through dependency upgrades.
The goal is: **Mimir never falls behind the reference surface, but every borrow is Mimir‑ized**
(privacy tiers, audit, cost, tenant isolation).

**Cadence**
- Weekly automated check for new Hermes releases/tags (`.github/workflows/upstream-hermes-check.yml`).
- Bi‑weekly manual diff review by a maintainer, logged as `upstream/hermes-YYYY-MM-DD` issue.
- Ad‑hoc review when a Hermes release note mentions a connector/tool/skill/provider we care about.

**Triage rubric**
| Label | Action | Examples |
|---|---|---|
| `port-now` | Create a Mimir issue and PR within the current milestone | new connector (e.g., Notion), new provider adapter, improved sandbox pattern |
| `port-backlog` | Create a backlog issue; schedule when Mimir surface needs it | new skill format, chat-gateway convenience |
| `watch` | Record in `docs/references/hermes-baseline.md`; no code yet | experimental Hermes subsystems not yet proven |
| `ignore` | Document why in the triage issue | Hermes‑specific UI, single‑host SQLite internals, branding features |

**Porting rules**
1. Never copy Hermes code verbatim. Reimplement under Mimir's governance model.
2. Every port must declare a default privacy tier, emit audit events, attribute cost, and pass tenant isolation where applicable.
3. Add tests: at minimum one unit + one integration/contract test per ported subsystem.
4. For performance‑sensitive ports (model failover, sandbox startup, connector batching), add a benchmark comparing Mimir to the Hermes behavior being replaced.
5. Significant architectural borrows require an ADR citing the Hermes commit/release and explaining the Mimir adaptation.

**Local‑only reference**
- The Hermes reference clone stays at `~/.hermes/hermes-agent` on the maintainer's machine.
- **Never upload Hermes code** into the Mimir repo. We track only commit/tag metadata and our own triage notes.
- `docs/references/hermes-baseline.md` records the last reviewed Hermes commit/tag and the status of each tracked subsystem.
- `scripts/hermes-release-check.sh` runs against the local clone path or fetches public release metadata only; it does not copy code into the repo.

This process directly mitigates **R‑22** (engine self‑ownership → slower parity vs proven runtimes like Hermes).

*(Deep dives for each component follow in §6–§19.)*

---

## 6. Data model & multi‑tenancy

### 6.1 Tenancy model (tight tenants from commit 1)

Three‑rung isolation ladder (industry standard [wide02]):

| Rung | Isolation | For | Mimir tier |
|---|---|---|---|
| **Pool** | shared DB, `tenant_id` + **Postgres RLS** | most tenants | default |
| **Bridge** | schema‑per‑tenant | scaling/premium | Pro |
| **Silo** | DB‑per‑tenant / VPC | compliance‑sensitive | Ent |

**Rules (enforced, not promised):**
- Every tenant‑scoped table has a non‑null `tenant_id`; **RLS policy** filters by the JWT's tenant
  claim, resolved **before the first query**.
- Roles exist **within** a tenant (no global roles). Cache keys are tenant‑prefixed
  (`tenant:{id}:{resource}`).
- **Cross‑tenant + cross‑tier isolation tests are required CI checks** — a violation breaks `main`.
- Application code never trusts itself as the only boundary; **RLS at the DB is the safety net.**

### 6.2 Core entities (initial ERD sketch)

```
tenant (id, name, plan, created_at)
user (id, tenant_id→tenant, clerk_id, role, created_at)             # role ∈ {owner,admin,member,viewer}
node (id, tenant_id, kind, name, tier, tailnet_addr, status, last_seen)   # kind ∈ {brain,desktop,cloud,phone}
session (id, tenant_id, parent_id?, source, model, created_at)      # source ∈ {web,telegram,discord,slack,cli,api}
message (id, session_id→session, role, content, model, tier, tokens_in, tokens_out, cost_usd, created_at)
job (id, tenant_id, idempotency_key, type, tier, status, target_node, checkpoint jsonb, created_at)
                                                                    # status ∈ {queued,running,blocked,needs_attention,done,failed}
report (id, tenant_id, title, body, tier, tags[], sources jsonb, created_at)
knowledge_item (id, tenant_id, kind, uri, tier, hash, created_at)   # kind ∈ {doc,code,screenshot,web}
embedding (id, knowledge_item_id, chunk_idx, vector, text, meta jsonb)
memory_node (id, tenant_id, kind, key, value jsonb, valid_from, valid_to)  # graph node; kind ∈ {semantic,episodic,procedural}
memory_edge (id, tenant_id, src→memory_node, dst→memory_node, rel, weight)
audit_event (id, tenant_id, prev_hash, hash, actor, action, tier, payload_hash, sources jsonb, ts)
policy (id, tenant_id, name, rego, version, enabled, created_at)
approval (id, tenant_id, job_id, risk, blast_radius jsonb, state, decided_by, decided_at, expires_at)
connector (id, tenant_id, kind, account, scopes[], tier, status, secret_ref, last_sync)
budget (id, tenant_id, scope, period, limit_usd, spent_usd, throttle_at, halt_at)
secret_ref (id, tenant_id, alias, vault_path)                      # never the secret itself
config (id, tenant_id, key, value, value_type, node_scope, updated_by, updated_at)
```

### 6.3 Migrations & schema evolution

- **Drizzle** migrations; `__schema_version__` table; schema‑hash validation at startup (mismatch →
  refuse to boot with a clear message).
- **Additive‑only** rule: add nullable columns / new tables; never destructively alter in place.
- Every migration has a **rollback** script; multi‑node order: pause replication → migrate primary →
  verify → migrate replica → resume → checksum.
- Backup/restore + migration **tests** are required before a migration merges (§19).

### 6.4 Identity & memory‑sync idempotency

- Stable identities for sync: `session.id`, `(session_id, platform_message_id)`, or content hash —
  **never** a local autoincrement (collides across nodes).
- Sync = "apply events with `seq > last_applied`"; apply with `ON CONFLICT DO NOTHING` → re‑pull is a
  **no‑op** (idempotent). Verify with `db_sha256` + row counts.

### 6.5 Full DDL (Postgres, illustrative — authoritative schema lives in Drizzle migrations)

```sql
-- ─── tenancy & identity ───────────────────────────────────────────────
CREATE TABLE tenant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  clerk_id    text NOT NULL UNIQUE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_tenant ON app_user(tenant_id);

-- ─── mesh nodes ───────────────────────────────────────────────────────
CREATE TABLE node (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('brain','desktop','cloud','phone')),
  name         text NOT NULL,
  tier         smallint NOT NULL CHECK (tier IN (0,1,2)),
  tailnet_addr text,
  status       text NOT NULL DEFAULT 'unknown' CHECK (status IN ('up','degraded','down','unknown')),
  last_seen    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_node_tenant ON node(tenant_id);

-- ─── sessions & messages ──────────────────────────────────────────────
CREATE TABLE session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES session(id),         -- branch/compression lineage
  source      text NOT NULL CHECK (source IN ('web','telegram','discord','slack','cli','api')),
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_tenant ON session(tenant_id);
CREATE INDEX idx_session_parent ON session(parent_id);

CREATE TABLE message (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- local; NOT used for cross-node sync
  tenant_id            uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  session_id           uuid NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  platform_message_id  text,                                            -- stable identity for idempotent sync
  role                 text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content              text NOT NULL,
  model                text,
  tier                 smallint NOT NULL DEFAULT 0 CHECK (tier IN (0,1,2)),
  tokens_in            int DEFAULT 0,
  tokens_out           int DEFAULT 0,
  cost_usd             numeric(12,6) DEFAULT 0,
  sources              jsonb,                                           -- RAG provenance
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, platform_message_id)
);
CREATE INDEX idx_message_session ON message(session_id, created_at);

-- ─── jobs / durable queue ─────────────────────────────────────────────
CREATE TABLE job (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  type            text NOT NULL,
  tier            smallint NOT NULL CHECK (tier IN (0,1,2)),
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','blocked','needs_attention','done','failed')),
  target_node     uuid REFERENCES node(id),
  epoch           bigint NOT NULL DEFAULT 0,            -- fencing
  checkpoint      jsonb NOT NULL DEFAULT '{}',          -- completed phases + side-effect refs
  cost_usd        numeric(12,6) DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX idx_job_tenant_status ON job(tenant_id, status);

-- fencing: only the current epoch may write (enforced via app + this guard)
CREATE TABLE mesh_meta (
  tenant_id  uuid PRIMARY KEY REFERENCES tenant(id) ON DELETE CASCADE,
  leader     uuid REFERENCES node(id),
  epoch      bigint NOT NULL DEFAULT 0,
  min_epoch  bigint NOT NULL DEFAULT 0
);

-- ─── knowledge / RAG / memory ─────────────────────────────────────────
CREATE TABLE knowledge_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('doc','code','screenshot','web')),
  uri         text,
  tier        smallint NOT NULL CHECK (tier IN (0,1,2)),
  hash        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hash)
);

CREATE TABLE embedding (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  knowledge_item_id  uuid NOT NULL REFERENCES knowledge_item(id) ON DELETE CASCADE,
  chunk_idx          int NOT NULL,
  text               text NOT NULL,
  vector             vector(768),                       -- pgvector (or sqlite-vec on-node)
  meta               jsonb
);
CREATE INDEX idx_embedding_item ON embedding(knowledge_item_id);

CREATE TABLE memory_node (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('semantic','episodic','procedural')),
  key         text NOT NULL,
  value       jsonb NOT NULL,
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_to    timestamptz                              -- null = current; supersession on conflict
);
CREATE TABLE memory_edge (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  src         uuid NOT NULL REFERENCES memory_node(id) ON DELETE CASCADE,
  dst         uuid NOT NULL REFERENCES memory_node(id) ON DELETE CASCADE,
  rel         text NOT NULL,
  weight      real DEFAULT 1.0
);

-- ─── governance & audit ───────────────────────────────────────────────
CREATE TABLE audit_event (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  prev_hash     text,
  hash          text NOT NULL,                          -- = H(prev_hash || canonical(payload))
  actor         text NOT NULL,
  action        text NOT NULL,
  tier          smallint NOT NULL DEFAULT 0,
  payload_hash  text NOT NULL,                          -- content hashed (tier-redacted)
  sources       jsonb,
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_ts ON audit_event(tenant_id, ts);

CREATE TABLE policy (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name        text NOT NULL,
  rego        text NOT NULL,
  version     int NOT NULL DEFAULT 1,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approval (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES job(id) ON DELETE CASCADE,
  risk          text NOT NULL CHECK (risk IN ('low','medium','high')),
  blast_radius  jsonb,
  state         text NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending','approved','denied','queued','expired')),
  decided_by    uuid REFERENCES app_user(id),
  decided_at    timestamptz,
  expires_at    timestamptz NOT NULL
);

-- ─── connectors / budgets / secrets / config ──────────────────────────
CREATE TABLE connector (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  account     text,
  scopes      text[] NOT NULL DEFAULT '{}',
  tier        smallint NOT NULL CHECK (tier IN (0,1,2)),
  status      text NOT NULL DEFAULT 'disconnected'
                CHECK (status IN ('connected','needs_auth','error','disconnected')),
  secret_ref  text,                                     -- vault path, NEVER the secret
  last_sync   timestamptz
);

CREATE TABLE budget (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope       text NOT NULL CHECK (scope IN ('tenant','agent','task')),
  period      text NOT NULL CHECK (period IN ('day','month')),
  limit_usd   numeric(12,2) NOT NULL,
  spent_usd   numeric(12,6) NOT NULL DEFAULT 0,
  throttle_at numeric(3,2) NOT NULL DEFAULT 0.90,
  halt_at     numeric(3,2) NOT NULL DEFAULT 1.00
);

CREATE TABLE secret_ref (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  alias       text NOT NULL,
  vault_path  text NOT NULL,
  UNIQUE (tenant_id, alias)
);

CREATE TABLE app_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  value_type  text NOT NULL CHECK (value_type IN ('string','int','float','bool','json','secret')),
  node_scope  text NOT NULL DEFAULT 'global',
  updated_by  uuid REFERENCES app_user(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key, node_scope)
);
```

### 6.6 Row‑Level Security (RLS) — applied to **every** tenant table

```sql
-- pattern, repeated for each tenant-scoped table (job shown):
ALTER TABLE job ENABLE ROW LEVEL SECURITY;
ALTER TABLE job FORCE ROW LEVEL SECURITY;          -- even table owner is filtered

CREATE POLICY job_tenant_isolation ON job
  USING      (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

- The API sets `app.tenant_id` from the verified JWT **before the first query**, inside the
  per‑request transaction; no query runs without it.
- `FORCE ROW LEVEL SECURITY` ensures even privileged connections are filtered → the **app is never
  the sole boundary**.
- **Fencing guard** for writes (app‑enforced + checked): writes carry the job `epoch`; a write whose
  `epoch < mesh_meta.min_epoch` is rejected (stale leader can't corrupt state).

### 6.7 Tenant‑isolation test (required CI gate — pseudocode)

```python
def test_cross_tenant_isolation():
    a = make_tenant("A"); b = make_tenant("B")
    job_b = create_job(as_=b, name="secret-b")
    with acting_as(a):                       # sets app.tenant_id = A
        assert get_job(job_b.id) is None     # RLS hides B's row
        assert list_jobs() == []             # no leakage
        with pytest.raises(Forbidden):
            update_job(job_b.id, status="done")
# property-based variant fuzzes (tenant, tier, resource) combinations;
# a single leak fails the build (breaks `main`).
```

---

## 7. API design standards (clean, non‑smelly APIs)

**North stars:** Stripe API, Zalando RESTful Guidelines, Google AIP. OpenAPI is the **source of
truth** → generates `@mimir/contracts` (typed client). The web app and SDK never hand‑roll types.

### 7.1 Conventions

- **Versioned** base path `/v1`; additive changes only within a version.
- **Resource‑oriented**, plural nouns: `/v1/jobs`, `/v1/reports`, `/v1/connectors`.
- **Thin routers → services → repositories.** No business logic in routers. No DB in routers.
- **Validation at the edge** with Zod (`@mimir/shared-types`); request *and* response validated.
- **One error envelope** everywhere:

```jsonc
// HTTP 4xx/5xx
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "Job 123 not found", "trace_id": "abc123", "details": {} } }
```

- **Cursor pagination** (`?limit=&cursor=`), never offset for large sets; responses carry
  `{ data: [...], next_cursor }`.
- **Idempotency keys** on all unsafe writes (`Idempotency-Key` header); server caches result for the
  retry window so retries don't double‑apply.
- **Rate limits** per route + per tenant; `429` with `Retry-After`.
- **Every endpoint is tagged** in the OpenAPI spec with its **privacy tier** and **RBAC scope** so
  governance‑as‑code can read them.
- **No silent `catch`** anywhere — log + structured error or re‑throw.

### 7.2 Representative endpoints (illustrative)

| Method | Path | Scope | Tier | Notes |
|---|---|---|---|---|
| `POST` | `/v1/chat` (SSE/WS) | `chat:write` | by classification | streamed; returns model+tier+sources |
| `GET` | `/v1/jobs?status=&cursor=` | `jobs:read` | T0 | cursor‑paginated |
| `POST` | `/v1/jobs` | `jobs:write` | by job | idempotency‑key required |
| `POST` | `/v1/jobs/{id}/retry` | `jobs:write` | — | idempotent, skips completed phases |
| `GET` | `/v1/reports/search?q=` | `reports:read` | T0/T1 | FTS + semantic |
| `POST` | `/v1/approvals/{id}/decide` | `approvals:write` | — | PIN for destructive |
| `GET` | `/v1/audit?cursor=` | `audit:read` | T0 | hash‑chain verifiable |
| `POST` | `/v1/connectors/{kind}/connect` | `connectors:admin` | by connector | OAuth start |
| `GET` | `/v1/cost?period=` | `cost:read` | T0 | live spend + forecast |
| `GET` | `/healthz` / `/livez` / `/readyz` | public | — | **deep** health (DB+model+tailnet) |

### 7.3 Contract tests & SDK

- **Contract tests** (schemathesis/Pact‑style) fail the build on any drift between code and the
  OpenAPI spec.
- `@mimir/contracts` is generated in CI and published to the workspace; web/SDK consume it. The same
  OpenAPI spec also generates Python Pydantic models for the `services/` workers so TS and Python
  share one source of truth.
- Health endpoints follow k8s convention: `/livez` (shallow), `/readyz` (can accept work),
  `/healthz` (deep — DB writable+integrity, model reachable, tailnet up, queue progressing).

### 7.4 Worked examples (request → response)

**Chat (streamed, grounded).** `POST /v1/chat` (SSE).
```jsonc
// request
{ "session_id": "s_123", "message": "What did we decide about cache keys?", "mode": "grounded" }
// SSE events
event: token        data: {"text":"Tenant-prefixed keys "}
event: token        data: {"text":"— `tenant:{id}:{resource}`."}
event: sources      data: {"sources":[{"item":"docs/adr/0007.md","chunk":2,"score":0.91}]}
event: meta         data: {"model":"local-private","tier":0,"trust":0.94,"tokens_out":42,"cost_usd":0.0}
event: done         data: {"message_id": 88241}
```
> If max retrieval score < threshold → `event: abstain data:{"reason":"not in your sources"}`. **No fabrication.**

**Create job (idempotent).** `POST /v1/jobs`
```jsonc
// request  (header: Idempotency-Key: 3f8c…)
{ "type": "render_deck", "tier": 1, "target_node": "n_desktop", "input": { "deck_id": "d_9" } }
// 201
{ "id": "j_55", "status": "queued", "tier": 1, "idempotency_key": "3f8c…", "created_at": "2026-07-02T10:00:00Z" }
// same Idempotency-Key replayed → 200 with the SAME job (no duplicate)
```

**List jobs (cursor pagination).** `GET /v1/jobs?status=running&limit=2&cursor=eyJpZCI6...`
```jsonc
{ "data": [ {"id":"j_55","status":"running","tier":1,"cost_usd":0.12}, {"id":"j_56","status":"running","tier":0} ],
  "next_cursor": "eyJpZCI6Imo1NiJ9" }
```

**Decide approval (destructive → PIN).** `POST /v1/approvals/ap_7/decide`
```jsonc
// request
{ "decision": "approve", "pin": "••••", "note": "ok to send" }
// 200
{ "id": "ap_7", "state": "approved", "decided_by": "u_1", "decided_at": "2026-07-02T10:05:00Z" }
// on timeout the server sets state:"queued" (NEVER silent deny) and emits a P1 notification
```

**Error envelope (consistent everywhere).**
```jsonc
// 404
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "Job j_999 not found", "trace_id": "9b2a…", "details": {} } }
// 409 idempotency mismatch
{ "error": { "code": "IDEMPOTENCY_CONFLICT", "message": "Key reused with different body", "trace_id": "…" } }
// 429
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests", "trace_id": "…", "details": {"retry_after": 12} } }
```

**Deep health.** `GET /healthz`
```jsonc
// 200 healthy  (503 if any critical check fails)
{ "status": "healthy",
  "checks": { "db_write": "ok", "db_integrity": "ok", "model_reachable": "ok",
              "tailnet": "ok", "queue_progressing": "ok", "backup_fresh": "ok", "tier0_egress": 0 } }
```

**Cost.** `GET /v1/cost?period=day`
```jsonc
{ "period": "day", "spent_usd": 8.40, "by_model": {"kimi": 5.1, "claude": 2.3, "local": 0.0},
  "by_tier": {"0": 2.1, "1": 3.4, "2": 2.9}, "budget_usd": 20.0, "forecast_month_usd": 252.0,
  "throttle_at": 0.90, "halt_at": 1.00, "status": "ok" }
```

### 7.5 Versioning & deprecation policy

- Breaking change ⇒ new path version (`/v2`). Within a version: only **additive** changes (new
  optional fields, new endpoints). Removing/renaming a field is breaking.
- Deprecations announced in `CHANGELOG` + `Deprecation`/`Sunset` headers; min 90‑day window.
- The OpenAPI spec is the contract; `@mimir/contracts` regenerates in CI; **contract tests fail the
  build** on any undocumented drift.

---

## 8. RAG & knowledge subsystem (the anti‑hallucination core)

**Mandate:** for "reference the data" tasks, **retrieve + cite or abstain.** This is the product's
signature behavior and a hard requirement, not a toggle.

### 8.1 Pipeline

```
ingest → normalize → chunk → embed → index → (query) retrieve → rerank → ground → cite → audit
```

| Stage | Detail |
|---|---|
| **Ingest** | docs, code, screenshots (OCR), web (Firecrawl/local). Each item tagged with **privacy tier** + content hash. |
| **Normalize** | to clean markdown/text; strip boilerplate; preserve structure (headings, code). |
| **Chunk** | structure‑aware (by heading/function), ~512–1024 tokens, overlap; store `chunk_idx`. |
| **Embed** | **local embedding model** for T0/T1 (documents never leave the tier for embedding); cloud embed only for T2/public. int8 quantization option for storage. |
| **Index** | vector index (sqlite‑vec/FAISS) + **FTS5** keyword index; hybrid retrieval. |
| **Retrieve** | hybrid (BM25 + vector), top‑k; tier‑filtered (a T0 query never reads T2 stores it shouldn't). |
| **Rerank** | cross‑encoder/reranker; **discard chunks below a similarity threshold** (e.g. 0.7). |
| **Ground** | prompt the model with retrieved chunks + a strict instruction: *answer only from sources; cite; if insufficient, say so.* |
| **Cite** | response carries `sources: [{item, chunk, score}]`; UI shows 📎 Sources. |
| **Audit** | retrieved chunks + scores + final answer hash recorded in the audit log (replayable). |

### 8.2 Anti‑hallucination guardrails

- **Abstention is a first‑class outcome.** If top‑k max score < threshold or coverage is poor →
  *"I don't have that in my sources."* Never fabricate.
- **Citation enforcement:** a grounded answer without ≥1 valid source is rejected by a post‑check
  and retried/abstained.
- **Faithfulness eval** (golden set): periodic eval scoring answer‑vs‑source faithfulness; alert on
  regression > 10% (model drift).
- **Generic generation is gated:** allowed for explicitly creative/brainstorm intents; **disallowed**
  for factual/reference intents (intent classifier decides; default = grounded).
- **Provenance in audit:** every factual answer is reconstructable — what was retrieved, why, what
  was said.

### 8.3 Storage & growth controls

- Embeddings: 768‑dim → ~3KB/chunk; **int8** option = ~4× smaller. Tiered retention: hot in
  `state.db`, warm compressed, cold archived; orphaned embeddings GC'd.
- Per‑tenant isolation on all knowledge/embedding tables (RLS).

### 8.4 Intent routing (grounded vs generative)

A lightweight **intent classifier** decides the generation mode per turn:

| Intent | Mode | Example |
|---|---|---|
| factual / "reference the data" | **grounded** (RAG, cite‑or‑abstain) | "what did we decide…", "summarize /docs" |
| how‑to over *our* code/docs | **grounded** | "how does our auth middleware work?" |
| creative / brainstorm | **generative allowed** | "give me 10 name ideas" |
| code generation | **grounded by repo context** + review loop | "add pagination to reports" |
| ambiguous | **default grounded** (safer) | — |

- Default is **grounded**; generative is the explicit exception. The chosen mode is shown to the
  user (badge) and recorded in the audit log.
- Parameters (tunable per tenant): `chunk_size=512–1024`, `overlap=64–128`, `top_k=8`, `rerank_top=4`,
  `min_score=0.7`, `max_context_tokens` budget‑bounded.

### 8.5 Faithfulness eval harness (catches hallucination + model drift)

- **Golden set:** N curated (question, sources, expected‑answer‑contains, must‑cite) cases per tenant
  domain.
- **Metrics:** *faithfulness* (answer entailed by cited sources), *citation precision/recall*,
  *abstention correctness* (abstains when it should), *answer‑relevance*. Computed with a judge model
  + deterministic checks.
- **CI gate (golden test):** a grounded answer **must** cite ≥1 valid source or abstain; a fabricated
  claim (answer not entailed by any source) **fails the build**.
- **Drift watch:** weekly eval; alert if faithfulness drops >10% (provider silently updated the
  model) → pin a dated endpoint / investigate.
- **Red‑team:** adversarial prompts ("ignore your sources and guess") must still abstain/cite.

---

## 9. Graph‑native shared memory

Beyond vector RAG: a **knowledge graph** for multi‑hop reasoning the vector store can't do
("how does this user's microservices preference relate to the March architecture decision?").

### 9.1 Memory types (CoALA framework [wide06])

| Type | Example | Store |
|---|---|---|
| **Semantic** | facts/preferences ("budget cap $50K") | `memory_node{kind:semantic}` |
| **Episodic** | past experiences ("last Dec optimized Docker on ECS") | `memory_node{kind:episodic}` + session links |
| **Procedural** | learned behaviors ("team uses Black, 120 cols") | `memory_node{kind:procedural}` |

### 9.2 Capabilities

- **Multi‑hop traversal** (Cypher/Gremlin‑style) combined with vector similarity for retrieval.
- **Contradiction & staleness handling:** `valid_from/valid_to` versioning; new facts supersede;
  conflicts flagged for review rather than silently overwritten.
- **Time‑machine:** branch (explore an alternative without losing the main line), rewind to any
  checkpoint, diff two memory states, restore — all **gated** (approval) and **idempotent**.
- **Per‑tier isolation:** T0 memory never surfaces into a T2 context.

### 9.3 Interfaces

- Graph viewer in the web app (interactive nodes/edges, click to traverse).
- Programmatic: `/v1/memory/query`, `/v1/memory/branch`, `/v1/memory/restore`.

---

## 10. Orchestration (Temporal + the model loop)

### 10.1 Why Temporal

Durable execution: workflows survive crashes/restarts; activities get **automatic retries with
backoff**, **idempotency**, timeouts, and **exactly‑once** semantics — exactly the determinism the
88%‑failure data demands. Replaces hand‑rolled queues/fencing where it fits.

### 10.2 Core workflows

| Workflow | Steps |
|---|---|
| **TaskWorkflow** | classify tier → route model/node → execute activity → review loop → persist → deliver |
| **ReviewLoop** | workhorse drafts → reviewer critiques (AST‑diff + JSON‑patch) → apply → repeat (**max 3**, cycle‑detected) → else escalate (MoA/human) |
| **RoutineWorkflow** | cron/trigger → run task → deliver via channel → record |
| **DesktopJob** | WoL → health‑check → dispatch (gVisor) → collect → suspend |
| **CloudAutomation** | start instance → run (tmpfs) → ship report (short‑lived signed webhook) → wipe → stop |
| **FailoverWorkflow** | detect leader down → freshest replica → bump epoch → promote → announce |

> **Substrate note (§5.1):** the *execute* / *review* / *deliver* activities above are
> implemented by Mimir's own engine. Temporal supplies durability, fencing, idempotency,
> and workflow orchestration; Mimir supplies classification, audit, cost governance, and
> tier enforcement. Model adapters, tools, skills, connectors, and sandboxes are Mimir's
> own code, informed by the breadth of agent runtimes like Hermes but not delegated to them.

### 10.3 The classification gateway

- Inspects prompt + attachments + retrieved context for sensitivity (PII, secrets, proprietary
  markers, custom patterns) → assigns **T0/T1/T2**.
- **Routes:** sensitive → private/local model; public/stripped → workhorse; reviewer for quality.
- **Policy‑as‑code** (OPA/Rego) defines the rules, versioned + audited. Decision latency target
  < 10ms; every decision logged.
- **Identifier scrubber** before any T2/workhorse dispatch (code‑name mapping for hostnames, secrets,
  proprietary names).

### 10.4 The review loop (quality + cost)

- **AST‑diff:** only changed functions/classes + minimal context go to the reviewer (saves tokens,
  avoids context exhaustion / rate limits).
- **JSON‑patch (RFC 6902):** reviewer returns structured patches + brief rationale; orchestrator
  applies trivial fixes natively, delegates complex ones back to the workhorse.
- **Bounded:** max 3 iterations + revision‑hash cycle detection + per‑job token budget → escalate to
  Mixture‑of‑Agents or human rather than loop forever.
- **Cross‑model:** reviewer ≠ same model that generated (no self‑review).

### 10.5 Workflow pseudocode (Temporal — illustrative)

```python
@workflow.defn
class TaskWorkflow:
    @workflow.run
    async def run(self, req: TaskRequest) -> TaskResult:
        # 1. classify privacy tier (policy-as-code) — deterministic, logged
        tier = await act(classify, req, start_to_close=timedelta(seconds=5))
        route = await act(choose_route, req, tier)          # model + node by tier
        await act(audit, Event("route", tier=tier, route=route))

        # 2. budget pre-flight (cost governor) — may queue for approval
        if not await act(budget_ok, req.tenant, route.est_cost):
            await act(request_approval, req, reason="budget")   # waits or queues (never silent deny)

        # 3. execute on the chosen node (gVisor if codegen) — idempotent activity
        draft = await act(execute, req, route,
                          retry=RetryPolicy(max_attempts=3, backoff=2.0),
                          start_to_close=timedelta(minutes=req.timeout or 10))

        # 4. review loop (bounded, cross-model)
        result = draft
        for i in range(3):
            review = await act(review_diff, ast_diff(result))   # AST-diff in, JSON-patch out
            if review.approved:
                break
            if seen_before(hash(result)):                       # cycle → escalate
                result = await act(moa_or_human, req, result, review); break
            result = await act(apply_patch, result, review.patch)

        # 5. persist + deliver, all audited
        await act(persist, req, result)
        await act(deliver, req, result, channels=req.channels)
        await act(audit, Event("done", job=req.id, cost=result.cost))
        return result
```

- **Determinism:** all side effects are **activities** (retried, idempotent); the workflow body is
  deterministic and crash‑safe (replayed from history on worker restart).
- **Fencing:** every external/persist activity stamps the current **epoch**; stale‑epoch activities
  are rejected (§11.2).
- **Timeouts:** per‑activity `start_to_close`; heartbeats for long render/ingest activities.

---

## 11. Resilience & consensus (fail‑soft, never hard)

**Principle:** no node outage may crash the brain or dump a stack trace. Detect → report *"X is
offline"* → queue durably → auto‑recover.

### 11.1 Health & detection

- **Heartbeat** every 60s probes each node (Tailscale ping + deep service health) → `health.json`
  status map; **sub‑second TCP keepalive** for the active control connection (don't wait 60s).
- State transitions emit a **debounced** toast/notification (2 misses before "down").
- Deep health, not ping‑lies: DB writable+integrity, model reachable, queue progressing, backup
  fresh, disk/mem within limits.

### 11.2 Consensus & failover (zero data loss)

- **Single writer** + **monotonic fencing epoch**; only the current epoch may write. Stale‑epoch
  writes **rejected at the DB** (`CHECK(epoch >= min_epoch)`) **and** at external APIs.
- **External lock** (etcd / DynamoDB conditional‑write / tiny always‑on witness) — **not** a single
  phone witness (avoids the split‑brain failure the chaos review found).
- **LibSQL embedded replicas**: continuous streaming → candidates hold up‑to‑the‑second copies;
  **synchronous ack for T0 completions** so acknowledged work is durable.
- **Failover:** leader down (debounced) → freshest replica wins (ties by priority laptop>desktop>cloud)
  → bump epoch → promote → update the "current‑leader" pointer → announce. Revived old leader sees a
  higher epoch → demotes to replica.
- **Read‑only during transitions**; **monotonic clocks** + skew detection (no premature failover).

### 11.3 Resilience patterns

| Pattern | Purpose |
|---|---|
| **Circuit breakers** per provider/node | stop hammering a failing dependency; fast‑fail + fallback |
| **Idempotent replay** | per‑phase checkpoints + recorded side‑effects; retry never double‑applies |
| **Durable queue** (kanban‑as‑queue in state.db) | survives reboots; blocked‑offline cards auto‑retry with backoff |
| **WoL‑aware dispatch** + connection‑pool isolation | prevents the retry‑storm cascade |
| **Admission control / backpressure** | shed/queue load when overloaded; load‑shed reduces RAG/output |
| **Graceful shutdown** | SIGTERM drain + checkpoint in‑flight jobs |
| **Corruption defense** | content‑hash WAL entries + app‑level validation + periodic integrity_check + reconcile vs source of truth |

### 11.4 Chaos engineering

Weekly automated fault injection (kill node, latency spike, API blackhole, disk‑full, memory
pressure, WAL corruption) with **safety invariants** that must hold (task completion ≥ 95%, p99 ≤ 2×
baseline, token spend ≤ 3× budget, **zero T0 egress**, state consistent after single‑node failure,
recovery < 30s). Invariant violation → automatic rollback + alert. (Deferred to M3+, see §22.)

### 11.5 Per‑node degradation (what happens when each goes down)

| Node down | Detection | Fail‑soft behavior | Fallback |
|---|---|---|---|
| **Laptop / brain** | clients conn‑refused | UI shows **"Brain offline — read‑only"**; desktop serves its read‑only replica for history | systemd auto‑restart; Tailscale reconnect; backup copy intact |
| **Reviewer (Claude) down/rate‑limited** | probe / 429 | review **skipped with notice** ("merged without review, queued"); workhorse **not blocked** | queue review; optional MoA sanity check |
| **Desktop** (WoL fail/asleep) | tailscale ping fail | job → `blocked: desktop offline`; user told "deferred" | retry WoL; else run locally or on cloud (if non‑sensitive) |
| **Cloud worker** (won't start/unreachable) | start error/ping fail | automation → `blocked: cloud offline`; "deferred" | retry w/ backoff; run locally if non‑sensitive; never drop |
| **Workhorse API** (primary key) | API error/429 | **fallback chain** kicks in (2nd key → OpenRouter → local) | Mimir fallback chain; banner "degraded" |
| **Internet down** | egress probe fails | **offline mode**: history + RAG from local; new requests queued | local Ollama; auto‑resume on reconnect |
| **Delivery channel** (chat/email) | send error | retry w/ backoff; fall back to local toast + web | report never lost (already on disk) |

### 11.6 Chaos experiment catalog (weekly; from the chaos review's 20 scenarios)

| # | Inject | Hypothesis (must hold) |
|---|---|---|
| C‑01 | Tailscale 200ms latency (`tc netem`) | jobs complete ≤5× normal; queue doesn't deadlock |
| C‑02 | Workhorse API blackhole (`iptables DROP`) | circuit opens; fallback engages; no retry storm |
| C‑03 | Kill brain process 5 min | desktop promotes (fencing); **0 data loss**; recovery <30s |
| C‑04 | state.db WAL byte‑flip | corruption detected (content hash); restore from replica/S3 |
| C‑05 | Disk 95% full (`fallocate`) | stop accepting new jobs; write‑failure‑is‑fatal; alert |
| C‑06 | Desktop memory pressure (`stress-ng`) | OOM kills lowest‑priority container only; brain unaffected |
| C‑07 | Desktop asleep + 15 queued jobs | WoL‑aware dispatch; **no retry storm**; pool isolation holds |
| C‑08 | Clock skew +5min on brain | skew detection blocks premature failover |
| C‑09 | Reviewer rejects 3× (loop) | loop breaks at max‑3; escalates; bounded cost |
| C‑10 | Partition brain↔desktop (APIs reachable) | strict tier enforcement: T1 jobs wait, **never escalate to cloud** |
| C‑11 | Ship‑and‑wipe crash mid‑upload | no residue persists; next boot reformats (tmpfs) |
| C‑12 | Stale‑epoch zombie leader revives | writes rejected (DB + API fencing); demotes to replica |
| C‑13 | Idempotency retry storm | in‑flight key set + decorrelated jitter → **no duplicate execution** |
| C‑14 | Approval backlog (user asleep) | exponential backoff on timeout; batched; T0 low‑risk auto‑approve |
| C‑15 | MCP server compromised (sim) | sandboxed; no raw creds; egress default‑deny |

**Game day (monthly):** full mesh outage + recovery; record MTTD/MTTR/data‑loss (target 0).

---

## 12. Security architecture & threat model

The credibility bar = our own production‑readiness. These controls are **prerequisites to any
reliability/governance claim** and to SOC 2 (§27).

### 12.1 Controls

| Domain | Control |
|---|---|
| **Untrusted code** | **gVisor (`runsc`)** user‑space kernel for all generated/agent code; default‑deny egress; required egress (e.g., signed webhook) allow‑listed per job; static analysis (bandit/semgrep) gate; **human approval for code execution** (LLM review is not a security boundary) |
| **Network** | **Tailscale tag ACLs** default‑deny; **cloud worker air‑gapped** off the tailnet (SSM + short‑lived signed webhook) |
| **SSH** | **ephemeral SSH certificates** (offline CA, ~5‑min validity); no static keys |
| **Secrets** | vault (or `pass`+age); **never plaintext `.env` in repo**; 30‑day rotation; least‑privilege per key; sops‑nix for declarative injection |
| **At rest** | LUKS full‑disk + **SQLCipher** for `state.db`; encrypted desktop replica |
| **Chat C2** | **no auto‑execute from Telegram/Discord/Slack** without a second factor; HMAC‑signed commands; heavy triggers via UI/2FA |
| **MCP/plugins** | sandboxed; **no raw credentials** to subprocesses (env‑filtered); signed/verified |
| **Supply chain** | hash‑pinned lockfiles; **CodeQL + dependency‑review** (no Dependabot); OpenSSF Scorecard; cosign for artifacts |
| **Audit** | tamper‑evident hash‑chain (§13); tier‑redacted logs/traces |

### 12.2 Threat model (STRIDE, per critical asset)

| Asset | Threat | Mitigation |
|---|---|---|
| `state.db` (memory) | **Tampering/Info‑disclosure** (theft) | SQLCipher + LUKS + vault; encrypted replica; FDE TPM |
| Classification gateway | **Elevation** (T0→T2 leak via bug/injection) | policy‑as‑code + packet‑verified isolation CI test; scrubber |
| Generated code path | **Elevation/RCE** (prompt injection) | gVisor + static analysis + approval gate; no auto‑exec |
| Tailnet | **Spoofing/Lateral** (compromised node) | tag ACLs default‑deny; air‑gapped cloud; tailnet lock |
| API | **Spoofing/DoS** | mTLS option, JWT short‑lived, rate limits, audit |
| Cloud worker | **Info‑disclosure** (residue) | instance‑store/tmpfs only; crypto‑wipe; power‑off |
| Approvals | **Repudiation** (who approved?) | hash‑chain audit; PIN/biometric; timeout = queue not deny |
| Chat surface | **Spoofing** (impersonation) | HMAC‑signed commands; user‑ID allowlist; 2FA for risky |

### 12.3 Data sovereignty (Kimi/PRC mitigation)

- **Data‑classification gateway** ensures T0/T1 sensitive data → Claude/local; only public/stripped
  data → the cost‑optimized workhorse. Identifier scrubbing before any external dispatch. A local
  proxy (LiteLLM‑style) enforces and **logs** the routing decision. [validation C1]

### 12.4 Known open defects (must close before selling — tracked in §24)

🔴 prompt‑injection→RCE · 🔴 Kimi/PRC exposure (mitigating) · 🟠 split‑brain (phone witness) ·
🟠 single‑writer SPOF (mitigating via LibSQL) · 🟠 plaintext at rest · 🟠 flat tailnet.

### 12.5 Attack chains (highest concern) & where we break them

| Chain | Walkthrough | Break point |
|---|---|---|
| **Laptop theft → total compromise** | unlocked/cold‑boot laptop → read `.env` + `state.db` → all keys + memory + tailnet + SSH | **LUKS+TPM FDE, SQLCipher, vault** (no plaintext), auto‑lock; keys not on disk |
| **Prompt‑injection → RCE → exfil** | poisoned web/doc → workhorse emits malicious code → auto‑exec → uploads `state.db` | **gVisor sandbox + static analysis + human approval**; no auto‑exec; default‑deny egress from sandbox |
| **Compromised cloud → pivot to T0** | cloud worker hijacked (SSRF/IMDS) → reads tailnet creds → reaches laptop:8642 | **cloud air‑gapped off tailnet** (SSM + short‑lived signed webhook, no persistent storage, destroyed after each job); even if hijacked, no lateral path |
| **Foreign‑state data access via Kimi** | workhorse processes all data → PRC jurisdiction | **classification gateway**: T0/T1 sensitive → Claude/local; scrub IDs; LiteLLM proxy logs routing |
| **Chat impersonation → command** | spoof Telegram user → "do X with attached script" → auto‑exec | **HMAC‑signed commands + user‑ID allowlist + 2FA**; chat can't auto‑exec |
| **Stale leader → dual‑write corruption** | throttled laptop misses heartbeat → desktop promotes → laptop revives, both write | **fencing epoch** (DB `CHECK` + API validation); stale writes rejected; read‑only during transition |
| **Supply‑chain (dep/CDN)** | malicious dep/install script → backdoor on brain | hash‑pinned lockfiles; **dependency‑review + CodeQL + Scorecard**; signed releases (cosign) |

### 12.6 Security controls checklist (SOC 2‑aligned, tracked to gates)

- [ ] FDE (LUKS+TPM) + SQLCipher `state.db` + encrypted replica — **G1**
- [ ] Secrets in vault; rotation 30d; least‑privilege per key; no plaintext in repo — **G1**
- [ ] Ephemeral SSH certs (no static keys); known‑hosts pinned — **G1**
- [ ] Tailscale tag ACLs default‑deny; tailnet lock; cloud air‑gapped — **G1**
- [ ] gVisor for all generated/agent code; static analysis gate; approval for exec — **G1**
- [ ] Classification gateway + packet‑verified **T0‑containment** CI test — **G1**
- [ ] No chat auto‑exec; HMAC‑signed commands; 2FA for risky — **G1**
- [ ] MCP/subprocess sandboxing; env‑filtered (no raw creds) — **G1**
- [ ] Hash‑chain audit + tier‑redacted logs — **M5**
- [ ] Supply chain: pinned hashes, CodeQL, dependency‑review, Scorecard, signed artifacts — **M0+**
- [ ] Pen‑test (external) before any enterprise pilot — **G6 prep**
- [ ] 30‑day dogfood, 0 critical — **G2**

---

## 13. Governance & audit

### 13.1 Policy‑as‑code

- **OPA/Rego** policies define: classification/routing rules, approval requirements, RBAC scopes,
  data‑residency constraints. Version‑controlled, diff‑reviewed, enforced **before** any LLM call or
  external action.
- Example (prose): *"prompts matching `/SSN|medical/` → local model only; `git push` → human
  approval; T0 data → never to cloud."*
- A **policy editor** in the web app with inline validation; changes are audited.

### 13.2 Immutable audit (hash‑chain + Merkle)

- Every operational event (prompt, response, routing decision, cost, approval, code‑exec,
  node transition) is **hashed and linked to the previous** (`prev_hash`→`hash`); a Merkle tree
  enables efficient subset verification. Tampering any event invalidates the chain.
- **Temporal replay:** reconstruct exact system state at time T (what was known, which model,
  what sources) — for incident forensics and "why did it decide X?".
- **GDPR crypto‑delete:** don't break the chain — **encrypt personal data per‑subject, then destroy
  the key**; emit a proof‑of‑deletion. The chain stays intact; the data is irrecoverable. Embeddings
  derived from personal data are linked to the subject and deleted alongside the source; a residual
  nearest‑neighbor semantic risk is documented and disclosed.
- Audit is **tier‑redacted**: T0 content not logged in clear; only metadata + hashes + sources.

### 13.3 Compliance hooks

- Endpoints carry tier + scope tags (§7) → governance can auto‑generate evidence (who accessed what,
  when, under which policy) for SOC 2 / ISO 42001 / EU AI Act Article 12 logging (§27).

---

## 14. Web app spec (screen‑by‑screen)

**Stack:** Next.js 15 (App Router) · TS · Tailwind · shadcn/ui · Clerk · PWA · TanStack Query ·
typed WS. **Law** (`apps/web/AGENTS.md`): Zod single‑source‑of‑truth; `react-hook-form +
zodResolver`; `sonner` toasts from `ApiError.userMessage`; one state machine per surface;
Tailwind‑only; centralized Cmd+K + shortcuts; no silent catch; all calls via the generated client;
every AI surface shows **model + trust + privacy‑tier** badges; global **Emergency HALT** + **cost
chip**; offline banner. **Kid‑simple default; expert panels on demand.**

For each screen: *purpose · key components · states · primary actions · empty/error/offline.*

### 14.1 Console (primary chat)
- **Purpose:** talk to the brain; the front door.
- **Components:** message stream (streamed), composer (text/voice/image/file), per‑message badges
  (model/tier/trust) + **📎 Sources**, "show steps" expander, slash‑commands, Cmd+K palette.
- **States:** idle / streaming / awaiting‑approval / offline (local‑model banner).
- **Actions:** send, attach, continue‑session, branch, copy, cite, rerun.
- **Empty:** suggested starters ("Summarize my docs", "What did I decide last week?").

### 14.2 Status / Topology
- **Purpose:** at‑a‑glance mesh health — *visual, never JSON*.
- **Components:** node boxes (laptop/desktop/cloud/phone) color‑coded; connection lines w/ transport
  + tier badges; "down since" timers; queue depth; active/blocked counts; **cost burn chip**.
- **Actions:** tap node → detail drawer (health checks, jobs, cost); wake desktop; view logs.

### 14.3 Tasks / Kanban
- **Purpose:** one unified stream of routine + ad‑hoc work.
- **Columns:** Queued · Running · Blocked(node offline) · Needs‑Attention · Done.
- **Card:** title, tier, model, cost estimate, blast‑radius, retry (idempotent, "won't re‑send"
  notes), open trace.
- **Actions:** reprioritize (drag), retry, cancel, inspect, escalate.

### 14.4 Approvals inbox
- **Purpose:** humane human‑in‑the‑loop.
- **Card:** action summary, **blast‑radius preview**, confidence/agreement badge (workhorse % /
  reviewer % ✓agree), risk level, **tiered timeout** countdown.
- **Actions:** Approve (PIN/biometric for destructive) · Deny(reason) · Snooze · Delegate · Approve
  w/ note · Defer to desktop. **Timeout = queued for review, never silent deny.** Batch‑approve;
  focus‑mode.

### 14.5 Reports
- **Purpose:** browse + search outputs.
- **Components:** timeline; **FTS + semantic search**; filters (tier/model/skill/date/tag); preview
  pane; 4‑channel delivery status.
- **Actions:** export (PDF/MD), share, pin, open sources.

### 14.6 Knowledge / Docs / References
- **Purpose:** feed and inspect the RAG well.
- **Components:** ingest (drag‑drop docs/code; connect repos); **Screenshots‑as‑references** gallery
  (snap→tag→search); per‑item **tier** label; "answers cite these."
- **Actions:** ingest, tag, delete (GDPR), re‑index, test‑retrieve.

### 14.7 Memory
- **Purpose:** time‑machine + graph.
- **Components:** timeline of checkpoints; **branch/rewind/restore/diff**; interactive **graph viewer**
  (nodes/edges, click‑to‑traverse, semantic/episodic/procedural filter).
- **Actions:** branch, rewind (gated), diff, restore (gated), pin.

### 14.8 Governance / Audit
- **Components:** **policy‑as‑code editor** (Rego, inline validation, versioned); **audit log viewer**
  (hash‑chain, tamper badge, **temporal replay** "state at time T"); privacy‑tier flow map.
- **Actions:** edit policy (PR‑like review), verify chain, replay, export evidence.

### 14.9 Cost / Budget
- **Components:** live spend by model/node/task/tier; budgets + thresholds (warn 70 / throttle 90 /
  halt 100); anomaly alerts; **pre‑flight estimate** ("$2.40 cloud vs $0 desktop, 90s slower").
- **Actions:** set budgets, throttle rules, drill‑down.

### 14.10 Connectors hub
- **Components:** connector cards (status / account / scopes / last‑sync / **tier** / enable / test);
  OAuth connect flow (consent → scopes → success/fail); embedded chat surfaces for Discord/Slack/Telegram.
- **Actions:** connect, re‑auth, scope‑edit, disable, test, open chat.

### 14.11 Routines / Automations
- **Components:** schedule (cron) or trigger (time/webhook/connector‑event/page‑change); target node;
  delivery channel; run history.
- **Actions:** create (kid‑mode wizard *or* expert policy), enable/disable, run‑now, view runs.

### 14.12 Settings
- **Sections:** Nodes (add/WoL/health) · **Secrets** (vault‑backed, never raw) · Notification tiers +
  quiet hours · Model routing & fallback · Privacy‑tier rules · Account/Tenant/SSO (multi‑user
  scaffold) · Appearance (themes/tokens) · Voice (TTS/STT).

### 14.13 Mobile / PWA views
- Glanceable status (4 node squares + one‑liners); **swipe approvals**; voice‑first ("what's the
  status?"); the **HALT** button; install‑to‑home‑screen; push‑ready.

### 14.14 Marketplace (Ent, feature‑flagged)
- Browse/install/publish agents & skills; ratings; install flow; private (intra‑tenant) marketplace.

### 14.15 Cross‑cutting UI primitives
- Global **Emergency HALT**, **cost burn chip**, **offline banner**, **notification center** (tiered,
  dedup'd), **command palette** (Cmd+K), **badges** (model/tier/trust), **a11y** (WCAG AA, keyboard).

### 14.16 Deep specs — the four most complex screens

**Console — component tree & state machine.**
```
<ConsoleScreen>
 ├─ <SessionHeader> (title, model badge, tier badge, branch button)
 ├─ <MessageList>
 │   └─ <MessageBubble role>  (markdown, code blocks, <TrustBadge/>, <SourcesChip/>, <StepsExpander/>)
 ├─ <ApprovalInline?>  (if a turn raised an approval)
 └─ <Composer>  (textarea, <AttachMenu> file/image/voice, <ModelPicker advanced/>, send)
```
State machine (`useConsole`): `idle → sending → streaming → (awaiting_approval | done | error | offline)`.
Transitions: `send`→sending; first token→streaming; `sources`/`meta` events update badges;
`approval` event→awaiting_approval (composer disabled, inline card shown); network drop→offline
(banner + "local model active", composer stays enabled if local available). **Empty:** suggested
starters. **Error:** toast from `ApiError.userMessage` + retry affordance, never a raw trace.

**Status/Topology — components & states.**
```
<StatusScreen>
 ├─ <OverallBanner level=green|amber|red>
 ├─ <NodeGraph>  (react-flow: <NodeCard kind health tier jobs cost/>, <EdgeLabel transport tier/>)
 ├─ <QuickStats> (active, queued, blocked, failed-today, today-cost)
 └─ <NodeDrawer?> (health checks, recent jobs, cost, [Wake][Logs][Suspend])
```
Realtime via WS; node states `up|degraded|down|unknown` drive color; "down since" timer; a `down`
node shows **"offline — queued N jobs"**, *not* an error. Offline‑of‑brain → read‑only banner +
serve cached topology.

**Approvals — the humane gate.**
```
<ApprovalCard>
 ├─ header: #id · from node · model · risk(low|med|high)
 ├─ <ActionSummary> + <BlastRadius> (services/users/cost affected)
 ├─ <AgreementBadge workhorse% reviewer% agree?>
 ├─ <Countdown timeout/>  (low 24h / med 4h / high 15m+call)
 └─ actions: [Approve] [Deny(reason)] [Snooze] [Delegate] [Approve w/ note] [Defer to desktop]
```
Destructive ⇒ `<PinPrompt>` before approve. **Timeout → state `queued` (review), never `denied`.**
Batch mode groups by blast‑radius; focus‑mode suppresses non‑critical. All decisions audited.

**Memory — time‑machine + graph.**
```
<MemoryScreen>
 ├─ <CheckpointTimeline> (markers; select two → <DiffView/>)
 ├─ <Controls> [Branch] [Rewind(gated)] [Restore(gated)] [Diff]
 └─ <GraphViewer> (cytoscape/react-flow; filter semantic|episodic|procedural; click→traverse)
```
Rewind/restore are **approval‑gated** and **idempotent** (re‑apply = no‑op); contradictions surface
as flagged nodes for review, not silent overwrite.

### 14.17 Shared component states (every data surface)
Each list/detail surface implements **five states**: `loading` (skeletons), `empty` (guidance +
primary action), `error` (toast + retry, no raw trace), `offline` (cached + banner), `partial`
(load‑shed: reduced detail under backpressure). Required for Console, Tasks, Reports, Knowledge,
Connectors, Cost, Audit.

---

## 15. Connector specs

Common contract: each connector implements `connect()/disconnect()/status()/sync()/test()`, declares
**scopes** + a **default privacy tier**, stores only a `secret_ref` (vault), and ships **integration
+ contract tests**. OAuth flows are built UI‑first against mock auth, real creds wired later.

| Connector | Auth | Default tier | Key capabilities | Notes |
|---|---|---|---|---|
| **GitHub** | OAuth app / fine‑grained PAT | T1 | repos, issues, PRs, Actions, code read for RAG, open PR | powers the code review loop |
| **Mail (Gmail)** | OAuth (Google) | T0 (content) | read/triage, **draft‑for‑approval**, send (gated) | minimal scopes; send‑gated |
| **Mail (MS Graph)** | OAuth (Entra) | T0 | inbox triage, calendar, draft replies | webhook change‑notifications |
| **Airtable** | OAuth / PAT | T1 | list bases/tables, read/write rows | also the §23 features‑table sink |
| **Contacts** | OAuth (Google/MS) | T0 | read contacts for context | minimal scope; read‑only default |
| **Docs** | OAuth (Google/Notion) / local | T0/T1 | read for RAG; generate `.docx/.pptx` | office‑gen via worker |
| **Screenshots‑refs** | local capture | T0 | capture → OCR → tag → searchable; "look at my screen" | vision pipeline; tmpfs cache |
| **Discord** | bot token | T1 | server/channel list, read/send, slash; **embedded UI** | connector **and** chat surface |
| **Slack** | OAuth (Slack app) | T1 | channels/threads, read/send; **embedded UI** | connector **and** chat surface |
| **Telegram** | bot token | T1 | chat list, send/receive, voice notes, approvals; **embedded UI** | primary phone channel; HMAC‑sign |

**Per‑connector security:** least‑privilege scopes; tier label drives routing (e.g. mail *content* is
T0 → never to cloud); no auto‑execute from chat connectors without 2FA; tokens in vault with short
TTL where supported; every connector action audited.

**Build order (M6, one small PR each):** GitHub → Telegram → Mail(Gmail) → Discord → Slack →
Airtable → Contacts → Docs → Screenshots → Mail(MS Graph).

### 15.1 GitHub (F‑018) — default tier **T1**
- **Auth:** GitHub App (preferred) or fine‑grained PAT; OAuth device flow for user link. Token in
  vault (`secret_ref`); short‑lived installation tokens refreshed server‑side.
- **Scopes (least‑privilege):** `contents:read` (RAG), `pull_requests:write` (open PRs),
  `issues:read/write`, `actions:read`, `metadata:read`. No `admin`, no org‑wide unless asked.
- **Operations:** list/read repos & files (feed RAG), read issues/PRs, **open a PR** (the
  workhorse→reviewer loop output), comment, read Actions status, react to webhooks (PR/push).
- **Data model:** maps repos/PRs/issues to `knowledge_item` (code) + `job` (PR creation). Code
  ingested for RAG is tagged **T1** by default (proprietary → keep local).
- **Privacy:** private‑repo content never routes to the cloud workhorse; classification gateway
  forces T0/T1 model. Identifier scrubber before any external dispatch.
- **Tests:** integration against a mocked GitHub API (e.g. `nock`/`msw`) + contract test of the PR
  payload; e2e: "fix bug → open PR" happy path.

### 15.2 Telegram (F‑021) — default tier **T1** · *connector **and** primary phone surface*
- **Auth:** Bot token (via @BotFather) in vault; **user‑ID allowlist** (only you/approved users).
- **Capabilities:** chat list, send/receive text, **voice notes** (→ STT), inline buttons for
  **approvals**, file delivery (reports), embedded chat surface in the web app.
- **Security (critical — chat = C2):** **no auto‑execute** from a message without a 2nd factor;
  **HMAC‑sign** commands with a key held only on the phone; the gateway verifies before queuing.
  Heavy "do X" triggers either come from the UI or require the 2FA tap. Rate‑limited.
- **Delivery role:** a P0/P1 notification channel (§16); approval cards render as inline buttons.
- **Tests:** integration (mock Bot API) for send/receive/approve; e2e: approval round‑trip; security
  test: unsigned command rejected.

### 15.3 Mail — Gmail (F‑019) — default tier **T0 (content)**
- **Auth:** Google OAuth (offline access); token in vault; minimal scopes
  `gmail.readonly` (triage) + `gmail.send` (gated) — **not** full `gmail.modify` unless needed.
- **Capabilities:** inbox triage (classify/summarize), **draft a reply that waits for approval**,
  send (only after explicit approval), thread context for RAG.
- **Privacy:** email **content is T0** → summarized/drafted by a **local/private model**; never sent
  to the cloud workhorse. Only non‑sensitive metadata may inform routing.
- **Human‑in‑the‑loop:** every outbound email is an **approval‑gated** action (blast‑radius =
  recipients); timeout = queued, not sent.
- **Tests:** integration (mock Gmail) for triage + draft; security: send blocked without approval;
  privacy: content never leaves T0 (network assertion).

### 15.4 MS Graph mail/calendar (F‑019) — default tier **T0**
- **Auth:** Microsoft Entra OAuth; token in vault; scopes `Mail.Read`, `Mail.Send` (gated),
  `Calendars.ReadWrite` (if calendar enabled) — minimal.
- **Capabilities:** inbox triage + draft‑for‑approval; calendar read/schedule; **change‑notification
  webhooks** for real‑time inbox events; meeting‑prep briefs (attendee context + recent threads).
- **Privacy/HITL:** same as Gmail — content T0, sends approval‑gated.
- **Tests:** integration (mock Graph) + webhook signature verification test.

### 15.5 Discord (F‑021) — default tier **T1** · *connector **and** embedded chat surface*
- **Auth:** bot token in vault; guild/channel allowlist; OAuth2 for the install.
- **Capabilities:** list servers/channels, read/send messages, slash commands, embedded channel UI
  in the web app, deliver notifications.
- **Security:** Discord scans content → **non‑sensitive (T1) only**; no T0 routing through Discord;
  no auto‑execute without 2FA; signed commands.
- **Tests:** integration (mock gateway/REST) for send/receive/slash; e2e for the embedded surface.

### 15.6 Slack (F‑021) — default tier **T1** · *connector **and** embedded chat surface*
- **Auth:** Slack app OAuth (bot + user tokens as needed); token in vault; minimal scopes
  (`channels:read`, `chat:write`, `channels:history` as required).
- **Capabilities:** list channels, read threads, send messages, embedded UI, notifications.
- **Security:** workspace allowlist; T1 only; signed/verified events (Slack signing secret);
  no auto‑execute without 2FA.
- **Tests:** integration (mock Slack) + signing‑secret verification test.

### 15.7 Airtable (F‑020) — default tier **T1**
- **Auth:** OAuth or PAT; token in vault; base‑scoped access.
- **Capabilities:** list bases/tables, read/write rows. **Also the sink for the §23 features
  table** (mirror the roadmap features to an Airtable base for tracking).
- **Privacy:** treat base content per its sensitivity (default T1); user can mark a base T0.
- **Tests:** integration (mock Airtable) for read/write; round‑trip test of the features‑table sync.

### 15.8 Contacts (F‑020) — default tier **T0**
- **Auth:** Google/Microsoft People/Graph OAuth; token in vault; scope `contacts.readonly` by
  default (read‑only).
- **Capabilities:** read contacts to enrich context (e.g. "who is this email from?").
- **Privacy:** **PII → T0**, local‑only enrichment; never to cloud; never written without explicit
  user action.
- **Tests:** integration (mock) + privacy assertion (no egress).

### 15.9 Docs (F‑020) — default tier **T0/T1**
- **Auth:** Google Docs / Notion OAuth, or local files; token in vault.
- **Capabilities:** read documents for RAG; **generate `.docx`/`.pptx`** via Python worker
  (e.g. the `pptx-author` skill); write‑back optional + gated.
- **Privacy:** document content tiered (default T0 for personal/proprietary); local embedding.
- **Tests:** integration (mock) for read; golden test for generated artifact structure.

### 15.10 Screenshots‑as‑references (F‑015) — default tier **T0**
- **Auth:** local capture (OS screenshot) — no external auth; OCR via local/worker.
- **Capabilities:** capture → OCR → auto‑tag → store as `knowledge_item{kind:screenshot}` →
  searchable; powers **"look at my screen and fix it"** (image → vision → action, gated).
- **Privacy:** screenshots are **high‑PII → T0**; cached in **tmpfs**, short TTL; vision runs on a
  private/local multimodal model for T0; never to cloud.
- **Tests:** e2e: capture → searchable → cited in an answer; privacy: tmpfs‑only, auto‑purge.

### 15.11 Connector cross‑cutting requirements (all)
- Implement the common interface (`connect/disconnect/status/sync/test`), declare **scopes + default
  tier**, store only a `secret_ref`, expose a **test** action, and ship **integration + contract
  tests**. Every connector action is **audited**. OAuth flows built UI‑first against mock auth; real
  creds wired behind the vault. **No connector may widen a request's privacy tier** (e.g. a T0
  source can't be force‑routed to the cloud workhorse).

---

## 16. Delivery & notifications

### 16.1 The four channels

| Channel | Use | Default tier of alert |
|---|---|---|
| **Local toast** (`notify-send`) | desktop/laptop, immediate | P1/P0 |
| **Telegram/Discord/Slack push** | phone/anywhere | P0/P1 |
| **Open WebUI / Reports view** | browse history | P2 |
| **Email digest** | periodic roll‑up | P3 |

### 16.2 Notification tiers (anti‑alert‑fatigue, from the UX review)

| Tier | Meaning | Routing | Example |
|---|---|---|---|
| **P0** | act now | call + toast | runaway cost auto‑halt; node down 2m |
| **P1** | push | one push channel | approval request; job failed |
| **P2** | badge | UI badge only | job complete |
| **P3** | digest | email roll‑up | daily summary |

- **Dedup token:** every notification carries a UUID; dismiss on one channel → suppressed on all.
- **One channel per concern** (no 4× duplication). Quiet hours + DND with P0 breakthrough.
- **Batching windows** ("5 tasks done at :00 and :30", not 5 pings).

### 16.3 Report delivery pipeline

A finished report (in `~/Reports/`) fans out via a post‑job hook: local toast + auto‑download →
chat push → Open WebUI Knowledge entry + kanban card → daily email digest. **Multi‑channel
redundancy**: a report is never lost (it's already on disk); channel failure retries with backoff
and falls back to local + web.

### 16.4 Voice & telephony (later)

Telegram voice note → STT (Whisper/Groq) → agent → TTS (Edge) reply. Optional telephony: dial a
number → STT → agent → TTS, caller‑ID allowlisted. Same auth posture as chat connectors.

---

## 17. Cost governance

**Both a feature and a COGS discipline** (AI gross margins 50–60% vs SaaS 80–90% [wide04]). Four
nested layers:

| Layer | Mechanism |
|---|---|
| **Per‑task ceiling** | every task carries a token budget; breach → circuit‑breaker → smaller model / truncate / pause for approval |
| **Per‑agent/day cap** | each agent identity has a spend limit; runaway loops throttle/terminate |
| **Per‑tenant quota** | soft warn @70%, hard throttle @90%, halt @100% |
| **Global breaker + forecast** | pre‑flight cost forecast; if forecast > budget → queue/approve or route cheaper; post‑hoc reconcile improves the forecast |

- **Per‑request attribution:** tokens + $ tagged to model/provider/node/task/tier; **don't charge**
  for retries, timeouts, cache hits, validation runs.
- **Kimi context caching** (~80% input savings) + Tier‑2 precharge + client token‑bucket to dodge 429s.
- **Async review pipeline** (stream workhorse output, review in background) + **parallel cold‑start
  pre‑warm** (WoL + cloud + Ollama keep‑alive fired together) to cut the 30–244s cascade.
- **Anomaly auto‑halt:** today's spend > 1.5× average → emergency mode (local model only) + P0 alert.
- **Cost SLO:** monthly envelope tracked (personal **$112–650/mo** [perf review]); enterprise target
  **GM > 40%** at 10 customers (Gate G8) → dogfood‑proven **>70%** bet via local + routing.

### 17.1 Cost model reference (RAG‑grounded, [perf review])

| Driver | Monthly (moderate) | Notes |
|---|---|---|
| Workhorse API (cached) | $35–80 | with ~80% cache hit |
| Reviewer (Claude Pro ×2 or API) | $40 (subs) / $6–18 (API) | API uncapped + cheaper at this volume |
| MoA (OpenRouter, hard tasks only) | $7–36 | short‑circuited |
| Cloud worker (idle‑stopped) | ~$3–5 | start‑on‑demand |
| Laptop power (24/7) | $2–5 | battery/thermal caveats |
| **Total (moderate)** | **$112–258** | heavy: $350–650 |

---

## 18. Observability (right‑sized for personal → product)

**Now (personal/lightweight):** structured logs (tier‑redacted), per‑request cost + token metrics,
queue depth, MTBF, deep health (§7.3), a weekly cost+capacity report. **Later (product, §II‑G
deferred):** Prometheus + Grafana + Alertmanager, OpenTelemetry traces (Jaeger/Tempo), Loki logs,
SLO burn‑rate alerts (Sloth/Pyrra).

### 18.1 Metrics (RED/USE)

```
mimir_requests_total{model,endpoint,status}            # counter
mimir_request_duration_seconds{model,endpoint}          # histogram
mimir_tokens_{input,output}_total{model}                # counter
mimir_cost_usd_total{model,provider,tier}               # counter
mimir_queue_depth{queue}                                # gauge
mimir_db_size_bytes / db_query_duration_seconds         # gauge/histogram
mimir_tailscale_latency_seconds{node}                   # gauge
mimir_circuit_breaker_state{provider}                   # gauge 0/1/2
mimir_job_retries_total{type}                           # counter
mimir_tier0_egress_total                                # counter — MUST stay 0
```

### 18.2 Logging & tracing

- **Structured** (structlog/pino) with `trace_id`, `tenant_id`, `privacy_tier`, `job_id`.
- **Tier‑aware redaction:** T0 input/output **not** logged in clear (metadata only); T1 summary;
  T2 full. Secret‑pattern scrubbing in all sinks.
- **Distributed tracing** (later): W3C `traceparent` propagated across api→worker→cloud; tail‑based
  sampling keeps 100% of errors + slow traces.

### 18.3 SLIs/SLOs (see §26 for full table)

API availability 99.9%; report p95 < 60s / p99 < 300s; job durability 5 nines; **T0 leakage = 0**;
30‑day dogfood MTBF ≥ 720h.

---

## 19. Testing strategy (the pyramid is mandatory)

**No PR merges red.** Coverage gate on **new** code ≥ 85%. The word "test" appears because the
reviews flagged its total absence as a top failure cause [SRE/missing‑caps].

| Layer | Tool | What |
|---|---|---|
| **Unit** | Vitest (TS) / pytest (py) | services, gateway, queue, RAG, classification, cost |
| **Property** | fast‑check / hypothesis | **tier/tenant invariants** (a T0/tenant‑A req never reads B or egresses) |
| **Integration** | testcontainers (Postgres/Redis/Temporal) | api+db, WoL, replication, ship‑and‑wipe |
| **Contract** | schemathesis/Pact | OpenAPI ↔ TS client ↔ Python Pydantic models; Kimi/Claude output schemas |
| **E2E** | Playwright | full pipeline trigger→process→deliver across channels; web flows |
| **Golden** | recorded fixtures | LLM output schema + **RAG faithfulness** (cite‑or‑abstain) |
| **Chaos** | chaostoolkit + custom | node kill, latency, API blackhole, disk‑full, WAL corruption (M3+) |
| **DR** | scripted | backup → restore → integrity + job replay (weekly) |
| **Security** | bandit/semgrep + pen‑test | prompt‑injection resistance, secret‑exfil, ACL bypass |
| **Load** | k6/locust | queue at 10/50/100 jobs; breaking‑point |
| **a11y/perf** | axe + Lighthouse CI | WCAG AA, bundle/LCP/CLS, PWA |

**Required CI gates that can break `main`:** tier‑0 containment (packet‑verified), cross‑tenant
isolation, contract drift (TS + Python), classifier low‑confidence T0 fallback, coverage on new code, e2e happy‑path, CodeQL, dependency‑review.

**Backup is not real until restored:** weekly automated restore test with pass/fail notification.
**Idempotent replay tests:** retry a job from a checkpoint and assert no duplicate side‑effects.

---

## 20. CI/CD & release

**No Dependabot** (per your call — the mail flood). Supply‑chain hygiene via `dependency-review` +
CodeQL + OpenSSF Scorecard + scheduled `pnpm audit`/`uv` audit + a **monthly manual upgrade PR**.

### 20.1 Workflows (`.github/workflows/`)

| Workflow | Trigger | Steps |
|---|---|---|
| **ci.yml** | push `main`/`develop`, PR `main` | install (frozen lockfile) → build `shared-types` → generate `@mimir/contracts` (TS + Pydantic) → lint (Biome/ESLint, ruff) → typecheck (tsc, mypy --strict) → unit → integration (testcontainers) → build → coverage→Codecov |
| **web.yml** | PR touching `apps/web` | typecheck → vitest → build (dummy env) → **Playwright e2e** → axe a11y → Lighthouse budget |
| **codeql.yml** | PR + weekly | CodeQL JS/TS + Python |
| **dependency-review.yml** | PR | block vulnerable/GPL/AGPL deps |
| **security.yml** | PR + nightly | semgrep/bandit, secret scan, Scorecard |
| **e2e.yml** | nightly + on web changes | full pipeline e2e |
| **release.yml** | tag / changesets | semantic‑release/changesets → versions, changelog, publish |
| **auto-label.yml** | PR | labeler by path |

### 20.2 Branch protection (ruleset on `main`)

- PR required + **1 approval**; required checks: `ci`, `codeql`, `dependency-review`, `web` (if web
  touched), `e2e` (happy‑path); **strict** (branch up‑to‑date); **linear history**; **signed
  commits**; no force‑push.
- After "Update branch" with a non‑triggering merge commit → push an empty commit to re‑fire CI.

### 20.3 Deploy & rollback

- **Blue/green via symlink** (`current → releases/<sha>`); smoke test the inactive path → atomic
  flip → 5‑min health watch → **auto‑rollback** on failure. Keep last 10 releases.
- **AWS worker** = immutable AMI per deploy (Packer); new instance → smoke → ACL → terminate old
  (after ship‑and‑wipe).
- **Schema migrations** run pre‑start (§6.3), N+1 compatible, with rollback scripts.
- **Feature flags** in `state.db` for canary/kill‑switch (e.g. new classification router at 0% in
  prod, 100% in staging, T2‑only first).

### 20.4 Environments

| Env | DB | APIs | Tailscale | Cost cap |
|---|---|---|---|---|
| **dev** | ephemeral SQLite | mocked LLMs, local Ollama | off | $0 |
| **staging** | separate DB | real, capped | laptop‑only | $5/day |
| **prod** | Postgres primary + LibSQL embedded replicas | real | full mesh | $20/day |

---

## 21. Engineering process (the rails — modeled on the best OSS)

References we copy: **google/eng‑practices** (small CLs/review), **Stripe + Google AIP** (APIs),
**FastAPI/Pydantic** (typed+tested), **Supabase/Astro/rust‑lang/rfcs** (contributor docs/RFCs),
**Temporal/Prefect** (durable orchestration), **Nygard ADRs**.

### 21.1 The golden contribution loop (no exceptions)

1. **Descriptive issue first** — template enforces *Problem → Proposed solution → Acceptance criteria
   → Test plan → Out of scope*. No code without an issue.
2. Branch `feat|fix|chore|docs|test/<slug>` off `main`.
3. **Small PR** (≤ ~400 LoC diff), one logical change, `Closes #NN`, green CI, **1 review +
   CodeRabbit**, **squash‑merge**.
4. Conventional Commits; **CHANGELOG** entry per PR; update the relevant ROADMAP section + features
   table (§23) when scope changes; update `AGENTS.md` if conventions change (PR‑checklist item).
5. Big features = a **`decision` (ADR) issue** + an **RFC** in `docs/rfcs/` + a *stack* of small PRs
   — never one mega‑PR.

### 21.2 Issue templates (`.github/ISSUE_TEMPLATE/`)

- **`task.yml`** (the descriptive problem→solution template) · **`bug_report.yml`** ·
  **`feature_request.yml`** · **`decision.md`** (ADR: Context / Options / Recommendation / Risks).

### 21.3 PR template checklist

`[ ] issue linked` · `[ ] tests added/updated` · `[ ] typecheck + lint pass` · `[ ] docs/AGENTS
updated` · `[ ] tenancy/tier impact noted` · `[ ] breaking‑change note` · `[ ] UI screenshot (web)`
· `[ ] follows single‑source‑of‑truth for shared schemas`.

### 21.4 Repo governance for 10+ contributors

- **`CODEOWNERS`** assigns area maintainers (web / api / workers / infra / docs); reviews route
  automatically. **`labeler.yml`** auto‑labels by path. `good first issue` + `help wanted` for
  onboarding. **RFC process** (`docs/rfcs/`) for anything cross‑cutting.
- **Nested `AGENTS.md`** per layer (`apps/web`, `apps/api`, `services`, `infra`) + root `AGENTS.md`
  canonical; `CLAUDE.md = @AGENTS.md`. A contributor's first day: read AGENTS.md → pick a `good
  first issue` → ship a small PR through green CI.
- **`.coderabbit.yaml`** for AI review alongside human review. **Husky + lint‑staged** pre‑commit.

### 21.5 Definition of Done (per issue)

Code + tests (unit/integration/contract as applicable) + docs + CHANGELOG + green CI + 1 review +
no new lint/type errors + tenancy/tier impact addressed + (web) screenshot + (API) OpenAPI updated.

---

## 22. Milestone plan (issue‑level)

Each milestone is an **epic** decomposed into small issues → small PRs. Every issue lists
**Acceptance** (binary) + **Test** (how it's proven). Targets relative to **2026‑06** kickoff.
IDs map to the features table (§23).

### M0 — Repo & rails (2026‑06) · *exit: trivial PR flows issue→CI→squash with zero manual steps*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M0‑1 | Init monorepo (pnpm + uv workspaces) | `apps/{web,api}`, `packages/{shared-types,contracts,eslint-config}`, `services/`, `infra/`, `tests/`, `docs/` exist; `pnpm i` + `uv sync` succeed | CI install job green |
| M0‑2 | Root docs: `AGENTS.md` + `CLAUDE.md(@AGENTS.md)` | layout tables, branch policy, golden loop, build/test/lint documented | review |
| M0‑3 | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md` | present, accurate, link‑checked | markdown‑lint + review |
| M0‑4 | `.github/ISSUE_TEMPLATE/` (task, bug, feature, decision) + PR template | new issue/PR uses templates | manual: open a test issue/PR |
| M0‑5 | `CODEOWNERS` + `labeler.yml` + `.coderabbit.yaml` | reviews route; PRs auto‑label; CodeRabbit comments | open a test PR |
| M0‑6 | `ci.yml` (lint+typecheck+test+build, coverage→Codecov) | green on empty scaffolds; coverage gate wired | CI run |
| M0‑7 | `codeql.yml` + `dependency-review.yml` + `security.yml` (no Dependabot) | run on PR; block vulnerable deps | CI run + a known‑bad dep PR rejected |
| M0‑8 | Husky + lint‑staged + commitlint (Conventional Commits) | pre‑commit formats/lints; bad commit msg rejected | local hook test |
| M0‑9 | Branch protection ruleset on `main` | PR+1 approval+checks strict; linear; signed | attempt direct push → blocked |
| M0‑10 | `docs/adr/0001-stack.md` + ADR template + `docs/rfcs/README.md` | ADR 0001 records stack/monorepo/tenancy/event‑bus | review |
| M0‑11 | `Makefile` + `.env.example` + docker‑compose (Postgres/Redis/Temporal) | `make dev` boots local deps | `docker compose up` smoke |
| M0‑12 | Nested `AGENTS.md` stubs per app/layer | each layer has its own guide | review |
| M0‑13 | One‑command installer / managed bootstrap | a new user runs a single script (or `make dev`) and has a working brain after editing ≤1 secrets file; activation <10 min | end‑to‑end install test on clean VM |

### M1 — Brain core (2026‑07) · *exit: authed multi‑tenant CRUD; isolation tests green; LibSQL state*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M1‑1 | Fastify app skeleton + `/v1` + error envelope + `/livez|readyz|healthz` + distributed rate limits | server boots; deep health returns component status; rate limits are Redis‑backed and survive API worker restarts | integration: health checks; load test across 2+ API workers |
| M1‑2 | `@mimir/shared-types` (Zod) + `@mimir/contracts` (OpenAPI→client + Pydantic server models) gen | shared schemas single‑source; TS client and Python Pydantic models generated from the same OpenAPI spec; CI fails on either drift | contract test: drift fails build; Python import drift fails build |
| M1‑3 | Clerk auth + JWT middleware | unauth → 401; auth resolves user+tenant | unit + integration |
| M1‑4 | **Tenant model + Postgres RLS** (F‑003) | RLS filters by JWT tenant before first query; worker/cron DB calls go through a tenant‑context wrapper enforced by the repository/DB‑client layer | **property test: tenant‑A cannot read tenant‑B** (required gate); compile‑time check: no worker DB call without tenant context |
| M1‑5 | RBAC scopes + middleware (F‑004 scaffold) | scope‑gated routes; role within tenant | unit: each scope allow/deny |
| M1‑6 | Drizzle schema + migrations + schema‑hash validation | core tables (§6.2); boot refuses on hash mismatch | migration up/down test |
| M1‑7 | **LibSQL embedded replica** state store (F‑005) | primary writes; replica reads; reconnect catches up | integration: write→replica consistency |
| M1‑8 | Config + **secrets via vault** (no plaintext) | secrets fetched by `secret_ref`; `.env` has no secrets | unit + secret‑scan CI |
| M1‑9 | Sessions + messages CRUD (cursor‑paginated) + idempotency table | create/list/continue session; pagination stable; idempotency keys stored with body‑hash + TTL + response ref | integration + contract; idempotency replay test |
| M1‑10 | Structured logging (tier‑redacted) + request IDs | T0 content not in clear logs | unit: redactor; log inspection |
| M1‑11 | Web: Clerk login + app shell + global HALT + cost chip + offline banner | login works; shell renders; HALT present | Playwright smoke |

### M2 — Orchestration (2026‑08–09) · *exit: a task runs build→review→apply, idempotent, recorded; Temporal live*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M2‑1 | Temporal wired (worker + client) (F‑006) | workflow executes; survives worker restart | integration: kill worker mid‑run → resumes |
| M2‑2 | Durable job queue (kanban‑as‑queue) (F‑007) | jobs persisted; status transitions; survive reboot | integration: reboot → resume |
| M2‑3 | **Classification gateway** + policy stub (F‑008) ✅ | request tagged T0/T1/T2 with confidence score; low‑confidence → conservative T0 fallback; every decision logged as an audit event; route chosen; decision logged | unit: classify cases; **T0 never routes to cloud**; property test: low‑confidence input never leaves T0/T1 |
| M2‑4 | Identifier scrubber (pre‑T2 dispatch) | hostnames/secrets/proprietary names stripped | unit: scrub fixtures |
| M2‑5 | **Model routing layer** (workhorse · reviewer · local) | Mimir implements its own provider adapters + classified failover; tier‑aware model selection runs inside the engine (§5.1) | integration: tier→provider routing; primary down → Mimir fallback |
| M2‑6 | **Review loop** (AST‑diff + JSON‑patch, max‑3 + cycle detect) (F‑009) | reviewer output defined as a Zod/Pydantic schema in `@mimir/shared‑types`; invalid reviewer output is rejected/retried/escalated; diff→review→apply; stops at 3 or on cycle; escalates | unit: cycle fixture; golden: patch schema; contract test: invalid reviewer output handled |
| M2‑7 | **Subagent delegation** via Mimir `delegate_task` under Temporal | Mimir's own delegation/Kanban semantics; Temporal owns durable/fenced/cost‑bounded cross‑node orchestration (§5.1) | integration: delegate → result to memory; crash mid‑delegation → resumes |
| M2‑8 | Idempotency keys on writes + replay (F‑010 part) | retry skips completed phases; no double side‑effect | **idempotent replay test** |
| M2‑9 | Web: Console (stream + badges + 📎sources) + Tasks/Kanban (F‑022 part) | chat streams w/ model/tier/trust badges; kanban shows states | Playwright e2e |
| M2‑10 | Circuit breakers per provider (F‑010 part) | open after N fails; fast‑fail + fallback | unit: breaker states |
| M2‑11 | **Internal engine protocol** (ADR‑0017 rejected) | Mimir activity calls Mimir engine over internal RPC; session fork/list/load works; tool‑progress relayed | integration: drive a Mimir task end‑to‑end |
| M2‑12 | **State source‑of‑truth** inside Mimir store (ADR‑0018 rejected) | Mimir store authoritative; engine sessions/provenance persisted idempotently; T0 tier‑redacted | integration: run → sync → re‑pull is a no‑op (idempotent) |
| M2‑13 | **Tier‑enforcement point** at Mimir model calls (ADR‑0019 rejected) | every Mimir model call passes the classification gateway + scrubber; **T0 never reaches a cloud provider** | property: T0 input → no cloud egress (packet‑verified) |
| M2‑14 | **Audit feed** from Mimir engine hooks → hash‑chain | Mimir tool/model events recorded as Mimir audit events | integration: action in engine appears in the verifiable chain |

### M3 — Resilience (2026‑09–10) · *exit: chaos suite green (kill node → fail‑soft); fencing proven*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M3‑1 | Heartbeat + `health.json` + deep health | 60s probes; status map; sub‑second TCP keepalive | integration: node down → detected |
| M3‑2 | **Fencing epoch** + DB `CHECK(epoch>=min_epoch)` + external lock (F‑011) | only current epoch writes; stale rejected at DB + API | unit + integration: stale write rejected |
| M3‑3 | Failover workflow (freshest replica → promote) | leader down → replica promotes; old leader demotes on revive | integration: kill primary → desktop promotes, 0 loss |
| M3‑4 | Read‑only during transition + monotonic clocks | no writes mid‑transition; clock‑skew guard | unit: skew fixture |
| M3‑5 | WoL‑aware dispatcher + connection‑pool isolation | wake→verify→dispatch; control plane isolated from retries | integration: sleep desktop → no retry storm |
| M3‑6 | Backpressure / admission control | reject/queue beyond N; load‑shed reduces RAG/output | load test |
| M3‑7 | Graceful shutdown (SIGTERM drain) | in‑flight jobs checkpointed on stop | integration: SIGTERM mid‑job |
| M3‑8 | state.db lifecycle (retention, VACUUM, write‑fail‑fatal) (R‑07) | WAL bounded; write failure → self‑terminate | unit + disk‑full chaos |
| M3‑9 | **Backups/DR 3‑2‑1** + weekly restore test (F‑030, R‑10) | encrypted offsite snapshot; restore verified | weekly restore CI |
| M3‑10 | Chaos suite (kill/latency/blackhole/disk/WAL‑corrupt) | safety invariants hold; violation → rollback+alert | chaos run green |
| M3‑11 | Web: Status/Topology visual + node drawer | node map color‑coded; offline shown gracefully | Playwright |

### M4 — Memory (2026‑11) · *exit: multi‑hop graph recall + time‑machine restore tests*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M4‑1 | RAG ingest pipeline (doc/code/web) + tier tag (F‑015) | items chunked, embedded **locally for T0/T1**, indexed | integration: ingest→retrieve |
| M4‑2 | Hybrid retrieval (BM25 + vector) + rerank + threshold | top‑k tier‑filtered; low‑score discarded | unit: retrieval fixtures |
| M4‑3 | **Cite‑or‑abstain grounding** + citation enforcement | grounded answer cites ≥1 source or abstains | **golden faithfulness test** |
| M4‑4 | Screenshots‑as‑references (capture→OCR→tag→search) (F‑015) | snap→searchable; tmpfs cache | integration |
| M4‑5 | **Graph memory** schema + semantic/episodic/procedural (F‑016) | nodes/edges; valid_from/to; contradiction flagged | unit: contradiction fixture |
| M4‑6 | Multi‑hop query API (`/v1/memory/query`) | traverses + combines vector sim | integration: multi‑hop fixture |
| M4‑7 | **Time‑machine** branch/rewind/diff/restore (gated, idempotent) | restore reconstructs; re‑apply is no‑op | integration: restore + idempotency |
| M4‑8 | Web: Knowledge screen + Memory (graph viewer + time‑machine) (F‑023 part) | ingest UI; graph renders; rewind works | Playwright |

### M5 — Governance & audit (2026‑11) · *exit: tamper test fails verification; replay reconstructs state*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M5‑1 | Policy‑as‑code engine (OPA/Rego) for routing + approvals (F‑017) | policies evaluated before LLM call/action; versioned | unit: policy fixtures |
| M5‑2 | **Hash‑chain + Merkle audit log** | every event linked; subset‑verifiable | **tamper test: altered event fails verify** |
| M5‑3 | Temporal replay ("state at time T") | reconstructs known/model/sources at T | integration: replay fixture |
| M5‑4 | **GDPR crypto‑delete** (encrypt‑then‑destroy‑key + proof) | subject data irrecoverable; chain intact; proof emitted | integration: delete + verify |
| M5‑5 | Tier‑redacted audit (T0 metadata‑only) | no T0 content in clear | unit: redactor |
| M5‑6 | Approval gates (tiered timeout, blast‑radius, PIN) (F‑026 part) | risky action pauses; timeout=queue; PIN for destructive | integration + Playwright |
| M5‑7 | Web: Governance/Audit screen (policy editor + audit viewer + replay) (F‑024 part) | edit policy; verify chain; replay | Playwright |

### M6 — Connectors (2026‑12–2027‑01) · *exit: each connector has integration + contract tests*

> **[BUILD — §5.1]** Mimir implements its own connector gateway. The surface breadth
> (GitHub/Telegram/Discord/Slack/Mail/…) is **inspired by** Hermes' gateway design, but each
> connector is Mimir's own code so tier labels, no‑tier‑widening, audit events, and the
> OAuth/`secret_ref` vault contract can be enforced natively. Rows below are full
> implementations, not wrappers.

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M6‑0 | **Connector gateway foundation** + tier/audit middleware + OAuth/secret_ref contract | every Mimir connector declares a default tier, cannot widen a request's tier, and emits audit events; tokens in vault | unit: interface conformance; property: connector cannot widen tier |
| M6‑1 | **GitHub** (F‑018) | repos/issues/PRs/Actions; open PR; code read for RAG | integration (mock) + contract |
| M6‑2 | **Telegram** (F‑021) | chat list, send/recv, voice, approvals, **embedded UI**; HMAC‑signed | integration + e2e |
| M6‑3 | **Mail — Gmail** (F‑019) | triage, draft‑for‑approval, send (gated); minimal scopes | integration (mock) |
| M6‑4 | **Discord** (F‑021) | channels, send/recv, slash, embedded UI | integration |
| M6‑5 | **Slack** (F‑021) | channels/threads, send/recv, embedded UI | integration |
| M6‑6 | **Airtable** (F‑020) | bases/tables read/write; features‑table sink | integration (mock) |
| M6‑7 | **Contacts** (F‑020) | read contacts (T0, read‑only default) | integration (mock) |
| M6‑8 | **Docs** (F‑020) | read for RAG; generate .docx/.pptx via worker | integration |
| M6‑9 | **Screenshots‑refs** wiring to Knowledge | end‑to‑end snap→answer | e2e |
| M6‑10 | **Mail — MS Graph** (F‑019) | inbox+calendar; change‑notification webhook | integration (mock) |
| M6‑11 | Web: Connectors hub + embedded chat surfaces (F‑023 part) | cards w/ status/scopes/tier/test; chat embeds | Playwright |

### M7 — Web app / PWA (2026‑12–2027‑01) · *exit: e2e flows green; PWA installable; a11y+perf pass*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M7‑1 | Design tokens + themes (light/dark, tier/trust colors) + shadcn setup | tokens single‑source; both themes | visual regression |
| M7‑2 | Component library in **Storybook** + visual regression | core components documented | Chromatic/Playwright snapshots |
| M7‑3 | Reports screen (FTS + semantic search, filters, preview) (F‑023) | search returns ranked; filters work | Playwright |
| M7‑4 | Cost/Budget screen (live burn, budgets, pre‑flight estimate) (F‑024) | spend shown; budget set; estimate before run | Playwright |
| M7‑5 | Settings (nodes, secrets, notif tiers, routing, tiers, account/SSO scaffold) | all sections functional | Playwright |
| M7‑6 | Routines screen (kid‑wizard + expert policy) (F‑025 part) | create via wizard or policy; run history | Playwright |
| M7‑7 | PWA (offline shell, install, push‑ready) | installable; offline serves cached history | Lighthouse PWA audit |
| M7‑8 | a11y pass (axe, WCAG AA, keyboard nav) | no critical a11y violations | axe CI |
| M7‑9 | Performance budgets (Lighthouse CI: bundle/LCP/CLS) | within budget | Lighthouse CI |
| M7‑10 | Mobile views (glanceable status, swipe approvals, voice, HALT) | usable on phone | Playwright mobile viewport |

### M8 — Delivery & UX safety (2027‑01) · *exit: notification tiers/dedup + emergency halt e2e green*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M8‑1 | 4‑channel delivery (toast/chat/web/email) (F‑025) | report fans out; never lost | integration |
| M8‑2 | Notification tiers + **dedup token** + quiet hours | dismiss once = dismissed everywhere; P0 breakthrough | unit + e2e |
| M8‑3 | **Emergency HALT** + auto circuit‑breaker (F‑026) | one tap halts all; auto‑halt on runaway cost/spawn | e2e + chaos |
| M8‑4 | Email digest (MS Graph/SMTP) | daily roll‑up of reports/automations | integration |
| M8‑5 | Voice second‑brain (STT in / TTS out) (F‑031) | voice note → action → spoken reply | integration |

### M9 — Observability & cost governance (2027‑02) · *exit: dashboards + budget‑halt test*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M9‑1 | Metrics (RED/USE) + per‑request cost attribution (F‑027) | metrics exported; cost tagged model/node/tier | unit + integration |
| M9‑2 | Budgets + auto‑throttle (70/90/100) + anomaly auto‑halt (F‑027) | throttle at thresholds; anomaly → emergency mode | integration: simulate spike |
| M9‑3 | Tier‑redacted logs + (optional) traces (F‑028) | no T0 leakage in telemetry | **tier‑0 telemetry leak test** |
| M9‑4 | Capacity report (state.db growth, token burn, disk forecast) | weekly report delivered | scheduled job test |
| M9‑5 | Deep health + dead‑man's switch (external uptime ping) | mesh‑down alerts even if laptop offline | integration |

### M10 — Hardening & dogfood → prod (2027‑02–03) · *exit: 30‑day MTBF ≥720h, 0 critical; SOC2‑readiness*

| # | Issue | Acceptance | Test |
|---|---|---|---|
| M10‑1 | Close **all 🔴/🟠 defects** (R‑01..R‑06) — Gate **G1** | 0 critical/high open | security re‑review |
| M10‑2 | gVisor sandbox + static‑analysis gate live (F‑012, R‑01) | generated code runs sandboxed; injection contained | pen‑test: injection → no host access |
| M10‑3 | Tailscale ACLs + air‑gapped cloud (F‑013, R‑06) | default‑deny; cloud can't reach T0/T1 | network policy test |
| M10‑4 | Ephemeral SSH CA + FDE/SQLCipher (F‑014, R‑05) | no static keys; at‑rest encrypted | audit |
| M10‑5 | Ship‑and‑wipe hardening (tmpfs/instance‑store) (R‑09) | no residue after job; crypto‑wipe | forensic test |
| M10‑6 | NixOS + sops‑nix declarative deploy (F‑033) | reproducible rebuild; secrets injected at activation | rebuild test |
| M10‑7 | **30‑day dogfood** — run Mimir on Mimir — Gate **G2** | MTBF ≥720h, 0 critical incidents | continuous monitor |
| M10‑8 | SOC2‑readiness evidence pack (G6 prep) | controls mapped; audit log evidence exported | review |

### Commercial track (parallel, gated by §25)

| When | Activity | Gate |
|---|---|---|
| 2026‑06–07 | 10 failed‑project interviews (H1/H2) + 10 ICP discovery (H3) | G3, G4 |
| 2026‑09 | Mastra‑migration guide + tracking (H4) | G7 |
| 2026‑Q4 | design‑partner LOI ≥ $50K (H5/B2) | G5 |
| 2027‑Q1 | SOC 2 auditor engaged | G6 |
| 2027‑Q2–Q3 | first 10 paying customers; GM tracking | G8 |

---

## 23. Features list (master table)

Tier: Free/Pro/Ent · Pri: P0–P3 · Status: ⬜🟦✅⛔ · Target relative to 2026‑06. Mirror to an
Airtable base when M6 lands (F‑020).

| ID | Feature | Tier | Pri | Status | Owner | Target | Milestone |
|---|---|---|---|---|---|---|---|
| F‑001 | Repo, docs, CI rails, conventions | Free | P0 | ✅ | core | 2026‑06 | M0 |
| F‑002 | API skeleton + JWT auth | Free | P0 | ✅ | api | 2026‑07 | M1 |
| F‑003 | Multi‑tenant schema + Postgres RLS + tenant guard | Pro | P0 | ✅ | api | 2026‑07 | M1 |
| F‑004 | RBAC (action‑granular) + JIT scaffold | Pro | P1 | ✅ | api | 2026‑08 | M1 |
| F‑005 | LibSQL embedded‑replica state store | Free | P0 | 🟦 | api | 2026‑08 | M1 |
| F‑006 | Event bus + Temporal workflows | Free | P0 | 🟦 | api | 2026‑08 | M2 |
| F‑007 | Durable job queue (kanban‑as‑queue) | Free | P0 | 🟦 | api | 2026‑08 | M2 |
| F‑008 | Data‑classification gateway (tier routing) | Free | P0 | ✅ | api | 2026‑09 | M2 |
| F‑009 | Workhorse→reviewer loop (AST‑diff + JSON‑patch) | Free | P0 | ✅ | api | 2026‑09 | M2 |
| F‑010 | Resilience: circuit breakers + idempotent replay | Free | P0 | ✅ | api | 2026‑09 | M2/M3 |
| F‑011 | Leader/fencing + read‑only transitions | Free | P1 | ⬜ | api | 2026‑10 | M3 |
| F‑012 | gVisor sandbox + static‑analysis gate | Free | P0 | ⬜ | infra | 2026‑10/M10 | M3/M10 |
| F‑013 | Tailscale ACLs + air‑gapped cloud worker | Free | P1 | ⬜ | infra | 2026‑10 | M3/M10 |
| F‑014 | Secrets vault + ephemeral SSH CA + FDE/SQLCipher | Pro | P0 | ⬜ | infra | 2026‑10 | M3/M10 |
| F‑015 | RAG knowledge base + screenshots‑as‑references | Free | P0 | ✅ | api | 2026‑11 | M4 |
| F‑016 | Graph‑native shared memory + time‑machine | Pro | P1 | ⬜ | api | 2026‑11 | M4 |
| F‑017 | Governance‑as‑code (OPA) + immutable audit | Pro | P0 | ✅ | api | 2026‑11 | M5 |
| F‑018 | Connector: GitHub | Free | P0 | ✅ | api | 2026‑12 | M6 |
| F‑019 | Connector: Mail (Gmail / MS Graph) | Pro | P1 | ⬜ | api | 2026‑12 | M6 |
| F‑020 | Connectors: Airtable, Contacts, Docs | Pro | P1 | ⬜ | api | 2027‑01 | M6 |
| F‑021 | Chat surfaces: Telegram, Discord, Slack | Free | P1 | ⬜ | gateway | 2027‑01 | M6 |
| F‑022 | Web: console, status topology, tasks | Free | P0 | 🟦 | web | 2026‑12 | M2/M3 |
| F‑023 | Web: approvals, reports, knowledge, memory | Pro | P1 | 🟦 | web | 2027‑01 | M4/M7 |
| F‑024 | Web: governance/audit, cost, settings | Pro | P1 | 🟦 | web | 2027‑01 | M5/M7 |
| F‑025 | 4‑channel delivery + notification tiers + dedup | Free | P1 | ⬜ | gateway | 2027‑01 | M8 |
| F‑026 | Emergency halt + auto circuit‑breaker | Free | P0 | ✅ | web/api | 2026‑12 | M5/M8 |
| F‑027 | Cost governance: budgets + auto‑throttle + forecast | Pro | P0 | ✅ | api | 2026‑06 | M5/M9 |
| F‑028 | Observability: metrics/traces/logs (tier‑redacted) | Pro | P1 | ⬜ | infra | 2027‑02 | M9 |
| F‑029 | SSO/SAML/SCIM (enterprise access) | Ent | P2 | ⬜ | api | 2027‑03 | post‑M10 |
| F‑030 | Backups/DR (3‑2‑1) + restore tests | Pro | P0 | ⬜ | infra | 2026‑10 | M3 |
| F‑031 | Voice (STT/TTS) + telephony | Free | P2 | ⬜ | gateway | 2027‑02 | M8 |
| F‑032 | Marketplace (publish/install agents) | Ent | P3 | ⬜ | web | 2027‑Q3 | post‑M10 |
| F‑033 | NixOS + sops‑nix declarative deploy | Pro | P2 | ⬜ | infra | 2027‑Q2 | M10 |
| F‑034 | ActivityWatch ambient context (opt‑in) | Free | P3 | ⬜ | api | 2027‑Q2 | post‑M10 |
| F‑035 | CLI (terminal control + scripting) | Free | P1 | ⬜ | cli | 2026‑10 | M2/M3 |
| F‑036 | Browser extension (capture + quick action) | Free | P1 | ⬜ | web | 2026‑11 | M4 |
| F‑037 | Electron desktop chat app | Free | P2 | ⬜ | web | 2026‑12 | M4/M7 |
| F‑038 | Agent hierarchy / role registry | Free | P0 | ✅ | api | 2026‑09 | M2 |
| F‑039 | No‑code tool builder | Free | P2 | ⬜ | web | 2027‑Q1 | M6 |
| F‑040 | Natural‑language policy editor | Pro | P1 | ⬜ | web | 2026‑11 | M5 |
| F‑041 | Agent reputation / trust score | Pro | P2 | ⬜ | api | 2027‑Q1 | M7 |
| F‑042 | Resource‑aware scheduling | Free | P1 | ⬜ | api | 2026‑10 | M3 |
| F‑043 | Energy/cost‑aware routing | Free | P2 | ⬜ | api | 2027‑Q1 | M8 |
| F‑044 | Self‑healing remediation | Pro | P2 | ⬜ | api | 2027‑Q1 | M8 |
| F‑045 | Compliance policy packs (SOC2/GDPR/EU AI Act/HIPAA) | Pro | P1 | ⬜ | web | 2026‑12 | M5 |
| F‑046 | Agent sandbox playground | Free | P2 | ⬜ | web | 2027‑Q1 | M6 |
| F‑047 | Cross‑device session handoff | Free | P2 | ⬜ | api | 2027‑Q2 | M7 |
| F‑048 | Workflow visual editor | Pro | P2 | ⬜ | web | 2027‑Q2 | M7 |
| F‑049 | A/B testing for prompts/policies | Pro | P3 | ⬜ | api | 2027‑Q2 | post‑M10 |
| F‑050 | Model performance leaderboard | Free | P2 | ⬜ | web | 2027‑Q1 | M8 |
| F‑051 | Federated local model improvement | Ent | P3 | ⬜ | services | 2027‑Q3 | post‑M10 |
| F‑052 | E2EE for sensitive chats | Pro | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑053 | Hardware attestation / TPM integration | Ent | P3 | ⬜ | infra | 2027‑Q3 | post‑M10 |
| F‑054 | Cross‑mesh knowledge sharing with admin approval | Pro | P1 | ✅ | api | 2026‑11 | M4 |
| F‑054 | Agent‑to‑agent negotiation | Pro | P3 | ⬜ | api | 2027‑Q3 | post‑M10 |
| F‑055 | Usage insights / time‑saved dashboard | Pro | P2 | ⬜ | web | 2027‑Q1 | M9 |
| F‑056 | Local webserver per node + mesh discovery | Free | P0 | ⬜ | api/infra | 2026‑10 | M3 |
| F‑057 | Companion mode: emotional context, long‑term personal memory, proactive check‑ins | Free | P1 | 🟦 | api | 2026‑11 | M4 |
| F‑058 | Personal finance assistant: bank/CSV ingestion, budgeting, spend anomaly detection | Free | P1 | ⬜ | api | 2026‑12 | M6 |
| F‑059 | Marketing/creator assistant: content calendar, brand‑voice drafting, campaign analytics | Pro | P1 | ⬜ | api/web | 2027‑01 | M6 |
| F‑060 | HR/people partner: 1:1 prep, feedback drafting, hiring pipeline memory | Pro | P2 | ⬜ | api | 2027‑01 | M7 |
| F‑061 | CEO/operator dashboard: burn, revenue, task health, risk rollup, decision briefings | Pro | P0 | ✅ | api/web | 2026‑12 | M5/M6 |
| F‑062 | Document bonding & record unification: cross‑connector entity resolution (customer, vendor, project) | Pro | P1 | 🟦 | api | 2026‑12 | M6 |
| F‑063 | Daily briefing & morning companion | Free | P1 | ⬜ | api/web | 2027‑Q1 | M7 |
| F‑064 | Emotional check‑in & private mood journal | Free | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑065 | Relationship memory (birthdays, preferences, conversation follow‑ups) | Free | P2 | ⬜ | api | 2027‑Q1 | M7 |
| F‑066 | Nutrition & meal planner with grocery list | Free | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑067 | Fitness & workout coach with progress tracking | Free | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑068 | Life admin tracker (home, car, insurance, renewals, warranties) | Free | P2 | ⬜ | api | 2027‑Q1 | M7 |
| F‑069 | Travel planner & itinerary assistant | Free | P2 | ⬜ | api/web | 2027‑Q2 | M8 |
| F‑070 | Adaptive tutor & learning paths | Free | P1 | ⬜ | api/web | 2027‑Q1 | M7 |
| F‑071 | Second brain / idea capture with bidirectional links | Free | P1 | ⬜ | api/web | 2026‑12 | M6 |
| F‑072 | Meeting prep & automated follow‑up drafts | Pro | P1 | ⬜ | api | 2027‑Q1 | M7 |
| F‑073 | Inbox Zero assistant (triage, draft replies, priorities) | Pro | P1 | ⬜ | api | 2027‑Q1 | M7 |
| F‑074 | Conversational memory search across all chats | Free | P1 | ✅ | api | 2026‑11 | M4 |
| F‑075 | Proactive contextual suggestions (opt‑in) | Free | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑076 | Voice‑first hands‑free companion mode | Free | P2 | ⬜ | gateway | 2027‑Q2 | M8 |
| F‑077 | Life documentation & legacy memory (stories, recipes, memoirs) | Free | P2 | ⬜ | api/web | 2027‑Q3 | post‑M10 |
| F‑078 | Accessibility assistant (read aloud, describe images, simplify text) | Free | P1 | ⬜ | web | 2027‑Q1 | M7 |
| F‑079 | Values & decision journal with outcome tracking | Pro | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑080 | Screen‑time & digital wellbeing coach | Free | P2 | ⬜ | web | 2027‑Q2 | M8 |
| F‑081 | Difficult conversation coach (role‑play, drafts, de‑escalation) | Free | P2 | ⬜ | api | 2027‑Q2 | M8 |
| F‑082 | Family mesh / household coordination | Free | P2 | ⬜ | api | 2027‑Q3 | post‑M10 |

---

## 24. Risk register

Severity 🔴 critical · 🟠 high · 🟡 medium · ⚪ low. **All 🔴/🟠 must close (Gate G1) before any
reliability/governance claim** [validation C1].

| ID | Risk / defect | Sev | Status | Mitigation | Owner | Gate |
|---|---|---|---|---|---|---|
| R‑01 | Prompt‑injection → RCE via auto‑executed generated code | 🔴 | open | gVisor + static analysis + human approval gate; no auto‑exec from chat | infra | G1 |
| R‑02 | Kimi (PRC) data exposure — workhorse touches all data | 🔴 | mitigating | classification gateway: sensitive → Claude/local; scrub IDs for cloud; LiteLLM proxy logs routing | api | G1 |
| R‑03 | Split‑brain (phone‑witness sole tiebreaker) | 🟠 | open | external lock (etcd/conditional‑write) + API‑side fencing + read‑only‑during‑transition | api | G1 |
| R‑04 | Single‑writer SPOF during failover | 🟠 | mitigating | LibSQL embedded replicas + fencing‑epoch auto‑promote (zero‑loss) | api | G1 |
| R‑05 | Plaintext state.db/secrets → theft = total loss | 🟠 | open | LUKS FDE + SQLCipher + vault + ephemeral SSH CA | infra | G1 |
| R‑06 | Flat tailnet → lateral movement | 🟠 | open | Tailscale tag ACLs + air‑gap cloud | infra | G1 |
| R‑07 | Unbounded state.db growth → disk‑full zombie | 🟡 | open | retention + VACUUM + write‑failure‑is‑fatal | api | M3 |
| R‑08 | Review‑loop deadlock / infinite cost | 🟡 | mitigating | max‑3 + cycle detect + token budget | api | M2 |
| R‑09 | Ship‑and‑wipe leakage (EBS/swap residue) | 🟡 | open | instance‑store/tmpfs + crypto‑wipe + power‑off | infra | M3/M10 |
| R‑10 | No DR for total loss (single house) | 🟡 | open | 3‑2‑1 encrypted offsite + weekly restore test | infra | M3 |
| R‑11 | Clock skew → premature failover | 🟡 | open | monotonic clocks + skew detection | api | M3 |
| R‑12 | WAL corruption replicated as "correct" | 🟡 | open | content‑hash + app‑validation + integrity_check + reconcile | api | M3 |
| R‑13 | Cost runaway (loop) | 🟠 | mitigating | per‑task/agent/tenant ceilings + anomaly auto‑halt | api | M9 |
| R‑14 | Tier‑0 leakage via telemetry/logs | 🟠 | open | tier‑aware redaction; tier‑0 telemetry‑leak CI test | infra | M9 |
| R‑15 | Classifier misclassification / low‑confidence → T0 leakage | 🔴 | open | confidence threshold + conservative T0 fallback + per‑decision audit event + classifier‑vs‑policy conformance test | api | G1 |
| R‑16 | Worker/cron RLS bypass → cross‑tenant access | 🔴 | open | mandatory tenant‑context wrapper enforced through repository/DB‑client layer + property test of worker paths | api | M1 |
| R‑17 | GDPR crypto‑delete incomplete for embeddings | 🟠 | open | per‑subject embedding linkage + derived‑vector deletion; disclose residual nearest‑neighbor semantic risk | api | M5 |
| R‑19 | No brain DR playbook (RTO ≤ 4h replacement, RPO ≤ 1h T0) | 🟡 | open | documented replace‑stolen‑laptop ceremony + key‑recovery/sharding flow; see also R‑10 / I.11 | infra | M3 |
| R‑20 | TS↔Python contract drift (no OpenAPI→Pydantic server models) | 🟡 | open | generate Pydantic from same OpenAPI spec + CI gate fails on drift | api/infra | M1/M2 |
| R‑21 | LAN‑local fallback absent (phone↔brain dies if DERP path down) | 🟡 | open | mDNS/LAN discovery for phone↔brain when Tailscale relay unavailable; P2 feature | api | post‑M3 |
| R‑22 | Engine self‑ownership → slower parity vs proven runtimes like Hermes | 🟡 | accepted | Mimir owns the engine (§5.1); Hermes is a design reference, not a dependency. Mitigate by keeping Hermes' connector/tool/skill patterns as a reference spec and benchmarking against it. | api | M2 |
| **Business risks** | | | | | | |
| R‑B1 | EU AI Act not a budget trigger (slipped to Dec 2027) | 🟠 | known | lead with velocity+cost; AI Act as qualifier only | GTM | §25 |
| R‑B2 | Hybrid = two half‑products | 🟠 | known | pick enterprise ICP; personal = OSS proof | GTM | §25 |
| R‑B3 | Distribution scorched earth (LangChain/Mastra/Dify) | 🟠 | known | one‑competitor wedge: Mastra prod‑wall users | GTM | G7 |
| R‑B4 | Unit economics tight (GM 44–45% at 10 cust) | 🟠 | known | $99/user + $500 min; hybrid base+usage; dogfood >70% GM bet | GTM | G8 |
| R‑B5 | Solo builder can't clear enterprise bar in time | 🟠 | known | design‑partner funds hardening (G5); seed 18mo runway | GTM | G5 |
| R‑B6 | Buyers don't re‑buy after a failed agent project (H2) | 🟠 | unvalidated | 10 failed‑team interviews before more commercial code | GTM | G3 |
| R‑B7 | Onboarding complexity defeats "kid‑simple" → funnel collapse | 🟠 | known | one‑command installer / managed bootstrap; measure activation <10 min | GTM | §25 |
| R‑B8 | G1 hardening has high dependency‑concurrency risk | 🟠 | known | re‑baseline G1 scope/dates; publish critical‑path/dependency graph in §25.5 | GTM/infra | G1 |

---

## 25. Commercialization, GTM & the go/no‑go gate

Source of truth: `hermesh_validation.agent.final.md` + the user's falsifiable bets. **The thesis
lives or dies by the gates — not by conviction.**

### 25.1 Positioning & wedge

- **Mission one‑liner:** *"The AI that is always with you — one mind, many hats, always yours."*
- **Go‑to‑market one‑liner:** *"Instantly deterministic, production‑safe agent execution — local‑first, with
  bounded cost and a cryptographic audit trail."*
- **Wedge (distribution):** target **Mastra/LangChain users hitting production walls** (reliability,
  cost surprises). Content: *"I built my agent in Mastra — now I'm terrified to deploy it."* Meet
  developers at the moment POC success turns into production anxiety. [validation B3]
- **ICP sequencing:** **developer/CTO first** (OSS, SDK, DX); enterprise/CISO **second** once we
  have proof + SOC 2. Personal mesh = OSS proof‑of‑capability + recruiting, **not** the revenue
  funnel. [validation A3, B1]
- **What we lead with:** developer velocity + **cost control**; EU AI Act is a *qualifier* for
  already‑interested buyers, **not** a lead‑gen hook (it slipped to Dec 2027). [validation A2]

### 25.2 Falsifiable bets (validate with 5–10 design partners BEFORE more commercial code)

| Bet | Claim | Brutal counter | Test | Kill |
|---|---|---|---|---|
| **B1** | Reliability/governance > model capability moves projects 88%→12% | only 3 of 5 failure modes addressed; vitamin not painkiller | interview 10 failed teams, rank causes | <6/10 rank infra top‑2 (H1) |
| **B2** | Wedge is the CTO (velocity+cost), not just CISO | enterprise bar (SOC2/legal) we lack | A/B landing: velocity vs compliance | compliance >3× velocity = misread |
| **B3** | Hybrid is a bridge, not a compromise | Docker Desktop didn't sell Docker Enterprise | cohort 50 personal users → enterprise signal | <10% convert (H5) |
| **B4** | Dogfooding proves >70% GM at scale | AI GM 50–60%; cost is COGS | run Mimir on Mimir; measure GM | <40% GM at 10 cust (G8) |

### 25.3 Design‑partner interview script (ask exactly)

1. "Walk me through your last agent project — what happened?" → *real* vs assumed failure mode.
2. "What did that failure cost in eng time/opportunity?" → quantifiable pain ($50K+).
3. "What would you have paid to prevent that specific failure?" → WTP, $500+/mo.
4. "What would your CISO need to approve a platform?" → enterprise bar for this buyer.
5. "Tried LangChain/Mastra/CrewAI/Dify — what blocked you?" → competitive insight.
6. "What would a 30‑day pilot 'success' look like?" → clear eval criteria vs tire‑kicker.
7. "Who else approves this purchase?" → buying committee.

### 25.4 Go/No‑Go gates (binary)

| Gate | Criteria | Deadline | On fail |
|---|---|---|---|
| **G1** | 0 critical/high security defects | Month 4 (~2026‑10) | **STOP** all commercial activity |
| **G2** | 30‑day dogfood MTBF ≥720h, 0 critical | Month 5 | reset clock, fix, restart |
| **G3** | H1: ≥6/10 failed teams rank infra top‑2 | Month 2 | pivot problem statement |
| **G4** | H3: ≥4/10 ICP have allocated governance budget | Month 2 | drop governance lead; lead velocity/cost |
| **G5** | ≥1 design‑partner LOI ($50K+) | Month 6 | extend runway / cut burn; no new features |
| **G6** | SOC 2 Type II initiated | Month 8 | stay developer segment |
| **G7** | >100 Mastra‑migration attempts in 30 days | Month 6 | wedge dull → differentiate on governance |
| **G8** | GM >40% at 10 paying customers | Month 12 | fix pricing (hybrid base+usage) |
| **G9** | Runway >6 months at all times | ongoing | emergency raise or honest shutdown |

### 25.5 Harden‑before‑sell sequencing (no phase before its gate)

`P0 Harden (mo 1–4, G1)` → `P1 Dogfood (mo 4–5, G2)` → `P2 Validate (mo 1–2 parallel, G3/G4)` →
`P3 Prove (mo 5–6, G5)` → `P4 Sell (mo 6–9, G6)` → `P5 Scale (mo 9–12, G8)`. **Selling before
G1/G2 is self‑sabotage** — the buyer's security team finds the same defects we found.

> **G1 dependency‑concurrency note (R‑B8).** Gate G1 bundles gVisor, FDE/SQLCipher, ephemeral SSH CA, and air‑gapped cloud hardening. These are independent technically but compete for the same small‑team infra/security bandwidth in month 4. Treat G1 as a critical path: any slippage on one item blocks all reliability/governance claims. Re‑baseline dates if the critical path slips.

### 25.6 Pricing (RAG‑grounded [sec03/05, wide04])

| Tier | Price | What | Rationale |
|---|---|---|---|
| **Free / OSS** | $0 (Apache‑2.0 core) | full mesh, privacy tiers, queue, basic connectors | developer mindshare funnel |
| **Pro** | **$99/user/mo, $500/mo min, 10‑seat min** | multi‑tenancy, SSO, audit, cost governance, 99.9% SLA, priority support | $5K/customer at close funds next customer; don't compete on price with OSS |
| **Enterprise** | $500–2,000/user/mo | white‑label, residency, TEE, 100+ connectors, marketplace, governance‑as‑code, custom SLA | undercuts Salesforce Agentforce; deployment flexibility |
| **Usage overage** | $0.001–0.01 / 1K tokens | beyond quota | hybrid model (49%→61% of vendors); +38% NRR |

**Margin discipline:** hybrid (base + pass‑through usage) protects the 50–60% AI gross margin;
target >40% GM at 10 customers (G8), >70% via local‑model + cost routing (B4). Unit math at 10
customers loses ~$25–28K/mo (normal seed) → needs 18–24mo runway. [validation C2]

### 25.7 Competitive matrix (cited [wide01/03, sec02])

| | LangChain (~110K★) | CrewAI (~48–52K★) | Mastra (~22K★) | Dify (~100K★) | **Mimir** |
|---|---|---|---|---|---|
| Privacy‑tiered routing | ❌ | ❌ | ❌ | ❌ | ✅ core |
| Personal device mesh | ❌ | ❌ | ❌ | ❌ | ✅ |
| Durable orchestration | partial | ❌ | partial | partial | ✅ Temporal |
| Cost governance | monitor | ❌ | ❌ | basic | ✅ first‑class |
| Immutable audit (chain+replay) | logs | basic | basic | logs | ✅ |
| RAG cite‑or‑abstain default | opt‑in | opt‑in | opt‑in | opt‑in | ✅ default |
| Multi‑tenancy/SSO | Ent | Ent | Ent license | Ent (license blocks SaaS) | ✅ architected |
| Human‑centric companion model | ❌ | ❌ | ❌ | ❌ | ✅ core |
| OSS license | MIT | MIT | Apache | **modified Apache (anti‑SaaS)** | Apache‑2.0 (clean) |

### 25.8 Revenue model (illustrative, [sec05])

Year‑1 target ~$300–350K ARR (≈50 Pro + 10 Ent); Year‑3 $5–10M via seat expansion + Pro→Ent +
usage + marketplace commission (15–30%) + managed hosting + services. **All figures are targets,
not commitments — gated by G5/G8.**

---

## 26. Analytics & KPIs

### 26.1 SLIs / SLOs (engineering)

| SLI | SLO | Window | Measure |
|---|---|---|---|
| API availability | 99.9% | 30d | successful/total requests |
| Report latency | p95 < 60s, p99 < 300s | 7d | request→delivery histogram |
| Job durability | 5 nines (zero loss) | 30d | queued vs completed/lost |
| **Tier‑0 leakage** | **0 (non‑negotiable)** | forever | packet inspection + audit |
| Dogfood MTBF | ≥ 720h, 0 critical | 30d | incident clock |
| Cost envelope | within budget | monthly | spend vs budget |
| Backup restorability | 100% weekly | weekly | automated restore test |

Burn‑rate alerts (when observability lands): fast‑burn (10% budget/1h) → P0; slow‑burn (5%/6h) → P1.

### 26.2 Product / funnel KPIs

| KPI | Target / ref | Source of truth |
|---|---|---|
| GitHub stars (OSS funnel) | 1K by M3, 10K by ~18mo (refs: Mastra 22K, Dify 100K) | GitHub |
| Mastra‑migration attempts | >100 in 30 days (G7) | migration guide analytics |
| Design‑partner LOIs | ≥1 @ $50K+ (G5) | CRM |
| Failed‑project interviews | 10 (H1/H2) | research log |
| ICP w/ allocated gov budget | ≥4/10 (H3, G4) | discovery notes |
| Activation (first useful task) | <10 min from install | product analytics |
| Time‑to‑close | <30 days (developer self‑serve) | CRM |
| CAC | <$500/customer (else organic thesis fails) | finance |
| Gross margin @10 cust | >40% (G8) → >70% (B4) | P&L |
| NRR | >100% (hybrid pricing +38%) | billing |

### 26.3 Instrumentation plan

Per‑request cost attribution; RED/USE metrics (§18.1); weekly capacity + cost report; tier‑0
egress counter (must stay 0); funnel events (install→first‑task→connector‑connected→report). Privacy:
product analytics are **tier‑aware** — no T0 content in any analytics sink.

---

## 27. Compliance roadmap

| Framework | What it needs | Mimir hook | When |
|---|---|---|---|
| **SOC 2 Type II** | 6‑mo observation, audit, controls | hash‑chain audit, RBAC, RLS, secrets vault, change mgmt | initiate ~2027‑Q1 (G6); ~8–11mo |
| **ISO 27001** | 135 controls / 14 categories | same control base + docs | post‑SOC2 |
| **ISO 42001 (AI gov)** | AI governance management system | policy‑as‑code + audit + model cards | 2027 |
| **GDPR** | DPA, right‑to‑erasure | **crypto‑delete + proof** (§13.2); tier‑0 locality | M5 |
| **EU AI Act (Art. 12/14)** | automatic logging (6‑mo), human oversight | immutable audit + approval gates; risk docs | pre‑position; enforcement Dec 2027 |
| **HIPAA (if healthcare)** | BAA, encryption, audit | at‑rest encryption + audit + tenancy | on demand |

**Evidence automation:** because every endpoint carries tier + RBAC scope tags and every action is
audited, we can **auto‑generate compliance evidence** (who/what/when/under‑which‑policy) — turning
governance from a cost center into a sales asset. **No compliance claim is made before the control
is real and tested.**

---

## 28. Glossary

| Term | Definition |
|---|---|
| **Brain** | always‑on orchestrator owning authoritative memory; routes work; lives on T0 |
| **Node** | a machine in the mesh (brain/desktop/cloud/phone) |
| **Mesh** | all nodes joined privately (Tailscale), coordinated as one |
| **Well** | the shared memory/knowledge store |
| **Workhorse / Reviewer** | the building model / the checking‑optimizing‑planning model |
| **Tier (T0/T1/T2)** | privacy class of data/compute |
| **Classification gateway** | routes requests to model/node by sensitivity |
| **Fencing epoch** | monotonic token guaranteeing a single valid writer |
| **Ship‑and‑wipe** | run a cloud job in volatile storage, ship the result, destroy the data |
| **Time‑machine** | branch/rewind/restore of memory |
| **Routine** | scheduled/triggered agent job |
| **Connector** | an integration with its own auth + privacy tier |
| **RAG** | retrieval‑augmented generation; here, cite‑or‑abstain |
| **MoA** | mixture‑of‑agents (multi‑model consensus for hard tasks) |
| **WoL** | wake‑on‑LAN |
| **RLS** | Postgres row‑level security (tenant isolation) |
| **ADR / RFC** | architecture decision record / request for comments |
| **Gate (G1–G9)** | binary commercial go/no‑go checkpoint |

---

## 29. ADR index (decision log)

ADRs live in `docs/adr/` (Nygard format: Context / Options / Decision / Consequences). Seed set:

| ADR | Decision | Status |
|---|---|---|
| 0001 | Monorepo (pnpm + uv) | proposed |
| 0002 | TS (Fastify/Next.js) + Python workers + **Temporal** | proposed |
| 0003 | **LibSQL embedded replicas** for state (not rsync/.backup) | proposed |
| 0004 | Tenancy: `tenant_id` + **Postgres RLS** from commit 1 | proposed |
| 0005 | **Zod single‑source‑of‑truth** in `@mimir/shared-types`; OpenAPI → contracts | proposed |
| 0006 | **gVisor** for untrusted code (not plain Docker) | proposed |
| 0007 | **Tailscale tag ACLs**; cloud worker **air‑gapped** | proposed |
| 0008 | **Ephemeral SSH CA** (no static keys) | proposed |
| 0009 | **Data‑classification gateway** (Kimi/PRC mitigation) | proposed |
| 0010 | **Hash‑chain + Merkle** immutable audit; GDPR crypto‑delete | proposed |
| 0011 | **No Dependabot** → CodeQL + dependency‑review + Scorecard | accepted |
| 0012 | **Harden‑before‑sell** sequencing (gates G1–G9) | accepted |
| 0013 | Pricing: $99/user Pro, $500 min, hybrid base+usage | proposed |
| 0014 | Naming: **Mimir** (brand) vs Hermes (external reference, not runtime) | accepted |
| 0015 | **Audit‑log semantics under memory branching** | proposed |
| 0016 | **Classifier confidence + conservative T0 fallback** | proposed |
| 0017 | **Internal engine RPC protocol** (replaces prior Mimir↔Hermes ACP stub) | rejected |
| 0018 | **State source‑of‑truth** inside Mimir store (replaces prior Hermes seam stub) | rejected |
| 0019 | **Tier‑enforcement point** inside Mimir model calls (replaces prior Hermes interception stub) | rejected |

---

## 30. Sources & RAG provenance

This document retrieves from (does not invent from) the local corpus — the same discipline Mimir
applies to user data. Citation tags above map here:

| Tag | File |
|---|---|
| `[validation *]` | `~/Desktop/mimir/hermesh_validation.agent.final.md` (go/no‑go, defects, sequencing) |
| `[plan]` | `~/.claude/plans/refactored-wobbling-snail.md` (Parts I–V) |
| `[security review]` | `…/Kimi_Agent_Paid Feature Expansion Roadmap/security_review_hermes_mesh.md` |
| `[SRE]` | `…/sre_observability_review.md` |
| `[perf review]` | `…/performance_cost_review.md` |
| `[UX review]` | `…/ux_review_hermesh_mesh.md` |
| `[missing‑caps]` | `…/missing_capabilities_review.md` |
| `[chaos]` | `…/chaos_analysis.md` |
| `[PDF]` | *Advanced AI Orchestration Mesh Review.pdf* (LibSQL/gVisor/ACL/SSH‑CA/NixOS hardening) |
| `[sec01–07]` | `…/hermes_features_sec01..07.md` (market, competitors, tiers, killer features, pricing, roadmap) |
| `[wide01–06]` | `…/research/hermes_features_wide01..06.md` (deep market/competitor/pricing/sovereignty research) |

**Rule:** any figure without a citation is marked **_(assumption)_**. If it's not in the sources,
we do not state it as fact. This is the product's contract applied to its own plan.

---

## 31. Appendices

### 31.1 Open decisions to lock (tracked as `decision` issues)

- Developer‑first vs enterprise‑first **first dollar** (lean dev‑first; lock after H1/H3).
- License: Apache‑2.0 core + commercial Pro/Ent — confirm before public release (ADR‑0013).
- Concrete calendar dates vs relative windows — set once team capacity is known.
- Live Airtable base seeding timing (now vs M6) — *(assumption: M6 via F‑020)*.
- Reviewer model: Claude Pro + rate‑limit handling **now**; Claude API if pipeline stalls.
- **Classifier confidence + conservative T0 fallback** (ADR‑0016) — decide before M2‑3.
- **Audit‑log semantics under memory branching** (ADR‑0015) — decide before M4/M5.
- **Worker/cron tenant-context wrapper** — decide repository/DB‑client abstraction before M1‑4.
- **Distributed rate‑limiting backend** — confirm Redis design before M1‑1.
- **Engine ownership decision** (§5.1) — Mimir implements its own engine. Hermes is a design
  reference, not a runtime dependency. ADR‑0017/0018/0019 (Hermes integration seams) are
  rejected; their replacements are ordinary Mimir implementation issues M2‑11 through M2‑14.

### 31.2 Document change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026‑06‑10 | First detailed ROADMAP (features, milestones, risks, go/no‑go, sources) |
| 0.2 | 2026‑06‑10 | Expanded to full master plan: §0–§31 (architecture, data, API, RAG, memory, orchestration, resilience, security/threat model, governance, web/connector specs, delivery, cost, observability, testing, CI/CD, process, issue‑level milestones, analytics, compliance, glossary, ADRs) |
| 0.3 | 2026‑06‑15 | Design/code review validation + M0/M1 implementation: monorepo, Fastify API, Next.js PWA, Python uv workspace, CI workflows, docs, ADR-0015/0016; sessions/messages CRUD, RBAC, LibSQL replica client, Clerk login + app shell; resolved cloud-worker return-path contradiction; added R-15–R-21 + R-B7/R-B8; tightened M0/M1/M2 acceptance; added classifier + TS/Python contract-drift CI gates; clarified embeddings, gVisor egress, Postgres/LibSQL authority split |
| 0.4 | 2026‑06‑16 | Hermes build‑vs‑wrap decision (HYBRID): new §5.1 "Built on the Hermes runtime" + decision matrix; README built‑on‑Hermes note; §10 substrate note; annotated M2‑5/M2‑7 (EXTEND/HYBRID) + M6 (EXTEND over Hermes gateway); added integration‑seam issues M2‑11–M2‑14 (ACP/state/tier‑enforcement/audit); added R‑22 (reinventing‑Hermes duplication); ADR‑0017/0018/0019 (+stub files); §31.1 HYBRID open decision |
| 0.5 | 2026‑06‑16 | Corrected Hermes relationship: Mimir owns its own engine; Hermes is a design reference only. Rewrote §5.1, README architecture/FAQ, M2‑5/M2‑7/M2‑11–M2‑14, M6 intro, R‑22; rejected ADR‑0017/0018/0019; updated §31.1. Added §5.2 upstream ingestion process, `scripts/hermes-release-check.sh`, `.github/workflows/upstream-hermes-check.yml`, `docs/references/hermes-baseline.md`, and AGENTS.md guidance; updated `.gitignore` to exclude local Hermes clones.

### 31.3 How to use this document

- **Building?** §21 (process) + §22 (your milestone's issues) + the relevant deep‑dive (§6–§19).
- **Reviewing scope?** §23 (features) + §24 (risks).
- **Selling/strategy?** §25 (go/no‑go) + §26 (KPIs) + §27 (compliance) — but only after G1/G2.
- **Onboarding?** README → `AGENTS.md` → this §0–§5 → pick a `good first issue`.

<div align="center">

*Mimir — consult the well. This is a living document; every claim re‑evaluated as gates produce data.*

</div>
