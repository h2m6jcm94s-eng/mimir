# Mimir Web UI — Design Prompt Document

Use this file to capture the remaining UI/UX decisions for the Mimir Next.js web app.

## What we have already ported

- Design tokens and three themes (light, dark, liquid-gold) in `src/app/globals.css`.
- Tailwind config with Mimir color scale, fonts (Schibsted Grotesk, JetBrains Mono), shadows, radii.
- App shell: `Sidebar`, `TopBar`, `Footer` with collapsible navigation and `AnimatePresence` page transitions.
- Console page with glassmorphic composer, tier/model badges, slash-command palette.
- Briefings page with filter tabs (All / Important / Emails / Meetings) and action chips.
- Skills hub with platform cards and installed skills grid.
- Skill Builder with code editor, block palette, tier selector, and test panel.
- Platform skill pages: macOS, Linux, Windows with capability cards and toggle controls.

## What still needs your design prompts

Fill in the answers below. The more specific you are (colors, layout, interactions, data), the faster the next iteration can be built.

### 1. Status / Overview page

- What is the primary goal of `/status`? (e.g. system health dashboard, daily summary, or agent-state monitor)
- Which metrics should be visible at a glance? (queue depth, running tasks, error rate, cost, latency)
- Preferred layout: dense dashboard cards, a single status timeline, or both?
- Any chart libraries you prefer? (Recharts, Tremor, custom SVG)

### 2. Tasks / Approvals / Reports

- For `/tasks`: should it be a kanban board, table, or timeline? What columns/states?
- For `/approvals`: what does a human-in-the-loop review look like? Side-by-side diff, accept/reject buttons, comments?
- For `/reports`: are these generated documents, audit logs, or recurring analytics?

### 3. Knowledge, Memory, Governance

- `/knowledge`: document library with search + tags, or graph visualization?
- `/memory`: list of facts/preferences, editable, with source trace?
- `/governance`: policy editor, access-control matrix, audit trail, or rules debugger?

### 4. Cost / Connectors / Routines

- `/cost`: show token spend by model, tier, skill, time period? Budget alerts?
- `/connectors`: grid of integrations (Gmail, Slack, GitHub, Notion, Linear) with connection status and auth flows?
- `/routines`: schedule editor, trigger builder, or playbook list?

### 5. Settings / Profile

- `/settings`: appearance (theme switcher), account, API keys, notification preferences, workspace members?
- Any Clerk-managed sections we should expose vs. hide?

### 6. Animations & micro-interactions

- Which pages should have entrance/exit animations vs. stay snappy?
- Do you want page-level transitions (already scaffolded), skeleton loading states, or shimmer placeholders?
- Preferred motion style: subtle fade/slide, or the richer Framer Motion orchestration from the Hermes reference?

### 7. Mobile / responsive behavior

- Should the sidebar become a bottom rail, a drawer, or a collapsible top bar on small screens?
- Which pages must work well on phones vs. desktop-only?

### 8. New features not yet listed

- Are there any other first-class pages or experiences you want? (e.g. `/agents`, `/team`, `/publications`, `/lab`, `/security`)
- Any brand-specific illustrations, mascot, or iconography to add?

## Technical constraints to keep in mind

- Next.js 15 RC, React 19 RC, TypeScript, Tailwind 3.4.
- `PLAYWRIGHT_TEST=true` disables Clerk auth for e2e tests — every route under `(app)` must render in that mode.
- Keep client components minimal; prefer server components where there is no interactivity.
- Reuse existing tokens and components before adding new ones.

## How to use this file

1. Edit this document with your answers.
2. Tell the agent which section(s) to implement next.
3. The agent will implement them in the same style as the existing pages and run `pnpm test:e2e`.
