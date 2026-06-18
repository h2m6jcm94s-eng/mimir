# Multi-Device Pilot Guide

This guide walks through connecting a second machine to your Mimir mesh. The fastest path is a local desktop or laptop on the same LAN/Tailnet; phone and bot-gateway paths are covered at the end.

## What you need

- A running Mimir API (`apps/api`) with at least one user enrolled.
- The new device can reach the API (same LAN or Tailnet).
- `curl` and `jq` installed on the new device.
- A Supertokens session cookie **or** test-mode API token for enrollment.

## Concepts

- **Node** — a machine in the mesh (`brain`, `desktop`, `cloud`, `phone`).
- **API key** — a per-node secret (`mimir_...`) returned once at enrollment; it authenticates heartbeats.
- **Tailnet address** — optional; used by the mesh for zero-trust routing.
- **Heartbeat** — a periodic `POST /health/nodes/:nodeId/heartbeat` that updates the node's status and `last_seen`.

## Step-by-step: connect a local second machine

### 1. Prepare the API environment

Ensure the API is running and you know its URL:

```bash
export MIMIR_API_URL=http://localhost:3001
```

For local test mode you can use the bypass token:

```bash
export MIMIR_API_TOKEN=test-user
```

For a real Supertokens session, copy the session cookies from your browser and export them:

```bash
export MIMIR_AUTH_COOKIE='sAccessToken=...; sRefreshToken=...'
```

### 2. Enroll the new node

On the new device, run the enrollment script from the repo:

```bash
cd /path/to/mimir
./scripts/enroll-node.sh
```

It will ask for a name, kind (`desktop`), tier (`1`), and optional Tailscale address. It writes `mimir-node.yaml` in the current directory:

```yaml
apiUrl: http://localhost:3001
nodeId: <uuid>
apiKey: mimir_<secret>
tailnetAddr: <optional>
```

> The API key is shown only once. If you lose it, rotate it from the web UI or via `POST /v1/nodes/:id/rotate-key`.

### 3. Verify the node appears

In the web app, open **Status** (`/status`) or call:

```bash
curl -H "Authorization: Bearer <user-token>" \
  "$MIMIR_API_URL/v1/nodes"
```

You should see the new node with status `up`.

### 4. Start heartbeating

From the new device:

```bash
./scripts/heartbeat.sh up
```

Run it every 60 seconds. A minimal cron entry:

```cron
* * * * * /path/to/mimir/scripts/heartbeat.sh up
```

Or install the helper as a systemd/launchd service:

```bash
./scripts/agent-install.sh
```

### 5. Confirm health

Call the lightweight ping endpoint as the owner:

```bash
curl -H "Authorization: Bearer <user-token>" \
  "$MIMIR_API_URL/v1/nodes/<nodeId>/ping"
```

## Node key rotation

If a key is leaked, rotate it immediately:

```bash
curl -H "Authorization: Bearer <user-token>" \
  -X POST "$MIMIR_API_URL/v1/nodes/<nodeId>/rotate-key"
```

Update `mimir-node.yaml` with the new key.

## Phone / Expo path (future)

For a mobile companion:

1. Build an Expo/React Native app that stores `nodeId` + `apiKey` securely (Keychain/Keystore).
2. Heartbeat to `/health/nodes/:nodeId/heartbeat` over Tailnet or the LAN.
3. Use the same chat/session APIs as the web app, authenticated by the user's Supertokens session for UI actions and the node API key for background keepalive.

Keep mobile nodes at tier `phone` and route sensitive (T0) jobs away from them.

## Bot-gateway path (future)

Mimir already has connectors for Telegram, Discord, and Slack. To let any device chat through a bot:

1. Configure the connector in **Settings > Connectors**.
2. Map incoming bot messages to a session using the user's external identity.
3. Keep bot interactions tier-aware: do not expose T0 data through cloud-hosted bots.

## Security checklist

- [ ] API keys are stored with file permissions `600`.
- [ ] Heartbeat uses `/health/nodes/...` with the node key, not the user's session cookie.
- [ ] Tailscale ACLs default-deny; only required ports are open.
- [ ] Cloud workers use the air-gapped flow (`POST /v1/cloud-workers`) instead of joining the tailnet.
- [ ] Keys are rotated after any suspected leak.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Missing node API key` | heartbeat missing Bearer | check `mimir-node.yaml` |
| `401 Invalid node API key` | key mismatch or node ID mismatch | re-enroll or rotate key |
| Node shows `down` | heartbeat not running | start cron/systemd timer |
| Cannot reach API | firewall/Tailnet issue | verify `MIMIR_API_URL` is reachable from the node |
