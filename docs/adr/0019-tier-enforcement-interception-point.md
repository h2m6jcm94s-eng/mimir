# ADR-0019: Tier-Enforcement Interception Point for Hermes Model Calls

## Status

**rejected** — superseded by the engine-ownership decision in §5.1 (ROADMAP v0.5).

## Context

This ADR was drafted under the assumption that Hermes would make model calls and that Mimir needed a proxy, allow-list, or hook to intercept those calls and enforce the T0-never-egresses invariant.

## Decision

Mimir implements its own model-provider layer. Tier enforcement is enforced **inside** Mimir's engine before any provider call is issued. There is no external runtime to intercept; the classification gateway and scrubber are part of Mimir's provider-selection path.

## Consequences

- No LiteLLM-style proxy is needed purely to gate an external runtime.
- The T0-containment CI test targets Mimir's provider layer directly.
- M2-13 is now an ordinary "enforce tier rules in Mimir model calls" issue.
