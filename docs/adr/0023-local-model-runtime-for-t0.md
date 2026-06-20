# ADR 0023 — Local model runtime for T0 privacy

**Status:** Accepted  
**Date:** 2026-06-21  
**Author:** devayan  

## Context

Mimir enforces a privacy tier model where Tier 0 (T0) data must never leave the user’s hardware. The model layer already supports a `LocalProvider` stub and an `OllamaProvider`, but neither provides a complete T0 runtime: chat, embeddings, health checks, and model management are missing or degraded. Without a real local runtime, T0 requests silently fall back to a stub or fail entirely.

## Options

| Option | Pros | Cons |
|---|---|---|
| A. Promote Ollama to the canonical T0 runtime | Mature, supports chat + embeddings, easy local install, open-source, broad model compatibility | Adds a runtime dependency for T0; not every device can run it well |
| B. Implement a llama.cpp server provider directly | No intermediate server, maximum control | More integration work; model format friction; slower to ship |
| C. Keep the stub and document “T0 requires external setup” | Simplest code | Violates the product promise; users get broken T0 out of the box |
| D. Route T0 to a cloud “private” endpoint | No local dependency | Contradicts the T0 definition; unusable for sensitive data |

## Recommendation

**Option A — Ollama as the canonical T0 runtime**, with a generic local-provider interface so llama.cpp (Option B) can be added later without changing the router.

- `OllamaProvider` becomes chat-native (`/api/chat`) and gains an `OllamaEmbeddingProvider` sibling.
- A new `local_model_config` table stores per-tenant Ollama settings (base URL, default models, enabled flag).
- Health and model-management endpoints expose Ollama reachability.
- The router’s tier containment stays unchanged: T0 only uses `local = true` providers.
- When Ollama is unreachable, the system returns a structured `LOCAL_MODEL_UNAVAILABLE` error rather than silently widening the tier.

## Risks

- **Dependency availability:** users may not have Ollama installed. Mitigation: clear setup hints, health endpoint, and documentation.
- **Performance variation:** laptops vary widely. Mitigation: allow model selection and expose latency in status.
- **Embedding dimension mismatch:** different models emit different vector sizes. Mitigation: store dimension with the model config and validate before indexing.
- **Security of Ollama’s local server:** default binds to localhost only, which is acceptable for T0/T1.

## Related work

- F-087 implementation issue: `docs/issues/F-087-local-model-runtime.md`
- Existing providers: `apps/api/src/services/models/providers/ollama.ts`, `apps/api/src/services/models/providers/local.ts`
- Model router: `apps/api/src/services/models/router.ts`
