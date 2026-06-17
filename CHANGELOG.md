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
- F-015 foundational RAG knowledge base: pgvector support, `knowledge_item`/`embedding` schema with tenant RLS, ingest/search repositories, `POST /v1/knowledge` and `GET /v1/knowledge/search` endpoints, deterministic fake 768-dim embeddings, and unit/integration tests.
- F-016 cross-mesh knowledge exchange with admin approval: `knowledge_share`, `shared_knowledge_item`, and `shared_embedding` schema with RLS; `POST /v1/knowledge/shares`, lifecycle endpoints (`approve` / `deny` / `revoke`), and unified `GET /v1/knowledge/search?includeShared=true&tier=...` that returns local + shared results while enforcing `shared.tier <= request.tier`; web UI `/knowledge/requests` for incoming/outbound share management; integration tests covering two-tenant request, approval, denial, revocation, and cross-tenant isolation.

### Changed

- **Auth:** replaced Clerk with self-hosted Supertokens (Session + EmailPassword recipes) running in Docker alongside Postgres/Redis/Temporal.
- **Identity model:** introduced `user_account`, `external_identity`, `organization`, and refactored `app_user` to represent tenant membership with a per-tenant role (`owner`, `admin`, `manager`, `member`, `viewer`).
- **Node identity:** extended `node` table with `owner_user_account_id`, `public_key`, and `api_key_hash`; added `POST /v1/nodes/enroll` to issue device API keys.
- **DB access:** local dev now connects as a dedicated `mimir_app` Postgres role so `FORCE ROW LEVEL SECURITY` policies are actually enforced (superusers bypass RLS). `infra/postgres/init.sql` creates this role on first container start.
- **Web auth:** replaced `@clerk/nextjs` with `supertokens-auth-react`; added `/auth/[[...path]]` pre-built UI route and `SessionAuth` wrapper for protected app routes.
- **Environment:** `.env.example` updated with `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `AUTH_DOMAIN`, `WEB_APP_DOMAIN`, and `DATABASE_URL=postgresql://mimir_app:mimir_app@localhost:5432/mimir`.

### Migration

- Existing Clerk dev data is reset. New migrations `0009_supertokens_identity_part1.sql` and `0010_supertokens_identity_part2.sql` create the new identity tables and drop `auth_identity`/`clerk_id`.
- ADR 0020 documents the rationale and new model: `docs/adr/0020-clerk-to-supertokens-self-hosted-auth.md`.
- Cross-mesh knowledge sharing: migration `0011_youthful_kree.sql` adds `knowledge_share`, `shared_knowledge_item`, and `shared_embedding` with tenant isolation policies; `0012_grant_mimir_app_share_privileges.sql` grants the `mimir_app` role access. ADR 0021 documents the copy-on-approve design and tier enforcement.
