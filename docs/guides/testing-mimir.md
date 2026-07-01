# Manual QA Checklist

This guide is the single place to verify that every user-facing surface of Mimir works as intended. Run it before any release, big refactor, or infrastructure change.

## Prerequisites

```bash
# 1. Infrastructure
pnpm exec docker compose -f infra/docker-compose.yml up -d

# 2. Install deps
make install   # or: pnpm install

# 3. Build all deployable artifacts
pnpm build

# 4. Start API + worker + web
pnpm dev
# Or in separate terminals:
#   pnpm --filter @mimir/api dev
#   pnpm --filter @mimir/api worker
#   pnpm --filter @mimir/web dev
```

Default URLs:

- Web app: `http://localhost:3000`
- API: `http://localhost:3001`
- Temporal UI: `http://localhost:8080`

For local test mode you can use the bearer token `test` with `Authorization: Bearer test`.

---

## Web UI

Open `http://localhost:3000` and sign in (local test mode sets the session cookie automatically).

### Console / chat (`/`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Type a prompt and click **Send**. | Your message appears; an assistant reply arrives within ~30 s. |
| 2 | Open the **Session** switcher and click **New session**. | A new empty session loads. |
| 3 | Send a message in the new session, open a second browser tab to `/`, and resume that session. | The same conversation appears on both tabs. |
| 4 | Select a different **Role / Model** from the dropdown and send a message. | The request is routed to the selected provider/model. |
| 5 | Attach a file via the **Attachments** button and send. | The attachment is referenced in the task payload. |
| 6 | Trigger an action that requires approval (e.g., a sandbox action if configured). | An approval card appears in the chat; approve/deny works. |
| 7 | Click **Show steps** / **Advanced**. | Step details and advanced controls are visible. |

### Status (`/status`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/status`. | Mesh health summary, node cards, queue chart, and cost widget render. |
| 2 | Enroll a node (see CLI/mesh section) and send a heartbeat. | The node card shows `up` and `last seen` updates. |
| 3 | Click a node card. | Detailed node info / topology is visible. |

### Tasks (`/tasks`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a task from the console or API. | The task card appears on the board. |
| 2 | Drag a task from one column to another. | The task status updates and persists after refresh. |
| 3 | Inspect a task card. | Model, tier, blast radius, and cost are shown. |

### Approvals (`/approvals`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a task that matches a policy with `effect: require_approval`. | A pending approval card appears. |
| 2 | Click **Approve**, enter PIN `1234` (default test user), and confirm. | Card leaves **Pending**, appears under **Approved**. |
| 3 | Repeat with **Deny**. | Card leaves **Pending**, appears under **Denied**. |
| 4 | Check the **Blast radius** panel on a card. | Tier, action, and summary are visible. |

### Connectors (`/connectors`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/connectors`. | Cards for Gmail, GitHub, Discord, Airtable, etc., are visible. |
| 2 | Click category buttons (Dev, Productivity, etc.). | Only matching connectors are shown. |
| 3 | Type in the **Search connectors** box. | Results narrow to matching names/descriptions. |
| 4 | For GitHub, fill the token input and click **Connect**. | Status changes to **Connected**. |
| 5 | Click **Disconnect**. | Status returns to **Disconnected**. |
| 6 | For connectors with a **Test** button, fill secrets and click **Test**. | Success/error state is shown. |

### Tools (`/tools`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Fill **Name**, **Description**, select action `github.listRepos`, add a `perPage` number field, and click **Create tool**. | A tool card appears in the list. |
| 2 | Click **Run** on the tool card. | If no connector is configured, an error like `Connector not found` is surfaced. |
| 3 | Configure the GitHub connector and run again. | The tool returns a list of repositories. |

### Workflows (`/workflows`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click **Generate from description**, enter a simple workflow, and save. | A workflow card appears. |
| 2 | Click **Import n8n** and paste a valid n8n JSON workflow. | The workflow is imported and listed. |
| 3 | Assign the workflow to a node. | The assignment is reflected on the card. |

### Workflow editor (`/workflow-editor`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/workflow-editor`. | The visual node canvas renders. |
| 2 | Drag nodes, connect them, and save. | The canvas state updates without errors. |

### Governance (`/governance`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open the **Policy** tab, edit the YAML, and click **Validate**. | The validation badge shows valid/invalid. |
| 2 | Enter invalid YAML. | An error badge appears with details. |
| 3 | Switch to **Natural language**, type a rule, and click **Translate**. | A YAML draft is generated. |
| 4 | Click **Save policy**. | The policy persists after refresh. |
| 5 | Open the **Audit log** tab. | A hash-chain table is rendered. |
| 6 | Click **Verify chain**. | Verification status refreshes. |
| 7 | Open the **Privacy flow map** tab. | The tier/policy flow diagram renders. |

### Cost (`/cost`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/cost`. | Summary cards, daily spend chart, tier chart, and transaction table render. |
| 2 | Run a few tasks and refresh. | Spend and transaction rows update. |
| 3 | Click the **HALT** button in the top bar. | The system enters emergency halt (verify via `/healthz`). |
| 4 | Resume from the Halt page or by clicking **Resume**. | Normal operation resumes. |

### Knowledge (`/knowledge`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/knowledge`. | Existing documents are listed with screenshots. |
| 2 | Click tabs to filter by kind. | Only the selected kind is shown. |
| 3 | Type in the search box. | Results narrow. |
| 4 | Click a screenshot. | A lightbox opens. |
| 5 | Use the browser extension to capture a page (see Extension section). | The captured note appears under Knowledge. |

### Memory (`/memory`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/memory`. | The time machine view loads. |
| 2 | Hover or select a checkpoint. | A diff view updates. |
| 3 | Switch to **Graph memory**. | The graph visualization renders. |
| 4 | Click **Rewind**, **Restore**, or **Branch** on a checkpoint. | The action completes and the view updates. |

### Marketing (`/marketing`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a **Brand voice**. | It appears in the list. |
| 2 | Create a **Campaign**. | The campaign card is visible. |
| 3 | Add a **Calendar** item. | It appears on the calendar. |
| 4 | Click **Generate draft**. | A draft is produced for the selected campaign/voice. |

### Reports (`/reports`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/reports`. | Report cards and usage insights render. |
| 2 | Use kind filters. | Only matching reports are shown. |
| 3 | Search. | Results narrow. |
| 4 | Click **Generate** on a report card. | A report is generated; download is disabled until complete. |

### Routines (`/routines`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/routines`. | Existing routines are listed. |
| 2 | Use trigger filters. | Only matching routines are shown. |
| 3 | Toggle the **Enable** switch. | Routine status updates. |
| 4 | Click **Run now**. | Last run text updates. |

### Scheduling (`/scheduling`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/scheduling`. | Tabs for Projects, Resources, Assignments, Utilization are visible. |
| 2 | Create a project, a resource, and an assignment. | Each appears in its tab and utilization updates. |

### Life admin (`/life-admin`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a one-time item. | It appears in the list. |
| 2 | Mark it done. | It moves to the completed state. |
| 3 | Create a recurring item and mark it done. | A next occurrence is spawned. |

### Screen time (`/screen-time`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Log a screen-time entry. | The entry appears in the list. |

### Meetings (`/meetings`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a meeting with title/time. | A meeting card appears. |
| 2 | Click **Generate prep draft**. | A draft is produced. |

### Notifications (`/notifications`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/notifications`. | Notifications are listed. |
| 2 | Switch between **All** and **Unread**. | Filtering works. |
| 3 | Click **Mark read**. | The unread indicator disappears and the bell badge updates. |

### Settings (`/settings`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Switch between settings tabs. | The correct panel loads. |
| 2 | On the **Security** tab, set/change a PIN. | PIN status updates. |
| 3 | On the **Settings** main tab, click **Regenerate key**. | A new API key is shown. |
| 4 | Toggle a notification setting. | The toggle state persists. |
| 5 | Open **Members**. | Workspace members are listed. |
| 6 | Open **Nodes**. | Enrolled mesh nodes are listed. |
| 7 | Open **Budget** and save limits. | Limits persist. |
| 8 | Open **Local models** and save config. | Config is saved and Ollama probe runs. |

### Encrypted chat (`/chat`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/chat`. | Channel list renders. |
| 2 | Create a channel and send a message. | The message is visible and encrypted. |

### Marketplace (`/marketplace`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/marketplace`. | Listing cards render. |
| 2 | Use kind filters. | Only matching listings are shown. |
| 3 | Search. | Results narrow. |
| 4 | Click **Install** on a listing. | The button toggles to installed. |

### Personal modules (`/modules/finance`, `/modules/nutrition`, etc.)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a module page. | The form and empty state render. |
| 2 | Create an item. | It appears in the list. |
| 3 | Mark it done. | Status updates. |

### Accessibility (`/accessibility`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/accessibility`. | Controls and preview render. |
| 2 | Type text in the input. | Simplified text and preview update. |
| 3 | Click font size buttons. | The displayed size changes. |

### Values & decisions (`/values`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a value. | It appears in the list. |
| 2 | Log a decision linked to that value. | The decision appears in the journal. |

### Agent reputation (`/agents/reputation`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/agents/reputation`. | The reputation table loads with an empty state if no data. |

### Model leaderboard (`/model-leaderboard`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/model-leaderboard`. | The leaderboard table renders. |

### Voice (`/voice`)

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open `/voice`. | The voice companion page loads. |

### Theme toggle

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click the theme button in the top bar and cycle Light → Dark → Liquid Gold. | The UI theme updates for each selection. |

---

## CLI

Install/run the CLI from the built artifact:

```bash
pnpm --filter @mimir/cli build
node packages/cli/dist/cli.js --help
```

### Authentication

| # | Command | Expected result |
|---|---------|-----------------|
| 1 | `mimir login --api-url http://localhost:3001 --api-key <key>` | `Saved Mimir configuration for http://localhost:3001` |
| 2 | `mimir status` | JSON health status from `/healthz`. |

### Tasks

| # | Command | Expected result |
|---|---------|-----------------|
| 1 | `mimir tasks create --type chat --prompt "hello cli"` | Task created with job id and status. |
| 2 | `mimir tasks list` | Table of recent tasks. |
| 3 | `mimir tasks list --status running` | Only running tasks (or empty). |
| 4 | `mimir tasks get <jobId>` | Full task JSON. |

### Mesh nodes

| # | Command | Expected result |
|---|---------|-----------------|
| 1 | `mimir nodes list` | Table of enrolled nodes. |
| 2 | `mimir nodes heartbeat <nodeId>` | Heartbeat acknowledged with timestamp. |

---

## Browser extension

Follow the install steps in [`browser-extension-quick-capture.md`](./browser-extension-quick-capture.md), then run this mini-checklist:

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Build: `pnpm --filter @mimir/extension build` | `apps/extension/dist/` contains `manifest.json`, `background.js`, `content.js`, `options.html`. |
| 2 | Load unpacked `apps/extension/dist/` in Chrome/Edge. | Extension icon appears. |
| 3 | Open extension **Options**, set API URL to `http://localhost:3001`, save. | Options save without error. |
| 4 | Click the toolbar icon on any page. | Green checkmark badge appears; capture lands in `/knowledge`. |
| 5 | Select text, right-click, choose **Capture selection to Mimir**. | Selection capture lands in `/knowledge`. |
| 6 | Press `Ctrl+Shift+M` / `Cmd+Shift+M`. | Current page is captured. |

---

## API / direct integration

These curls use the local test bearer token. Replace with a real Supertokens session token in production.

### Health

```bash
curl http://localhost:3001/livez
curl http://localhost:3001/readyz
curl http://localhost:3001/healthz
```

### Tasks

```bash
# Create a task
curl -s -X POST http://localhost:3001/v1/tasks \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"manual-1","type":"chat","prompt":"hello"}' | jq .

# List tasks
curl -s http://localhost:3001/v1/tasks \
  -H "Authorization: Bearer test" | jq .
```

### Approvals

```bash
# Set a policy that requires approval
curl -s -X PUT http://localhost:3001/v1/governance/policy \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"source":"rules:\n  - effect: require_approval\n    action: chat\n"}'

# Create a chat task → should return 202 + approvalId
curl -s -X POST http://localhost:3001/v1/tasks \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"manual-approval-1","type":"chat","prompt":"approve me"}' | jq .

# Approve it (PIN is optional when no PIN is set)
curl -s -X POST http://localhost:3001/v1/approvals/<approvalId>/approve \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}' | jq .
```

### Nodes

```bash
# Enroll a node via helper script
./scripts/enroll-node.sh

# Send a heartbeat
curl -s -X POST http://localhost:3001/health/nodes/<nodeId>/heartbeat \
  -H "Authorization: Bearer mimir_<key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"up"}' | jq .
```

### Connectors

```bash
# Store a secret
curl -s -X POST http://localhost:3001/v1/secrets/github \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"value":"ghp_..."}'

# Create connector
curl -s -X POST http://localhost:3001/v1/connectors \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"kind":"github","secretRef":"github","scopes":["repo"]}' | jq .

# Test connector
curl -s -X POST http://localhost:3001/v1/connectors/github/test \
  -H "Authorization: Bearer test" | jq .
```

---

## Mesh / node scripts

| # | Script | Expected result |
|---|--------|-----------------|
| 1 | `./scripts/enroll-node.sh` | Creates `mimir-node.yaml` with `nodeId` + `apiKey`. |
| 2 | `./scripts/heartbeat.sh up` | Returns HTTP 200 and updates node `last_seen`. |
| 3 | `./scripts/agent-install.sh` | Installs the heartbeat helper (review output for your platform). |
| 4 | `./scripts/ssh-ca-init.sh` | Initializes SSH CA if configured (run with care). |

---

## Smoke regression

Run these commands in sequence as a final gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm test:acl
bash scripts/check-contract-drift.sh
```

All must pass before merging to `main`.

---

## Notes

- **New feature?** Add a row to the relevant section above and an E2E test under `tests/e2e/specs/`.
- **New surface?** Add a new top-level section (e.g., "Mobile app", "Electron app") with its own prerequisite and checklist.
- Keep this document in sync with the code: if a page URL, CLI command, or API payload changes, update this checklist in the same PR.
