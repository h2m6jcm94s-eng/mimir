# UI Design Prompts for Mimir

Use these prompts with Kimi, Midjourney, Figma AI, or any design assistant. Each prompt describes one surface and the key states it must handle.

---

## 1. Console (primary chat)

**Prompt:**
> Design a chat console UI for a privacy-tiered AI orchestration mesh called Mimir. The console is the front door. Default mode is one input box with smart defaults. Progressive disclosure: a "show steps" button reveals the plan; an "advanced" toggle exposes model choice, budget, privacy tier, target node, and raw tool calls. Every assistant message shows three badges: model name, privacy tier (T0 green / T1 blue / T2 amber), and trust score. Every grounded answer has a "Sources" chip listing retrieved documents. Include attachment menu (file/image/voice), voice input button, and an inline approval card when a risky action is requested. Use a calm, trustworthy palette with clear safety affordances.

**States to design:** idle, streaming, awaiting-approval, offline, error.

---

## 2. Status / Topology map

**Prompt:**
> Design a visual topology map for a device mesh. Show four node types: laptop (brain), desktop worker, cloud worker, phone. Each node card shows health (green/amber/red), last seen, queued jobs, and cost burn. Connection lines show transport and privacy tier. A node drawer slides out with health checks, recent jobs, wake/suspend buttons, and logs. Never show raw JSON. Include a global "Emergency HALT" button and a live cost chip. Make it glanceable on mobile.

---

## 3. Tasks / Kanban

**Prompt:**
> Design a kanban board for a unified stream of scheduled + ad-hoc agent jobs. Columns: Queued, Running, Blocked (node offline), Needs Attention, Done. Each card shows title, privacy tier badge, model badge, cost estimate, blast-radius summary, and idempotent retry button. Include drag-to-reprioritize, batch select, and a trace button to open the workflow. Use severity colors for risk levels.

---

## 4. Approvals inbox

**Prompt:**
> Design a humane approvals inbox. Each card shows: action summary, blast-radius preview (services/users/cost affected), workhorse confidence %, reviewer agreement check, risk level, and a countdown timer (low 24h / med 4h / high 15m+call). Actions: Approve (PIN for destructive), Deny (reason), Snooze, Delegate, Approve with note, Defer to desktop. Timeout must never show "denied" — show "queued for review" instead. Include batch approve and focus mode.

---

## 5. Electron desktop chat app

**Prompt:**
> Design an Electron desktop chat application for Mimir. It should feel like a native messaging app with deep OS integration: global hotkey to open, system tray icon, native notifications, and screen-capture as a reference source. The main window is the console chat. A sidebar shows recent sessions. The top bar has HALT, cost chip, and offline status. Settings panel includes node management, model routing, and privacy tiers. Dark/light mode. Respectful of screen real estate — compact by default, expandable for experts.

---

## 6. Browser extension

**Prompt:**
> Design a browser extension popup for Mimir. Two modes: (a) quick capture — save this page/selection/screenshot to the knowledge well with a tier tag; (b) quick action — ask Mimir about the current page, summarize it, or trigger a routine. Show capture confirmation, privacy tier badge, and recent captures. The extension icon should reflect mesh health. Minimal chrome, native-feeling, secure.

---

## 7. Telegram bot chat

**Prompt:**
> Design a Telegram bot interaction flow for Mimir. Use inline keyboards for approvals, simple commands (/status, /halt, /tasks), and voice note support. Messages should include privacy tier badge, trust score, and source citations when answering from data. Approval requests render as inline buttons with blast-radius preview. Emergency HALT as a quick reply command. Respect Telegram's UI limits while keeping Mimir's safety affordances clear.

---

## 8. CLI / terminal UI

**Prompt:**
> Design a terminal-first CLI experience for Mimir. Rich tables for tasks, nodes, and costs. Spinner states for running jobs. JSON output option for scripts. Command palette style: `mimir chat`, `mimir task run`, `mimir node status`, `mimir halt`. Use color sparingly: green/blue/amber for tiers, red for HALT. Support autocomplete and command history. The CLI should feel fast and deterministic.

---

## 9. Reports / Knowledge gallery

**Prompt:**
> Design a reports browser with full-text + semantic search. Filters: tier, model, date, tag, source. Each report card shows title, tier badge, delivery status (toast/chat/web/email), and source preview. The knowledge gallery shows docs, code, and screenshots-as-references as cards with tier labels. Include a "test retrieve" panel where users can verify RAG retrieval.

---

## 10. Memory / Time-machine + graph

**Prompt:**
> Design a memory viewer with two panes: (a) a timeline of checkpoints with branch/rewind/restore controls; (b) an interactive graph of semantic/episodic/procedural memory nodes. Selecting two checkpoints shows a diff. Contradictions appear as flagged nodes. Gated actions (rewind/restore) require approval. Use a calm, map-like aesthetic.

---

## Design system constraints

Across all surfaces:
- **Tier colors:** T0 = green, T1 = blue, T2 = amber.
- **Trust score:** purple gradient.
- **HALT:** red, always reachable in one tap.
- **No silent failures:** every error shows a human-readable message + retry.
- **Offline mode:** persistent banner + local-model indicator.
- **Badges:** model + tier + trust on every AI surface.
