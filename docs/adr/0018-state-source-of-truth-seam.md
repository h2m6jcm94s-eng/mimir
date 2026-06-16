# ADR-0018: State Source-of-Truth Seam (Mimir store vs Hermes `state.db`)

## Status

**rejected** — superseded by the engine-ownership decision in §5.1 (ROADMAP v0.5).

## Context

This ADR was drafted under the assumption that Hermes would maintain its own single-host SQLite `state.db` alongside Mimir's multi-tenant store, and that a sync seam would be required between the two.

## Decision

There is no Hermes `state.db`. Mimir owns the only state store: Postgres (authoritative, multi-tenant, RLS-secured) plus LibSQL embedded replicas for failover. The engine reads and writes Mimir state directly. No sync seam is needed.

## Consequences

- The source-of-truth ambiguity disappears.
- Tenant isolation, encryption, and tier-redaction are enforced in one place.
- M2-12 is now an ordinary "engine persists state to Mimir store" issue.
