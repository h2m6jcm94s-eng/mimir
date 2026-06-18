#!/usr/bin/env bash
set -euo pipefail

# Enroll a new mesh node and write a local config file.
# Usage:
#   MIMIR_API_URL=http://localhost:3001 \
#   MIMIR_AUTH_COOKIE='sAccessToken=...; sRefreshToken=...' \
#     ./scripts/enroll-node.sh
#
# For local test mode you can also use:
#   MIMIR_API_TOKEN=test-user ./scripts/enroll-node.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${MIMIR_API_URL:-http://localhost:3001}"
AUTH_COOKIE="${MIMIR_AUTH_COOKIE:-}"
API_TOKEN="${MIMIR_API_TOKEN:-}"

if [[ -z "${AUTH_COOKIE}" && -z "${API_TOKEN}" ]]; then
  echo "Error: set MIMIR_AUTH_COOKIE (Supertokens session) or MIMIR_API_TOKEN (test bypass)." >&2
  exit 1
fi

read -rp "Node name: " NODE_NAME
read -rp "Node kind (brain/desktop/cloud/phone) [desktop]: " NODE_KIND
NODE_KIND="${NODE_KIND:-desktop}"
read -rp "Privacy tier (0/1/2) [1]: " TIER
TIER="${TIER:-1}"
read -rp "Tailscale address (optional): " TAILNET_ADDR

PAYLOAD="{\"name\":\"${NODE_NAME}\",\"kind\":\"${NODE_KIND}\",\"tier\":${TIER}"
if [[ -n "${TAILNET_ADDR}" ]]; then
  PAYLOAD="${PAYLOAD},\"tailnetAddr\":\"${TAILNET_ADDR}\""
fi
PAYLOAD="${PAYLOAD}}"

CURL_HEADERS=(-H 'content-type: application/json')
if [[ -n "${API_TOKEN}" ]]; then
  CURL_HEADERS+=(-H "Authorization: Bearer ${API_TOKEN}")
elif [[ -n "${AUTH_COOKIE}" ]]; then
  CURL_HEADERS+=(--cookie "${AUTH_COOKIE}")
fi

RESPONSE="$(curl -fsS "${CURL_HEADERS[@]}" -X POST "${API_URL}/v1/nodes/enroll" -d "${PAYLOAD}")"
NODE_ID="$(echo "${RESPONSE}" | jq -r '.id')"
API_KEY="$(echo "${RESPONSE}" | jq -r '.apiKey')"

if [[ "${NODE_ID}" == "null" || -z "${NODE_ID}" ]]; then
  echo "Enrollment failed: ${RESPONSE}" >&2
  exit 1
fi

CONFIG_FILE="${PWD}/mimir-node.yaml"
cat > "${CONFIG_FILE}" <<EOF
apiUrl: ${API_URL}
nodeId: ${NODE_ID}
apiKey: ${API_KEY}
tailnetAddr: ${TAILNET_ADDR}
EOF

echo "Enrolled node ${NODE_ID} as ${NODE_KIND}."
echo "Config written to ${CONFIG_FILE}."
echo "Keep the API key secret — it is shown only once."
