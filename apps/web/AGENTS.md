# AGENTS.md — apps/web

## Scope

Next.js 15 PWA: the dual UI (kid-simple → expert).

## Rules

- Use generated `@mimir/contracts` client; never hand-roll API types.
- Zod single-source-of-truth for forms (`react-hook-form + zodResolver`).
- Tailwind-only; no inline styles.
- Every AI surface shows model + trust + privacy-tier badges.
- Global Emergency HALT, cost chip, offline banner.
- No silent catch; toast from `ApiError.userMessage`.
