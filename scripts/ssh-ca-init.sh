#!/usr/bin/env bash
set -euo pipefail

# Initialize an ephemeral SSH CA for Mimir nodes.
# Generates two CA key pairs (user and host), stores the private keys with
# restrictive permissions, and prints the public keys + environment variables.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATA_DIR="${PROJECT_ROOT}/data/ssh-ca"

mkdir -p "${DATA_DIR}"
chmod 700 "${DATA_DIR}"

for TYPE in user host; do
  KEY_PATH="${DATA_DIR}/ssh-ca-${TYPE}"
  if [[ -f "${KEY_PATH}" ]]; then
    echo "SSH CA ${TYPE} key already exists at ${KEY_PATH}; skipping generation."
  else
    ssh-keygen -t ed25519 -f "${KEY_PATH}" -N '' -C "mimir-${TYPE}-ca"
    chmod 600 "${KEY_PATH}"
    chmod 644 "${KEY_PATH}.pub"
  fi
  echo ""
  echo "SSH CA ${TYPE} public key:"
  cat "${KEY_PATH}.pub"
done

echo ""
echo "Set the following environment variables (or store the private keys in your vault):"
echo "  SSH_CA_USER_PRIVATE_KEY_FILE=${DATA_DIR}/ssh-ca-user"
echo "  SSH_CA_HOST_PRIVATE_KEY_FILE=${DATA_DIR}/ssh-ca-host"
