#!/usr/bin/env bash
set -euo pipefail

# Rotate Mimir SSH CA keys.
#
# Generates new ed25519 CA keys for user and host certificates, archives the
# old keys with a timestamp, and optionally encrypts the new private keys with
# age. After rotation, update your environment or vault to point at the new
# private key (and .age file, if used) and restart the API.
#
# Usage:
#   SSH_CA_USER_PRIVATE_KEY_FILE=/etc/mimir/ssh-user-ca \
#   SSH_CA_HOST_PRIVATE_KEY_FILE=/etc/mimir/ssh-host-ca \
#   AGE_RECIPIENT=age1... \
#   ./scripts/ssh-ca-rotate.sh

USER_KEY="${SSH_CA_USER_PRIVATE_KEY_FILE:-${HOME}/.ssh/mimir-user-ca}"
HOST_KEY="${SSH_CA_HOST_PRIVATE_KEY_FILE:-${HOME}/.ssh/mimir-host-ca}"
AGE_RECIPIENT="${AGE_RECIPIENT:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if [ -n "${AGE_RECIPIENT}" ] && ! command -v age >/dev/null 2>&1; then
  echo '[ssh-ca-rotate] ERROR: age is required when AGE_RECIPIENT is set.' >&2
  exit 1
fi

rotate_key() {
  local type=$1
  local path=$2
  local dir
  dir=$(dirname "${path}")
  mkdir -p "${dir}"

  if [ -f "${path}" ]; then
    mv "${path}" "${path}.${TIMESTAMP}.old"
    echo "[ssh-ca-rotate] Archived existing ${type} CA key to ${path}.${TIMESTAMP}.old"
  fi
  if [ -f "${path}.pub" ]; then
    mv "${path}.pub" "${path}.pub.${TIMESTAMP}.old"
  fi
  if [ -f "${path}.age" ]; then
    mv "${path}.age" "${path}.age.${TIMESTAMP}.old"
  fi

  ssh-keygen -t ed25519 -f "${path}" -N '' -C "mimir-${type}-ca-${TIMESTAMP}"
  chmod 600 "${path}"
  chmod 644 "${path}.pub"

  if [ -n "${AGE_RECIPIENT}" ]; then
    age -r "${AGE_RECIPIENT}" -o "${path}.age" "${path}"
    rm "${path}"
    chmod 600 "${path}.age"
    echo "[ssh-ca-rotate] Encrypted ${type} CA private key: ${path}.age"
  fi

  echo "[ssh-ca-rotate] New ${type} CA fingerprint:"
  ssh-keygen -lf "${path}.pub"
}

rotate_key user "${USER_KEY}"
rotate_key host "${HOST_KEY}"

echo '[ssh-ca-rotate] Done.'
echo '[ssh-ca-rotate] Next steps:'
echo "  1. Update SSH_CA_USER_PRIVATE_KEY_FILE${AGE_RECIPIENT:+.age} and SSH_CA_HOST_PRIVATE_KEY_FILE${AGE_RECIPIENT:+.age} in your environment or vault."
echo '  2. Re-sign any long-lived host certificates with the new host CA.'
echo '  3. Distribute the new user CA public key to authorized_principals/authorized_keys where needed.'
