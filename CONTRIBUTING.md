# Contributing to Mimir

Thanks for helping build Mimir. This project is pre-alpha; we are deliberately hardening before we sell.

## Quick start

1. Fork and clone.
2. `make install`
3. `cp .env.example .env` and fill in keys.
4. `make dev`

## Process

1. **Open a descriptive issue** using the templates in `.github/ISSUE_TEMPLATE/`.
2. Branch from `main`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `test/<slug>`.
3. Keep PRs small (≤ ~400 LoC).
4. Link the issue: `Closes #NN`.
5. Green CI + one human review + CodeRabbit review.
6. Squash-merge.

## Definition of Done

- Code + tests + docs + CHANGELOG entry
- Green CI, no new lint/type errors
- Tenancy/tier impact addressed
- OpenAPI updated if API changed
- UI screenshot if web changed
- Manual QA walkthrough from `docs/guides/testing-mimir.md` for user-facing changes

## Code of Conduct

See `CODE_OF_CONDUCT.md`.
