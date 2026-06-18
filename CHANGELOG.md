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
- Cross-mesh knowledge exchange with admin approval (F-054): `knowledge_share`, `shared_knowledge_item`, and `shared_embedding` schema with RLS; `POST /v1/knowledge/shares`, lifecycle endpoints (`approve` / `deny` / `revoke`), and unified `GET /v1/knowledge/search?includeShared=true&tier=...` that returns local + shared results while enforcing `shared.tier <= request.tier`; web UI `/knowledge/requests` for incoming/outbound share management; integration tests covering two-tenant request, approval, denial, revocation, and cross-tenant isolation.
- F-008 data-classification gateway: ADR-0016 accepted with conservative T0 fallback on low confidence; strengthened rule engine with T0 PII/secrets, T1 local-compute, and T2 public-task rules plus attachment name/MIME classification; `ModelRouter` now enforces that tier-0 requests only use local providers; classification wired into `POST /v1/tasks`, `POST /v1/sessions/:id/messages`, and `POST /v1/knowledge` with `classification_decision` audit events; unit, property, and integration tests for T0 containment and audit logging.
- F-018 GitHub connector: `connector` schema/migration with tenant RLS; shared Zod types; repository and generic `ConnectorRegistry` with tier enforcement and `connector_action` audit; thin `fetch`-based GitHub client; read actions (`listRepos`, `getIssue`, `getPullRequest`, `ingestFile`); `github.openPr` apply handler routed through the review loop; `POST /v1/connectors` management and action routes; updated connectors hub UI; unit and integration tests.
- F-002/F-003/F-004 authentication, multi-tenancy, and RBAC: Supertokens session middleware; `tenant`/`app_user`/`organization` schema with Postgres RLS enforced by `mimir_app`; `withTenantTransaction` tenant-context wrapper; action-granular scopes (`chat:write`, `jobs:read`, `connectors:admin`, etc.) and `requireScope` route guards.
- F-006/F-007 durable orchestration and job queue: Temporal client/worker wiring, `taskRunWorkflow`, `job` repository with idempotency keys, status lifecycle, and checkpoints for phase replay.
- F-009 workhorse→reviewer loop: iterative review workflow with up to 3 cycles, stable-hash draft cycle detection, RFC‑6902 JSON-patch application, and apply registry for side effects.
- F-010 resilience: model circuit breaker with fail-soft, idempotency-key deduplication on job creation, and checkpointed Temporal activities.
- F-017 immutable audit foundation: `audit_event` table with `prev_hash`/`hash` chain, `/v1/audit` verification endpoint, and tamper-evident replay.
- F-017 governance-as-code MVP: tenant-scoped `policy` and `approval` tables with RLS; YAML/JSON policy engine supporting `allow`/`deny`/`require_approval` rules on `action`, `tier`, `kind`, and `dailySpendUsd`; `PUT /v1/governance/policy` and `GET /v1/approvals` + approve/deny endpoints; policy gates wired into `POST /v1/tasks` and GitHub `openPr`; web governance and approvals pages integrated with live API; unit and integration tests.
- F-022/F-023/F-024 web app screens: console, live status topology, tasks kanban, approvals with PIN gate, knowledge ingest and share requests, memory/time-machine viewer, governance/audit policy editor, cost dashboard, and settings.
- F-026 emergency halt: Redis-backed halt state, `/v1/halt` routes, and circuit-breaker fail-soft behavior.
- F-027 cost-governance MVP: tenant-scoped `budget` table with RLS, daily/monthly limits, throttle threshold, and enabled flag; `BudgetService` status/forecast/action gating with `BudgetExceededError`/`BudgetThrottledError`; `GET/PUT /v1/budget`, `/v1/budget/forecast`, and `/v1/budget/spend` endpoints; pre-flight checks wired into `POST /v1/tasks`, GitHub `openPr`, and Temporal `build` activity; web cost dashboard and status widget wired to live endpoints; `AUTO_HALT_DAILY_USD` retained as a global fallback when no tenant budget is configured; unit and integration tests.
- Connector generic write framework: extended `connector_kind` enum and shared `ConnectorKind` with `telegram`, `gmail`, `slack`, and `airtable`; introduced `ConnectorWriteRegistry` with per-action input schemas, customizable approval messages, and Temporal apply handlers; refactored `github.openPr` to use the generic write path; `POST /v1/connectors/:kind/actions/:action` now dispatches read and write actions generically; unit and integration tests updated.
- Messaging & social connectors: added `telegram`, `whatsapp`, `instagram`, `facebook`, and `pinterest` to the `connector_kind` enum; shared Zod input schemas; Telegram Bot API client; shared Meta Graph API client for WhatsApp/Instagram/Facebook; Pinterest REST API client; read actions (`getChat`, `getBusinessProfile`, `listMedia`, `getMedia`, `listPages`, `listPosts`, `listBoards`, `listPins`) and approval-gated write actions (`sendMessage`, `publishMedia`, `publishPost`, `createPin`) with connector-specific approval messages; wired into registry, routes, Temporal apply handlers, and web connectors page; unit and integration tests.
- F-038 agent hierarchy / role registry: tenant-scoped `agent_role` schema/migration with built-in defaults (`main`, `planner`, `reviewer`, `coder`, `researcher`, `memory`, `executor`, `fallback`); `AgentRoleRegistry` resolves role + tier + capabilities to a provider/model without hard-coding any vendor; `GET/POST/PATCH/DELETE /v1/agents/roles` and `POST /v1/agents/resolve` endpoints; integration tests.
- F-074 conversational memory search: keyword search across session messages via `GET /v1/sessions/search?query=...&limit=...`; returns matching messages with their sessions; integration test.
- F-061 ceo/operator dashboard: `GET /v1/reports/ceo` aggregates task health (status counts + recent failures), burn (daily spend vs budget), risk (halt state + failure counts), and decisions (pending approvals); integration test.
- Wire agent roles into Temporal `build` activity: a task payload can now include `role` (e.g. `coder`, `researcher`, `memory`) and the activity resolves it via `AgentRoleRegistry` before calling the model router, making sub-agent delegation model-agnostic.
- F-007 durable job queue foundation: `job` table extended with `priority`, `retry_count`, `max_retries`, `started_at`, `finished_at`, `error_code`, `error_message`; added `idx_job_tenant_status`; `GET /v1/tasks` now supports `status` and `type` filters; added `GET /v1/tasks/counts` and `PATCH /v1/tasks/:id/status` with transition validation and audit logging.
- F-007 cancel/retry: `POST /v1/tasks/:id/cancel` terminates the running Temporal workflow and marks the job `failed` with `error_code: cancelled`; `POST /v1/tasks/:id/retry` re-queues a failed/needs-attention job and restarts its workflow while enforcing `max_retries`; workflow/run IDs are persisted on the job row.
- F-022 tasks kanban wired to real API: board now uses `@mimir/shared-types` `Job`, fetches live jobs and counts, adds a `Failed` column, wires status moves to `PATCH /v1/tasks/:id/status` with optimistic rollback, adds retry buttons for failed jobs, derives blast radius from attachments/type, and adds per-column empty states.
- F-022 status topology with real data: added `GET /v1/tasks/timeline`; status page now fetches real nodes, jobs, timeline, and budget using cookie auth, removes mocked connector strip and queue chart, shows per-node active-job count and cost with fallback to the brain node, and adds empty states; `NodeCard` simplified to show jobs/cost/last seen instead of fake CPU/RAM bars.

### Fixed

- Console page type error: removed stale `model` variable reference in raw tool-call preview after switching to provider/role selection.

- Added missing `REPORTS_READ` scope to `Scopes` in `apps/api/src/middleware/rbac.ts`, resolving a runtime undefined reference for `member`/`viewer` roles.
- Enabled Kimi and Groq provider integration tests to run without real API keys by falling back to a local HTTP mock server; real keys still hit live endpoints when present. Made `AnthropicMessagesProvider` support configurable `supportedTiers` so the Kimi Code path can serve tier 1.
- Fixed e2e global setup parameterization of `SET LOCAL app.tenant_id`; switched Playwright provider defaults to `local` so the suite passes without API keys; renamed `console-kimi.spec.ts` to `console-provider.spec.ts`; added `NEXT_PUBLIC_PLAYWRIGHT_TEST` + `mimir_test_session` cookie auth bypass so web e2e tests can reach protected API routes in test mode.

### Changed

- Reframed `README.md`, `AGENTS.md`, and `ROADMAP.md` around Mimir's human‑first mission: a universal companion that can be a friend, researcher, coder, marketer, financial advisor, HR partner, CEO coach, and lifelong assistant, while preserving the privacy‑tiered mesh architecture. Added companion, finance, marketing, HR, CEO/operator, and daily-life human feature rows (F‑063–F‑082) to the roadmap, plus human‑first feature themes.

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
