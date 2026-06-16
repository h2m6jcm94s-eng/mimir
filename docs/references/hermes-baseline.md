# Hermes baseline tracker

This file records the last-reviewed state of the local Hermes reference clone.
Hermes code is **never committed** to the Mimir repo.

## Reference location

Local clone: `~/.hermes/hermes-agent` (maintainer's machine only)
Upstream:    `https://github.com/nousresearch/hermes-agent` (confirm and update if different)

## Baseline

- Last reviewed tag/commit: `TBD — set on first review`
- Last reviewed date: `TBD`
- Reviewer: `TBD`

## Tracked subsystems

| Subsystem | Hermes location | Mimir status | Notes |
|---|---|---|---|
| Connector gateway | `connectors/` or `gateways/` | not started | track for surface breadth |
| Tool registry | `tools/` | not started | track for abstraction patterns |
| Skill runtime | `skills/` | not started | track for skill format |
| Provider adapters | `providers/` | not started | track for failover patterns |
| Sandbox/env abstraction | `env/` or `sandbox/` | not started | track for gVisor backend ideas |
| FTS/session memory | `memory/` or `state.db` | ignored | Mimir uses Postgres/LibSQL |

## Ingestion log

| Date | Hermes tag/commit | Triage issue | Decision |
|---|---|---|---|
| TBD | TBD | TBD | TBD |
