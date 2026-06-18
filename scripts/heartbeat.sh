#!/usr/bin/env bash
set -euo pipefail

# Send a heartbeat for a node configured by mimir-node.yaml.
# Usage: ./scripts/heartbeat.sh [status]
#   status defaults to 'up'; can be 'up', 'degraded', or 'down'.

CONFIG_FILE="${MIMIR_NODE_CONFIG:-./mimir-node.yaml}"
if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Error: config file not found: ${CONFIG_FILE}" >&2
  exit 1
fi

API_URL="$(grep '^apiUrl:' "${CONFIG_FILE}" | awk '{print $2}')"
NODE_ID="$(grep '^nodeId:' "${CONFIG_FILE}" | awk '{print $2}')"
API_KEY="$(grep '^apiKey:' "${CONFIG_FILE}" | awk '{print $2}')"
STATUS="${1:-up}"

if [[ -z "${API_URL}" || -z "${NODE_ID}" || -z "${API_KEY}" ]]; then
  echo "Error: mimir-node.yaml must contain apiUrl, nodeId, and apiKey." >&2
  exit 1
fi

curl -fsS \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer ${API_KEY}" \
  -X POST "${API_URL}/health/nodes/${NODE_ID}/heartbeat" \
  -d "{\"status\":\"${STATUS}\"}"

echo "Heartbeat sent: ${STATUS}"
