# F-090 — Self-building skill agent + marketplace

**Tier:** Enterprise · **Priority:** P1 · **Status:** Roadmap

## Problem / motivation

Mimir should improve itself: when it detects a useful feature, it should build it safely, validate it, and make it available. Other Pro/Premium users should be able to install proven skills from a marketplace.

## Proposed solution

1. **Opportunity detection** — scan knowledge graph clusters, task/job history, and explicit user requests to propose new skills/tools/routines.
2. **Skill proposal persistence** — `skill_proposal` table with state machine (`proposed`, `approved`, `rejected`, `implemented`, `failed`).
3. **Skill-build orchestrator** — isolated git worktree/clone, generate implementation plan, apply code changes, run `pnpm lint/typecheck/test`, retry up to a max, and give up if infeasible.
4. **Skill packaging** — manifest + migrations + routes + UI components + tests packaged as an installable skill.
5. **Marketplace backend** — `marketplace_listing`, `tenant_skill_install`, and `tenant.plan` gating.
6. **Marketplace UI** — replace the mocked `/marketplace` page with real listings, install buttons, and author publishing.

## Acceptance criteria

- [ ] Detector produces at least one proposal from a synthetic graph.
- [ ] Skill builder generates a trivial passing feature in a sandbox worktree.
- [ ] Retry loop aborts after max attempts and surfaces a reason.
- [ ] Publish a skill and install it from the marketplace.
- [ ] Plan gating prevents Free tenants from installing Pro/Premium skills.

## Out of scope

- Fully autonomous live upgrade of the running production instance.
- Stripe checkout / real billing (plan gating only for MVP).
- Self-modifying core without admin approval.
