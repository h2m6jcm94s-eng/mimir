# Tailnet setup

Mimir uses Tailscale for zero-config mesh networking between nodes.

## Roles (tags)

- `tag:brain` — the always-on coordinator (API + web).
- `tag:desktop` — a workstation that can run heavy jobs.
- `tag:phone` — a mobile control device.
- `tag:cloud` — an air-gapped, single-use cloud worker.
- `tag:control` — human operators (phone/browser).

## Apply the ACL

The ACL is in `infra/tailscale/acl.hujson`.

1. Open your Tailscale admin console → Access controls.
2. Paste the contents of `acl.hujson`.
3. Save and test.

## Key rules

- `tag:control` can reach `tag:brain:3001` only.
- `tag:brain` can coordinate with other `tag:brain`, `tag:desktop`, and `tag:phone` nodes.
- `tag:cloud` can only reach itself (`tag:cloud:*`) — it cannot touch the private mesh.
- SSH is restricted to `group:admins` → `tag:brain/desktop/phone` as `root` or `mimir`.

## Enroll a node

Use the enrollment helper on the new node:

```bash
./scripts/enroll-node.sh --kind desktop --name "dev-laptop"
```

This writes `mimir-node.yaml` and joins the tailnet with the right tag.

## Ephemeral SSH CA

Generate signing keys:

```bash
./scripts/ssh-ca-init.sh
```

Store the resulting `data/ssh-ca/` keys securely; they are used to issue short-lived host and user certificates during node enrollment.
