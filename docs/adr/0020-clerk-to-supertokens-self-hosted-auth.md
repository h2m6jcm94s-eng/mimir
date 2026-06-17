# ADR 0020 — Replace Clerk with self-hosted Supertokens

**Status:** Accepted  
**Date:** 2026-06-17  
**Author:** devayan

## Context

Mimir's original auth stack used Clerk for JWT session management and user identity. Clerk is excellent for single-user SaaS, but it became a poor fit as the product direction moved toward:

- Multiple teams/orgs per user (sales mesh, finance mesh, engineering mesh).
- Inviting managers/employees into shared tenants with roles.
- Machine credentials for desktop/worker/phone nodes.
- Keeping auth data inside the tailnet for the privacy tier.
- Avoiding per-seat pricing as the mesh grows.

Clerk's organization/role features are paid, and its data model does not cleanly support a device-as-identity layer. A self-hosted alternative keeps data in our Postgres and avoids vendor lock-in.

## Decision

Replace Clerk with **self-hosted Supertokens** (Docker container next to Postgres/Redis) and implement our own tenant/org/device identity layer in Drizzle.

### Identity model

| Concept | Mapping |
|---|---|
| Supertokens `userId` | `external_identity.external_id` → `user_account` |
| `user_account` | Global human identity (email, external id) |
| `tenant` | A team/mesh (e.g., Sales, Finance); personal tenants auto-provision on first sign-in |
| `app_user` | Membership of a `user_account` in a `tenant` with a per-tenant role |
| `organization` | Optional grouping of tenants for future "mesh of meshes" / CEO-level visibility |
| `node` / `device` | A mesh node with an owner, public key, and API key hash |

### Auth flow

1. Web or API client obtains a Supertokens session (email/password or OAuth).
2. API middleware verifies the session, extracts the Supertokens `userId`, and resolves it to `{ tenantId, userAccountId, appUserId, role }` via `external_identity`.
3. If the user has no local record, we auto-provision a personal tenant, `app_user` (role = owner), and `external_identity`.
4. All subsequent DB work runs inside `withTenantTransaction(tenantId)`, which sets `app.tenant_id` and relies on Postgres RLS for isolation.

### Device auth (Phase 1)

- Nodes are enrolled via `POST /v1/nodes/enroll`.
- The brain issues a random API key once; only its SHA-256 hash is stored in `node.api_key_hash`.
- Node-to-brain auth will be hardened to mTLS/device certificates in a follow-up issue.

## Consequences

### Positive

- Self-hosted; no per-seat tax or external dependency for core identity.
- Supports multi-tenant membership, roles, and device identity natively.
- Unlocks cross-mesh knowledge exchange (admin-approved cross-team data access).
- Keeps auth data in the privacy tier (tailnet).

### Negative / Risks

- We now operate an auth service (Supertokens core) as infrastructure.
- Existing Clerk dev data is reset; production migration would be a separate ADR.
- Postgres must be accessed as a non-superuser role (`mimir_app`) for RLS policies to be enforced; superusers bypass RLS.

## Migration notes

- Clerk packages removed from `apps/api` and `apps/web`.
- `auth_identity` table replaced by `external_identity`; `clerk_id` removed from `app_user`.
- New migrations: `0009_supertokens_identity_part1.sql`, `0010_supertokens_identity_part2.sql`.
- `infra/postgres/init.sql` creates the `mimir_app` role and grants privileges on first container start.
- `.env.example` updated with `SUPERTOKENS_*`, `AUTH_DOMAIN`, `WEB_APP_DOMAIN`, and `DATABASE_URL=postgresql://mimir_app:mimir_app@localhost:5432/mimir`.

## Related

- `ROADMAP.md` §Auth / multi-tenancy / mesh-of-meshes
- Plan: `/home/devayan/.kimi/plans/wonder-man-nightcrawler-metamorpho.md`
