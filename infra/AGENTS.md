# AGENTS.md — infra

## Scope

Docker, Temporal, deployment, NixOS, sops-nix, networking.

## Rules

- `docker-compose.yml` is the local source of truth for Postgres + Redis + Temporal.
- No static SSH keys; ephemeral SSH CA only.
- Cloud worker air-gapped off the tailnet; returns via short-lived signed webhook.
- Secrets injected at activation time, never committed.
