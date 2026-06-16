# AGENTS.md — apps/api

## Scope

Fastify API: HTTP edge, auth, tenancy, routes → services.

## Rules

- Thin routers, fat services, data in repositories.
- Validate request and response with Zod (`@mimir/shared-types`).
- Set `app.tenant_id` from the verified JWT inside the per-request transaction.
- Every worker/cron DB call must use a tenant-context wrapper.
- Return the one error envelope everywhere.
- Use cursor pagination for large sets.
- Tag every endpoint with privacy tier + RBAC scope in OpenAPI.
