# Mimir UI Design System v2

> A mature, cutting-edge interface for the privacy-tiered AI orchestration mesh.
> This document is a working draft. Prompt me with the sections you want me to expand first.

## 1. Design principles

1. **Privacy is visible, not verbose.** Every surface that touches data shows its tier (T0 private, T1 local, T2 cloud) at a glance. Tier color is ambient, not alarming.
2. **Trust is earned in the open.** Model confidence, cost, review status, and audit trails are surfaced next to every action — never buried in a modal.
3. **Calm productivity.** Warm paper tones, generous whitespace, and restrained motion. The UI should feel like a premium native app, not a dashboard.
4. **Platform-aware.** macOS, Linux, and Windows each have dedicated skill surfaces that expose the right capabilities for that OS without leaking cross-platform assumptions.
5. **Skill-first.** Skills are first-class citizens with their own hub, builder, and marketplace. Users compose agents from skills the way developers compose packages.

## 2. Visual identity

### Color palette

```
--bg-primary:        #FAF9F6   /* warm paper */
--bg-surface:        #F1EFE9   /* card surface */
--bg-surface-raised: #E8E5DD   /* elevated panels */
--bg-input:          #FFFFFF   /* input fields */
--bg-glass:          rgba(250, 249, 246, 0.72)

--text-primary:      #211F1A   /* warm ink */
--text-secondary:    #6B675E   /* warm grey */
--text-muted:        #A39E93   /* placeholder/meta */

--accent-primary:    #4338CA   /* indigo — primary action */
--accent-teal:       #0D9488   /* local / tier 1 */
--accent-slate:      #64748B   /* cloud / tier 2 */
--accent-warning:    #D97706
--accent-danger:     #DC2626   /* HALT / danger */
--accent-success:    #16A34A

--tier0-color:       #4338CA   /* private */
--tier1-color:       #0D9488   /* local */
--tier2-color:       #64748B   /* cloud */

--halt-red:          #DC2626
--cost-chip-bg:      rgba(67, 56, 202, 0.08)
--cost-chip-text:    #4338CA
```

A dark variant (`data-theme="dark"`) and a premium "Liquid Gold" variant (`data-theme="gold"`) are defined but toggled via settings.

### Typography

- **Sans:** `Schibsted Grotesk` (400/500/600/700)
- **Mono:** `JetBrains Mono` (400/500)
- **Display:** `Playfair Display` for empty states and premium moments
- **Scale:** 12px caption → 14px body → 16px lead → 20px title → 24px headline → 32px display.

### Elevation & shape

- `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 20px`
- Shadows are warm and diffuse: `0 4px 12px rgba(33, 31, 26, 0.06), 0 1px 3px rgba(33, 31, 26, 0.04)`
- Hover lift: `translateY(-2px)` with slightly deeper shadow.

### Motion

- Easing: `[0.16, 1, 0.3, 1]` (expo-out) for enter/exit.
- Spring: `0.4s cubic-bezier(0.34, 1.56, 0.64, 1)` for interactive feedback.
- Reduced-motion query is respected everywhere.

## 3. Information architecture

### Primary navigation

- **Console** — chat, sessions, slash commands
- **Status** — live mesh topology, nodes, queues, costs
- **Tasks** — kanban of running/reviewable/done workflows
- **Approvals** — human-in-the-loop inbox with model agreement
- **Briefings** — daily/weekly intelligence summaries
- **Meetings** — transcripts, action items, follow-ups
- **Emails** — generated/reviewed correspondence

### Secondary navigation

- **Knowledge** — RAG sources, documents, screenshots
- **Second brain / Capture** — quick notes with `[[wiki-links]]`; idea graph
- **Memory** — time machine, checkpoints, diff viewer
- **Governance** — audit log, policies, privacy rules
- **Cost** — burn rate, budget, per-task cost
- **Connectors** — integrations and platform skills
- **Routines** — automations and cron workflows
- **Skills** — skill hub + builder + marketplace
- **Settings** — nodes, models, appearance, account

### Platform skills (under Connectors or Skills)

- **macOS Skills** — Shortcuts, AppleScript, Vision, Spotlight, Clipboard, AirDrop, Continuity
- **Linux Skills** — systemd, cron, dbus, bash, file watchers, package managers
- **Windows Skills** — PowerShell, WinRT, WSL, Task Scheduler, COM, UWP bridges
- **Hermes Skills** — ACP runtime, MCP tool merging, cross-agent orchestration

## 4. Global shell

A persistent shell wraps every authenticated page:

1. **Left sidebar** — 240px expanded, 64px collapsed. Groups nav items with `layoutId` active indicator. Footer shows privacy tier and connection status.
2. **Top bar** — Logo, page title, ⌘K command palette trigger, offline indicator, cost chip, HALT button, user avatar.
3. **Main stage** — page content with `AnimatePresence` transitions.
4. **Footer** — version, active tier pill, connection status.
5. **Command palette** — ⌘K searchable commands across pages, skills, and actions.
6. **Toast stack** — bottom-right for async feedback.

## 5. Page-level design notes

### Console
- Conversation sidebar with pinned / today / older grouping.
- Message bubbles with trust badges, rationale expander, cost footer.
- Slash command menu (`/`) grouped by Skills, Connectors, Actions.
- Glassmorphic composer with attach, mic, camera, animated send.

### Status
- Animated topology canvas (laptop, desktop, cloud, phone nodes).
- Flowing connection lines with traveling pulse dots.
- Node cards: health dot, CPU/RAM bars, tier badge, cost.
- Active jobs list with tier-colored progress bars.

### Tasks
- Kanban columns: Queued / Running / Needs Attention / Done.
- Cards show type, tier badge, cost estimate, model agreement.
- Drag-to-move between columns triggers review/apply workflow steps.

### Approvals
- Inbox with All / Pending / Delegated / History tabs.
- PIN gate for sensitive approvals.
- Model agreement view, blast-radius preview, audit timeline.

### Briefings
- Cards for daily/weekly/important briefings.
- Each briefing shows source count, tier mix, confidence, actions.
- One-tap actions: send to email, schedule meeting, create task.
- Live data: aggregated from recent tasks, knowledge, and notifications.

### Second brain / Capture
- One-box quick-capture input (console or dedicated page).
- Notes support `[[wiki-links]]` that auto-create linked note stubs and graph edges.
- Note cards show title, tier badge, tags, linked-note count, and timestamp.
- Graph view: force-directed idea graph with selected-note focus.
- Search filters: tag, tier, date, link depth.

### Meetings
- List of upcoming/past meetings.
- Transcript view with speaker diarization.
- Action items extracted into tasks.
- Privacy tier per meeting (local recording vs cloud transcript).

### Emails
- Inbox-style list of generated/reviewed emails.
- Compose assistant with tone selector.
- Review badge: human-approved, model-drafted, pending review.

### Skills
- Grid of installed skills with icon, version, tier, author.
- "New Skill" button opens builder.
- Marketplace tab for discoverable skills.

### Skill Builder
- Visual blocks: triggers → actions → outputs.
- Code editor for advanced users (TypeScript/Python).
- Test panel with sample inputs and live output.
- Publish flow with tier selection and review policy.

### Platform skill pages (macOS / Linux / Windows)
- Hero with platform-specific color accent.
- Capability cards: what the platform skill can do.
- Toggle per capability (enabled/disabled).
- Example prompts for each capability.
- Permission matrix: which tier each capability runs at.

## 6. Components to build

1. `Sidebar` — collapsible, groups, active indicator
2. `TopBar` — title, search, cost chip, HALT, user
3. `Footer` — version, tier, connection status
4. `CommandPalette` — ⌘K search
5. `TierBadge` — T0/T1/T2 with tooltip
6. `TrustBadge` — model + confidence
7. `CostChip` — daily burn / per-action cost
8. `HaltButton` — emergency stop with breathing glow
9. `PageHeader` — title + breadcrumbs + actions
10. `EmptyState` — consistent illustration + CTA
11. `Card` — surface with hover lift
12. `DataTable` — sortable, filterable, row actions
13. `KanbanBoard` — task columns
14. `ChatComposer` — glassmorphic input
15. `MessageBubble` — with trust/cost meta
16. `ApprovalCard` — countdown, blast radius, actions
17. `BriefingCard` — summary + actions
18. `MeetingRow` — transcript + action items
19. `EmailRow` — status + tone + review
20. `SkillCard` — icon, version, tier, author
21. `SkillBuilder` — visual + code modes
22. `PlatformCapabilityGrid` — macOS/Linux/Windows

## 7. Prompts I need from you

Tell me which of these you want me to design in pixel/detail next. I can expand any section into annotated mockups, component specs, or API contracts:

1. **Console chat experience** — exact message bubble anatomy, slash command menu, composer behavior.
2. **Status topology animation** — node states, connection lines, interaction model.
3. **Approvals flow** — PIN gate, model agreement UI, blast-radius visualization.
4. **Briefings / Meetings / Emails** — list views, detail panels, action menus.
5. **Skill builder** — visual block editor vs code editor, publish flow.
6. **Platform skill pages** — macOS, Linux, Windows capability cards and permission matrix.
7. **Dark mode / Liquid Gold theme** — full token swap and premium surfaces.
8. **Mobile / responsive behavior** — bottom nav, sheet dialogs, touch targets.

Send me the numbers or a free-form prompt and I’ll generate the next design deliverable.
