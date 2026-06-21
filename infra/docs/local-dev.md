# Local development infrastructure

Mimir's local stack is defined in `infra/docker-compose.yml` and wrapped by the root `Makefile`.

## Start the stack

```bash
make up
```

This starts:

| Service | Endpoint | Purpose |
|---|---|---|
| Postgres | `localhost:5432` | App DB + pgvector |
| Redis | `localhost:6379` | Caching, token replay, queues |
| Temporal | `localhost:7233` | Durable workflow orchestration |
| Temporal UI | `http://localhost:8080` | Workflow observability |
| Supertokens | `localhost:3567` | Self-hosted auth |

## Install dependencies

```bash
make install
```

## Run API + web dev servers

```bash
make dev
```

API is on `http://localhost:3001`, web on `http://localhost:3000`.

## Reset local data

```bash
make down
make up
```

To also wipe volumes:

```bash
docker compose -f infra/docker-compose.yml down -v
```

## Run migrations

```bash
pnpm --filter @mimir/api db:migrate
```

Migrations run automatically in CI and against the test DB during E2E setup.
