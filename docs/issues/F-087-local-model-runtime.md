# F-087 — Local model runtime for T0 privacy

**Tier:** Free · **Priority:** P1 · **Status:** Implemented

## Problem / motivation

Mimir’s privacy model depends on Tier 0 (T0) requests staying on hardware the user controls. Today the T0 path falls back to a `LocalProvider` stub that returns `[local] processed: …` — it does not actually run a model. The `OllamaProvider` exists but only supports `/api/generate` (non-chat), has no health check, no model management, and no local embedding path. Without a real local runtime, T0 chat, T0 capture classification, and T0 routines are either broken or silently degraded.

## Proposed solution

Make Ollama (and optionally llama.cpp) a first-class T0/T1 provider:

1. **Runtime config table** (`local_model_config`): per-tenant Ollama base URL, default chat model, default embedding model, enabled flag.
2. **Health & discovery API** (`GET /v1/models/local/status`): returns whether Ollama is reachable, which models are pulled, and which operations (chat/embed) are available.
3. **Model management API** (`POST /v1/models/local/pull`, `GET /v1/models/local`): list and pull models via Ollama.
4. **Chat-compatible provider**: switch `OllamaProvider` from `/api/generate` to `/api/chat` with messages array; support streaming.
5. **Local embedding provider**: add `OllamaEmbeddingProvider` that calls `/api/embeddings` so T0 knowledge items never leave the device for embedding.
6. **Web console surface**: settings page section for local model config, offline/online badge, model pull UI.
7. **Graceful fallback**: if Ollama is unreachable, route falls back to the stub with a clear audit event and user-visible hint.

## Acceptance criteria

- [x] `GET /v1/models/local/status` returns `{ reachable: boolean, models: [...], chatAvailable: boolean, embedAvailable: boolean }`.
- [x] `POST /v1/models/local/pull` queues a model pull job and returns a job ID.
- [x] `POST /v1/chat` with `tier: 0` succeeds end-to-end when Ollama is running and a chat model is pulled (router already selects local providers for T0; Ollama chat wired).
- [x] T0 knowledge capture attempts local Ollama embeddings and falls back gracefully with a warning.
- [x] When Ollama is offline, the system returns a structured `LOCAL_MODEL_UNAVAILABLE` / `LOCAL_MODEL_PULL_FAILED` error.
- [x] Web settings page has a “Local models” tab with status, config, and pull button.

## Test plan

- **Unit:** `OllamaProvider` parses chat responses and streams; `OllamaEmbeddingProvider` returns vector and dimension.
- **Integration:** start a real Ollama in CI (or use a lightweight container) and assert `GET /v1/models/local/status` and a T0 chat round-trip.
- **Contract:** OpenAPI spec covers new endpoints and response schemas.
- **E2E (real local API):** log in via web UI, configure local Ollama, send a T0 prompt, verify response is produced without any cloud provider call.
- **E2E (offline):** stop Ollama, send a T0 prompt, verify graceful error and audit log entry.

## Out of scope

- GPU acceleration management (memory offloading, multi-GPU).
- Automatic model download on first use (explicit pull only).
- Support for non-Ollama local runtimes in this issue (llama.cpp server can be a follow-up).
- Quantization selection UI.
