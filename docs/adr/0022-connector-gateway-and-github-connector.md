# ADR 0022 — Connector gateway foundation and GitHub connector (PAT-first)

**Status:** Accepted  
**Date:** 2026-06-17  
**Author:** devayan

## Context

Mimir is a privacy-tiered, multi-tenant orchestration mesh. To act on a user's behalf outside the mesh — open a pull request, read a file for RAG, list repositories, or ingest code — it needs a uniform way to integrate with external systems. Each integration must respect the same hard constraints as the rest of Mimir:

- **Tenant isolation:** a connector configured by one tenant must not be visible to another.
- **Privacy tiers:** a request cannot be widened to a less-private connector (T0 request → T1 connector is forbidden).
- **Audit:** every connector action must be hash-chain auditable.
- **Secret hygiene:** raw tokens must never live in code or `.env` in production; only a `secret_ref` is stored in the application database.

GitHub is the first connector because the code-review loop is one of Mimir's core use cases: a workhorse proposes a change, a reviewer approves it, and Mimir opens the pull request on the user's behalf.

## Decision

Implement a **generic connector registry** and ship the **first connector for GitHub** using a fine-grained personal access token (PAT) stored through the existing `SecretResolver` abstraction.

### Schema

Migration `0013_fat_timeslip.sql` adds the `connector` table and two enums:

| Enum | Values |
|---|---|
| `connector_kind` | `github` |
| `connector_status` | `connected`, `disconnected`, `error` |

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `tenant_id` | FK to `tenant`; RLS policy `connector_isolation` enforces tenant scope |
| `kind` | `connector_kind` |
| `account` | Optional org/account name (e.g. `acme`) |
| `scopes` | Array of declared scopes (e.g. `repo`) |
| `tier` | Privacy tier; defaults to **1** (local compute) |
| `status` | `connector_status`; defaults to `disconnected` |
| `secret_ref` | Alias used with `SecretResolver.getForTenant(tenantId, alias)` |
| `last_sync` | Last successful sync timestamp |

The migration also enables `FORCE ROW LEVEL SECURITY` and a `connector_isolation` policy so that the `mimir_app` application role (used in dev and CI) is bound by RLS just like production tenants.

### Generic registry

`services/connectors/registry.ts` provides `ConnectorRegistry.runAction(ctx, actionCtx)`:

1. Loads the connector row for the requested `kind` inside the tenant-scoped transaction.
2. Rejects the action if `requestTier < connector.tier` with `TIER_VIOLATION`.
3. Dispatches to a kind-specific handler map (`handlersByKind[kind][action]`).
4. Catches handler errors, records them in the result, but always emits a `connector_action` audit event.
5. Returns `{ success, result }` on success; throws on failure so the route can map to an HTTP error.

Handlers receive `(ctx, config, input)` where `config` carries `tenantId`, `kind`, `account`, and `secretRef`.

### GitHub connector

`services/connectors/github/client.ts` is a thin `fetch`-based GitHub REST client:

- Headers: `Accept: application/vnd.github+json`, `Authorization: Bearer <token>`, `X-GitHub-Api-Version: 2022-11-28`.
- Resolves the PAT through `SecretResolver.getForTenant` using `secretRef`.
- Methods: `listRepos`, `getIssue`, `getPullRequest`, `getFile`, `openPr`.
- `getFile` base64-decodes GitHub's `content` field before returning it.

The registry handlers expose the following read actions:

| Action | Purpose |
|---|---|
| `listRepos` | List user repos, or org repos when `account` is set |
| `getIssue` | Fetch a single issue by `owner/repo/issueNumber` |
| `getPullRequest` | Fetch a single PR by `owner/repo/pullNumber` |
| `ingestFile` | Fetch a file, decode it, and ingest it as a `code` knowledge item |

### Writes through the review loop

Opening a pull request is a **write** and a **risky action**, so it does not go through the synchronous action route. Instead:

1. `POST /v1/connectors/github/actions/openPr` parses `GitHubOpenPrInput`, classifies the request tier, checks the connector tier, and creates a `github.openPr` job.
2. It starts `taskRunWorkflow` via Temporal with the PR payload.
3. The workflow runs the workhorse/reviewer loop and ultimately invokes `githubOpenPrHandler` in `services/connectors/github/apply.ts`.
4. The apply handler returns `{ applied: false }` unless the review was approved. If approved, it opens the PR via `GitHubClient` and returns `{ applied: true, output: { number, url } }`.

This reuses Mimir's existing approval and audit machinery instead of adding a separate gate for connectors.

### Tier enforcement

Both the registry and the `openPr` path enforce the same rule: a request's tier must be **greater than or equal to** the connector's tier. A T0 request to a T1 connector is rejected with `TIER_VIOLATION`. Connectors default to T1 so that sensitive data never silently leaves the local mesh.

### API surface

`routes/connectors.ts` registers under `/v1/connectors`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List connectors (requires `CONNECTORS_ADMIN`) |
| `POST` | `/` | Create a connector |
| `DELETE` | `/:kind` | Delete a connector |
| `POST` | `/:kind/actions/:action` | Run a read action through the registry |
| `POST` | `/:kind/actions/openPr` | Enqueue a `github.openPr` job and start the review workflow |

### Audit events

- `connector_action` — emitted by the registry for every dispatched read action, carrying `kind`, `action`, `input`, `success`, and `result`.
- `classification_decision` — emitted when `openPr` is enqueued, recording the tier chosen for the PR.
- The review loop emits its own `job_*` / `apply_*` audit events around the apply handler.

## Consequences

### Positive

- Connectors are first-class tenant-scoped entities with RLS, tiers, and audit.
- The registry pattern makes adding the next connector (Mail, Telegram, etc.) a matter of adding a handler map and shared-type schemas.
- Write actions inherit Mimir's existing review/approval workflow instead of building a second gate.
- Tokens are never stored in the `connector` table; only a `secret_ref` is persisted.

### Negative / Risks

- **PAT-first auth:** fine-grained PATs are easy to start with but coarse compared to OAuth/GitHub Apps. Scoping, rotation, and per-user tokens are future work.
- **No webhooks / sync loop:** `last_sync` is stored but nothing updates it yet; repository/issue state must be fetched on demand.
- **Connector status is static:** `connected`/`disconnected` is set at creation; there is no health probe or OAuth token expiry handling.
- **Error surfaces:** registry handler errors are returned in the audit payload; the route currently surfaces them as 500s, which may leak connector details. Future work should map known GitHub errors to structured codes.
- **No dedicated approvals UI:** the open-PR flow reuses the generic job/review loop; a connector-specific approval screen is out of scope for this PR.

## Migration notes

- Migration `0013_fat_timeslip.sql` creates enums, the `connector` table, foreign key, indexes, and RLS.
- The generated migration omitted `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and the `connector_isolation` policy; these were added by hand so dev/CI enforce tenant isolation.
- Dev connects as the `mimir_app` Postgres role, so RLS policies are actually exercised locally.

## Related

- `ROADMAP.md` §15 (Connector specs) and §23 (Features list, F-018)
- `docs/adr/0019-tier-enforcement-interception-point.md`
- `docs/adr/0020-clerk-to-supertokens-self-hosted-auth.md`
- `docs/adr/0021-cross-mesh-knowledge-sharing.md`
