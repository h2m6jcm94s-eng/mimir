# ADR 0021 — Cross-mesh knowledge sharing with admin approval

**Status:** Accepted  
**Date:** 2026-06-17  
**Author:** devayan

## Context

Mimir is a privacy-tiered, multi-tenant mesh. Each tenant (a team, a family, a personal brain) owns its own knowledge base and is isolated from every other tenant by Postgres Row Level Security (RLS). However, real meshes need to share knowledge: a finance team shares an expense policy with sales, a parent shares a household manual with a sibling tenant, or a company shares approved runbooks with a subsidiary.

We need a sharing primitive that:

- Keeps tenant isolation intact (no cross-tenant reads at runtime).
- Requires an explicit admin-level approval on the provider side.
- Preserves the original privacy tier so a Tier-2 request never accidentally grounds on Tier-0 shared data.
- Is hash-chain audited so every request, approval, denial, and revocation is tamper-evident.
- Works with the existing RAG search surface without complicating query plans.

## Decision

Implement **admin-approved, copy-on-approve cross-mesh knowledge sharing**.

A requester tenant asks the provider tenant for access to a specific `knowledge_item`. A provider admin reviews and approves. On approval, Mimir **copies** the item and its embeddings into the requester tenant as a `shared_knowledge_item`. From that point on, the requester tenant searches its own data normally; RLS never crosses tenant boundaries.

### Schema

Three new tables (migration `0011_youthful_kree.sql`):

| Table | Purpose |
|---|---|
| `knowledge_share` | The request/approval record. Links provider tenant, requester tenant, source `knowledge_item`, status (`pending` → `approved`/`denied`/`revoked`/`expired`), scope (`search` or `read`), tier, reviewer, and expiration. |
| `shared_knowledge_item` | Mirror of `knowledge_item` stored in the **requester** tenant. Carries `share_id`, `source_tenant_id`, and `source_knowledge_item_id` for provenance. |
| `shared_embedding` | Mirror of `embedding` linked to `shared_knowledge_item_id`. Uses the same `bigint generated always as identity primary key` pattern as `embedding` because Drizzle's custom vector type serializes the identity incorrectly during migration. |

All three tables have `tenant_id` columns and RLS policies (`knowledge_share_isolation`, `shared_knowledge_item_isolation`, `shared_embedding_isolation`) so a tenant sees only rows where it is the provider or the requester, and shared copies are only visible inside the requester tenant.

### Approval flow

1. Requester (with `KNOWLEDGE_WRITE`) calls `POST /v1/knowledge/shares` with `providerTenantId`, `knowledgeItemId`, and `scope`.
2. Provider tenant lists incoming shares with `GET /v1/knowledge/shares?direction=incoming`.
3. Provider admin (with `KNOWLEDGE_WRITE`) calls `POST /v1/knowledge/shares/:id/approve`.
4. Inside a tenant-scoped transaction for the provider, Mimir records the approval, captures the source item's tier, and audits `knowledge_share_approved`.
5. In a nested transaction scoped to the **requester** tenant, Mimir copies the item + embeddings and audits `knowledge_share_accepted` in the requester tenant.
6. Deny and revoke follow the same pattern; revoke additionally deletes the shared copy in the requester tenant.

### Tier enforcement

The source item's `tier` is stored on the `knowledge_share` row and copied onto the `shared_knowledge_item`. Unified search (`GET /v1/knowledge/search?includeShared=true&tier=T`) unions local `embedding` rows and `shared_embedding` rows, filtering with `shared_embedding.tier <= requestTier`. This guarantees a Tier-0 query never sees Tier-2 shared data and mirrors Mimir's wider rule that a request's tier never widens.

### Audit events

Each lifecycle transition emits a hash-chained audit event in the acting tenant:

- `knowledge_share_requested` — requester tenant
- `knowledge_share_approved` — provider tenant
- `knowledge_share_denied` — provider tenant
- `knowledge_share_revoked` — revoker's tenant (provider or requester)
- `knowledge_share_accepted` — requester tenant (copy created)

Cross-tenant revoke emits the revocation event in the revoker's tenant; the cleanup in the requester tenant does not emit an extra audit event there.

## Consequences

### Positive

- No runtime cross-tenant reads; RLS isolation is preserved end-to-end.
- Provider retains full control: approval is explicit, revocable, and expires.
- Search stays simple because shared data lives in the requester tenant with a parallel table shape.
- Tier enforcement is explicit in SQL and therefore reviewable/testable.
- Every action is hash-chain audited.

### Negative / Risks

- Copy-on-approve duplicates embedding storage. For large shared corpora this can become expensive; future work may add deduplication or lazy eviction.
- Revoke is destructive for the shared copy; if a requester made downstream references to it, those references break. Future work may add soft-delete / tombstone semantics.
- Expiration is currently stored but not yet enforced by a background job.
- Cross-tenant identity validation (e.g., ensuring the requester tenant exists) is minimal in Phase 2 and should be hardened before enterprise use.

## Migration notes

- New migration `0011_youthful_kree.sql` creates enums, tables, foreign keys, indexes, and RLS policies.
- Migration `0012_grant_mimir_app_share_privileges.sql` grants the `mimir_app` application role read/write access to the new tables.
- `shared_embedding.id` uses raw SQL `bigint generated always as identity primary key` because Drizzle's custom `vector` type generated an invalid type name for the identity column.
- Dev connects as `mimir_app` so `FORCE ROW LEVEL SECURITY` policies are enforced during local development and CI.

## Related

- `ROADMAP.md` §Knowledge / RAG / multi-tenant sharing
- `docs/adr/0015-audit-log-semantics-under-memory-branching.md`
- `docs/adr/0019-tier-enforcement-interception-point.md`
