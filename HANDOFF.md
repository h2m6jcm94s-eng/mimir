# Mimir — Session Handoff

**Purpose:** everything needed to resume work on Mimir in a fresh session without re‑deriving context.
**Date:** 2026‑06‑10 · **Owner:** devayan (`devayandewri@gmail.com`)

---

## 1. What Mimir is (one paragraph)

**Mimir** is a **privacy‑tiered AI orchestration mesh**: one always‑on "brain" (laptop) that owns
your memory and coordinates a fleet of nodes (desktop worker, optional air‑gapped cloud worker,
phone) as a single trustworthy mind — driven from a chat prompt *or* a friendly UI, grounded in your
own data (RAG, cite‑or‑abstain), never leaking sensitive data off the hardware you control. It is
inspired by the **Hermes** agent runtime (Nous `~/.hermes/hermes-agent`) for connector/tool/skill
surface breadth, but Mimir implements its own engine — *Hermes is not a dependency and not the
public name*). Two hard promises: **kid‑simple → expert‑complex** and
**RAG‑first / no‑hallucination**.

---

## 2. How we got here (chat arc)

Started as a one‑off ("where is the firecrawl CLI running") → grew into designing a personal AI mesh
inspired by the existing Hermes install → progressively hardened it against six brutal review dossiers +
a PDF → added commercialization → ran a thesis‑validation gate → **named it Mimir** → set the
engineering rails (modeled on a real reference repo) → wrote the two project docs. The full evolving
design lives in the plan file (§4 below).

---

## 3. Accounts, repos & reference

- **GitHub primary:** `ItsDevayan`. **Second account:** `h2m6jcm94s-eng` (both authed in `gh`).
  **`gh` active account is currently `h2m6jcm94s-eng`** (switch back with
  `gh auth switch --user ItsDevayan` if needed).
- **Mimir will be a NEW standalone repo under `h2m6jcm94s-eng`** (org target `mimir-mesh`, scope
  `@mimir/*`). Not yet created — local folder only so far: `~/Desktop/mimir/`.
- **Reference repo to mirror (the proven bar):** **`h2m6jcm94s-eng/ai-video-editor`**
  (Fastify + Next.js + Python workers + Temporal). Conventions we adopt:
  - `AGENTS.md` canonical + `CLAUDE.md = @AGENTS.md`; **nested `AGENTS.md` per app/layer**.
  - **Zod single‑source‑of‑truth** in `packages/shared-types`; `react-hook-form + zodResolver`;
    `sonner` toasts; one state machine per surface; Tailwind‑only; no silent catch.
  - Issue templates incl. **`decision.md`** (ADR‑as‑issue); concrete PR checklist.
  - **CodeRabbit** (AI review) + human review; **Husky + lint‑staged**; Codecov.
  - CI = lint/typecheck/test/build + **CodeQL + dependency‑review — NO Dependabot** (user dislikes
    the mail flood).

---

## 4. Key files & where things live

| File | What |
|---|---|
| `~/Desktop/mimir/README.md` | Overview (407 lines) — what Mimir is, promises, tiers, architecture, stack, quickstart, FAQ. |
| `~/Desktop/mimir/ROADMAP.md` | **Master plan (1,448 lines, §0–§31)** — architecture, data/RLS, API, RAG, memory, orchestration, resilience, security+threat model, governance, web+connector specs, delivery, cost, observability, testing, CI/CD, process, **issue‑level milestones M0–M10**, features table, risk register, **commercialization + go/no‑go**, analytics, compliance, glossary, ADRs, sources. |
| `~/Desktop/mimir/hermesh_validation.agent.final.md` | Pre‑existing brutal **go/no‑go validation** (H1–H5, design‑partner script, gates G1–G9, harden‑before‑sell). |
| `~/.claude/plans/refactored-wobbling-snail.md` | The evolving **planning doc** (Parts I–V): mesh → hardening → hybrid direction → repo/process → READMEs. |
| `~/Desktop/Giya/Practice/P_01/Git/Kimi_Agent_Paid Feature Expansion Roadmap/` | **Research corpus** (RAG sources): 6 reviews (`security_review`, `sre_observability_review`, `performance_cost_review`, `ux_review`, `missing_capabilities_review`, `chaos_analysis`), 7 feature sections (`hermes_features_sec01..07`), 6 deep‑research dossiers (`research/hermes_features_wide01..06`). |
| `~/Desktop/Giya/Practice/P_01/Git/Advanced AI Orchestration Mesh Review.pdf` | 19‑page hardening report (LibSQL, gVisor, Tailscale ACLs, ephemeral SSH CA, NixOS/sops‑nix, ActivityWatch). |
| `~/.hermes/hermes-agent/` | The Hermes runtime that inspired Mimir's surface design (reference only). |

---

## 5. Locked decisions

- **Stack:** Next.js 15 + Tailwind + shadcn + Clerk (web) · Fastify + **Temporal** + Drizzle +
  Postgres + Redis (api) · Python workers (uv) · `@mimir/shared-types` (Zod) + `@mimir/contracts`
  (OpenAPI→client). pnpm + uv monorepo.
- **Architecture:** single‑writer brain + **LibSQL embedded replicas** (zero‑loss failover via
  fencing epoch) · Temporal orchestration · **gVisor** sandbox for untrusted code · **Tailscale tag
  ACLs** · **AWS air‑gapped** off the tailnet · **ephemeral SSH CA** · encryption at rest
  (LUKS + SQLCipher) · secrets vault (no plaintext).
- **Models:** Kimi = workhorse, Claude = reviewer, local (Ollama) = fallback. **Data‑classification
  gateway** routes sensitive (T0/T1) → Claude/local, public/stripped → Kimi (mitigates Kimi/PRC
  exposure). **Reviewer stays on Claude Pro + rate‑limit handling.**
- **Tenancy:** `tenant_id` + **Postgres RLS from commit 1**; cross‑tenant/cross‑tier isolation =
  required CI gate.
- **Direction:** **Hybrid** — build the personal mesh now, **architect for product** (don't rewrite
  later). **Enterprise = revenue ICP; developer‑first GTM.** Four new capabilities folded in:
  graph‑native memory, event‑driven core, governance‑as‑code + immutable audit, enterprise access
  layer.
- **Principles:** **RAG‑first / no hallucination** (cite or abstain) · **kid‑simple → expert‑complex**
  (UI *and* prompt) · privacy by tier · determinism over vibes · **harden before you sell**.
- **Hardening scope:** critical‑security + data‑loss + cost first; heavy SRE/consensus/CI theater
  deferred (it's a personal→product build, not enterprise day 1).
- **Naming:** **Mimir** (brand) vs Hermes (external reference, not a dependency). Avoid Grafana‑Mimir /
  Hermès trademark collisions via org/scope/domain (`mimir-mesh`, `@mimir`, `mimir.sh`).

---

## 6. Open defects (MUST close before any reliability/governance claim — Gate G1)

🔴 prompt‑injection→RCE · 🔴 Kimi/PRC exposure (mitigating) · 🟠 split‑brain (phone witness) ·
🟠 single‑writer SPOF (mitigating via LibSQL) · 🟠 plaintext at rest · 🟠 flat tailnet.
(Full register: `ROADMAP.md` §24.)

---

## 7. Commercialization gate (don't sell before this)

Lead with **developer velocity + cost control**, not EU AI Act fear (deadline slipped to Dec 2027).
Validate **H1–H5** with 5–10 design‑partner interviews **before** more commercial code. **Harden →
dogfood 30 days (0 critical) → prove → sell.** Gates **G1–G9** are binary. Full detail:
`ROADMAP.md` §25 + `hermesh_validation.agent.final.md`.

---

## 8. Current status & next steps

**Status:** docs complete (README 407 lines; ROADMAP 1,448 lines, all 31 sections, fully cited). No
code, no GitHub repo yet. User wants the ROADMAP deepened further (toward 5,000+ lines) with **real
detail, not filler**.

**Immediate next steps (pick up here):**
1. **Deepen ROADMAP sections** (in this order, in portions): §6 full DDL + RLS policies → §7 full
   request/response examples per resource → §14 full per‑screen component/state specs → §15 full
   per‑connector auth/scope/endpoint/test → §22 more test cases per issue.
2. **Scaffold Milestone 0** (the repo rails) as the first small PRs: monorepo skeleton, root +
   nested `AGENTS.md`/`CLAUDE.md`, `CONTRIBUTING/SECURITY/CODE_OF_CONDUCT/CHANGELOG`, `.github/`
   (issue templates incl. `decision.md`, PR template, CODEOWNERS, labeler), CI workflows
   (`ci/codeql/dependency-review/security/web/e2e/release`, **no Dependabot**), Husky+lint‑staged,
   branch‑protection ruleset, ADR 0001, Makefile + docker‑compose (Postgres/Redis/Temporal).
3. **Create the GitHub repo** under `h2m6jcm94s-eng` (org `mimir-mesh`) when ready
   (`gh repo create`).
4. Optionally hand the **front‑end design brief** (in the plan file / earlier in chat) to a design
   agent to generate the web app scaffold.

---

## 9. Working preferences / norms (important)

- **Build in portions** (avoids quality drift); each chunk grounded + cited.
- **RAG over generic generation**; mark anything not in sources as _(assumption)_; never invent.
- **Model after the best OSS** (google/eng‑practices, Stripe/Google AIP, FastAPI, Supabase/Astro,
  Temporal), **not** a personal house style.
- **Small descriptive issue → small PR (≤~400 LoC) → green CI → 1 review → squash.** ADR for
  decisions. No mega‑PRs.
- **No Dependabot.** Quality over filler. Professional bar (10+ external contributors incoming,
  e.g. partner‑company engineers).

---

*End of handoff. The two living docs (README.md, ROADMAP.md) + the validation file + the plan file
are the authoritative state.*
