# ADR-0017: Mimir↔Hermes Invocation via ACP

## Status

**rejected** — superseded by the engine-ownership decision in §5.1 (ROADMAP v0.5).

## Context

This ADR was drafted under the assumption that Mimir would be built **on top of** the Hermes agent runtime (Nous, `~/.hermes/hermes-agent`) and would invoke Hermes as its execution substrate. The question was whether to drive Hermes over its ACP server, import it as a library, or shell out to it.

## Decision

Mimir **does not invoke Hermes**. Hermes is a design reference for connector/tool/skill breadth; Mimir implements its own engine. Therefore no ACP client, library import, or subprocess seam is required. The model adapters, tool registry, skill runtime, connector gateway, sandboxing, cron/routines, and subagent delegation are all Mimir's own code.

## Consequences

- The integration risks described in this ADR (protocol boundary, upgrade cadence, internal coupling) disappear.
- M2-11 is now an ordinary internal-RPC issue, not a cross-runtime seam.
- All execution paths are governed natively by Mimir's classification, audit, cost, and tier-enforcement layers.
