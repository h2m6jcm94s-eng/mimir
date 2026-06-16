# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- M0 monorepo scaffolding implemented: `apps/web`, `apps/api`, `packages/shared-types`, `packages/contracts`, `packages/eslint-config`, `services/agent`, `services/rag`, `services/shared`, `infra/`, `tests/`.
- Root docs: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- `Makefile`, `.env.example`, `docker-compose.yml`, GitHub workflows, issue/PR templates, CODEOWNERS, labeler, CodeRabbit config.
- Husky + lint-staged + commitlint setup.
- Fastify API skeleton with `/livez`, `/readyz`, `/healthz`.
- Next.js 15 PWA skeleton.
- Python uv workspace with agent, RAG, and shared workers.
- Nested `AGENTS.md` for `apps/api`, `apps/web`, `services/`, `infra/`.
- M1 brain core completed: Drizzle schema with tenant/user/node/session/message tables, RLS migration, tenant-context wrapper, config/secrets abstraction, structured logging, Clerk auth + RBAC middleware, sessions/messages CRUD, LibSQL replica client, web Clerk login + app shell with HALT/cost chip/offline banner.
