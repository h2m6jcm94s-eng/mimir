# Mimir secrets and encryption guide

## Overview

Mimir is secret-by-default in production:

- A vault backend is required in production (HashiCorp Vault or a file-encrypted vault).
- The embedded LibSQL replica must be encrypted in production.
- Backups are encrypted by default with `age`.
- The CLI can encrypt its config file with a passphrase.

Local development can still fall back to environment variables and unencrypted files.

## Vault aliases

The API resolves deployment secrets from the vault using these global aliases:

| Alias | Purpose |
|-------|---------|
| `model-provider:openai:api-key` | OpenAI API key |
| `model-provider:openai:base-url` | Optional OpenAI base URL override |
| `model-provider:kimi:api-key` | Kimi / Moonshot API key |
| `model-provider:kimi:base-url` | Optional Kimi base URL override |
| `model-provider:anthropic:api-key` | Anthropic API key |
| `model-provider:anthropic:base-url` | Optional Anthropic base URL override |
| `model-provider:groq:api-key` | Groq API key |
| `model-provider:groq:base-url` | Optional Groq base URL override |
| `model-provider:qwen:api-key` | Qwen API key |
| `model-provider:qwen:base-url` | Optional Qwen base URL override |
| `cloud-worker-secret` | HMAC secret for cloud-worker return tokens |
| `ssh-ca-user-private` | SSH CA private key for user certificates |
| `ssh-ca-host-private` | SSH CA private key for host certificates |

Tenant-scoped secrets use the alias pattern `tenant:<tenantId>:<alias>`.

## Configuring the vault

### HashiCorp Vault

```bash
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=s.xxx
VAULT_MOUNT=secret
```

### File-encrypted vault

```bash
VAULT_FILE_PATH=/etc/mimir/vault.json
VAULT_FILE_PASSPHRASE=$(cat /etc/mimir/vault.pass)
```

## LibSQL encryption

Set `LIBSQL_ENCRYPTION_KEY` to a strong 256-bit key (hex or raw string). The same
key must be available to every API/worker process that opens the embedded replica.

## Backups

```bash
# Encrypted (recommended everywhere)
AGE_RECIPIENT=age1... ./scripts/backup.sh

# Plaintext (local dev only)
BACKUP_UNENCRYPTED=1 ./scripts/backup.sh
```

Restore an encrypted backup:

```bash
AGE_IDENTITY=/path/to/age.key ./scripts/restore-test.sh
```

## SSH CA key rotation

```bash
AGE_RECIPIENT=age1... \
  SSH_CA_USER_PRIVATE_KEY_FILE=/etc/mimir/ssh-user-ca \
  SSH_CA_HOST_PRIVATE_KEY_FILE=/etc/mimir/ssh-host-ca \
  ./scripts/ssh-ca-rotate.sh
```

The script archives old keys, generates new ed25519 CA keys, optionally encrypts
the private keys with age, and prints the new fingerprints. After rotation,
update `SSH_CA_*_PRIVATE_KEY_FILE` to point at the new key (or `.age` file) and
restart the API.

## CLI config encryption

```bash
export MIMIR_CLI_PASSPHRASE=$(openssl rand -base64 32)
mimir login --api-url http://localhost:3001 --api-key mimir_...
```

The config file at `~/.config/mimir/config.json` will be encrypted. Without the
passphrase it cannot be read.
