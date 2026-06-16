# AGENTS.md — Mimir Contributor Guide

This file governs the repository it lives in and all subdirectories.

## What we are building

Mimir is a privacy-tiered AI orchestration mesh: one always-on brain that owns your memory and coordinates a fleet of nodes (laptop, desktop, optional cloud, phone) while keeping sensitive data on hardware you control.

## How to make changes

1. Read the relevant `AGENTS.md` (this one at root; nested ones in `apps/*`, `packages/*`, `services/`, `infra/`).
2. Changes start with a descriptive issue.
3. Small PRs (≤ ~400 LoC), one logical change, green CI, one review, squash-merge.
4. Big features = ADR issue + RFC + a stack of small PRs.
5. Update `ROADMAP.md` and `CHANGELOG.md` when scope changes.

## Conventions

- **Single source of truth:** Zod schemas in `@mimir/shared-types`. OpenAPI generates `@mimir/contracts`.
- **TypeScript + Python:** TS for API/web; Python for workers.
- **Tenancy from commit 1:** every tenant-scoped table has `tenant_id` + Postgres RLS.
- **Privacy tiers:** T0 private, T1 local compute, T2 cloud ephemeral. A request's tier never widens.
- **No silent catch:** log + structured error or re-throw.
- **Tests:** no PR merges red. Coverage gate on new code ≥ 85%.

## Build / test / lint

```bash
make install   # pnpm + uv
make up        # Postgres, Redis, Temporal
make dev       # api + web
make lint
make typecheck
make test
```

## Hermes upstream watch

Hermes (Nous `~/.hermes/hermes-agent`) is a **local design reference only** — not a dependency.
- Keep the reference clone at `~/.hermes/hermes-agent` on your own machine.
- **Never commit Hermes code** to this repo.
- When porting a Hermes idea, open a Mimir issue, reimplement it under Mimir's governance model, and update `docs/references/hermes-baseline.md`.

## Asking for help

Open an issue with `Problem → Proposed solution → Acceptance criteria → Test plan → Out of scope`.
