# AGENTS.md — services

## Scope

Python workers (uv workspace): RAG, render, ingest, model adapters, Temporal activities.

## Rules

- Pydantic models generated from the same OpenAPI spec as the TS client.
- Type hints everywhere; mypy --strict.
- No plaintext secrets; read from vault/env injected by infra.
- Temporal activities are idempotent and retry-aware.
- T0/T1 data never leaves the node it was classified for.
