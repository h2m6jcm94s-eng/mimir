# Mimir End-to-End Tests

These tests simulate real users interacting with the Next.js app and the Fastify
API. They run against the actual local stack: Postgres, Redis, Temporal,
Supertokens, the API, the Temporal worker, and the web app.

## Run

```bash
# 1. Start local infrastructure
make up

# 2. Run the full e2e suite (starts API + worker + web automatically)
pnpm test:e2e

# 3. Open the Playwright UI for debugging
pnpm test:e2e:ui
```

## Structure

- `playwright.config.ts` — starts the API, Temporal worker, and web dev servers,
  runs migrations, and points tests at `http://localhost:3000`.
- `global-setup.ts` / `global-teardown.ts` — run migrations and seed the test
  tenant before the first test.
- `fixtures/` — custom `test` fixture with `apiRequest` rooted at the API base
  URL and auth helpers.
- `specs/` — one spec per feature, written from a user's perspective. Cross-mesh knowledge sharing is covered by API integration tests at `apps/api/src/routes/knowledge-shares.integration.test.ts`; end-to-end UI specs for the request/approve flow are planned.

## Test mode

When `PLAYWRIGHT_TEST=true`, the Next.js app bypasses Supertokens session checks
so tests can behave like an already-authenticated user. The API still validates
the test bearer token, which resolves to a deterministic test tenant.

> Note: the e2e auth helpers will need to be updated to exercise real Supertokens
> sign-up/sign-in flows once the Supertokens bypass is fully removed.
