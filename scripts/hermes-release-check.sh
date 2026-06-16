#!/usr/bin/env bash
# Check whether the local Hermes reference clone has moved past the recorded baseline.
# This script NEVER copies Hermes code into the Mimir repo.
# It only reads commit/tag metadata from ~/.hermes/hermes-agent or the GitHub API.

set -euo pipefail

BASELINE_FILE="${BASELINE_FILE:-docs/references/hermes-baseline.md}"
HERMES_DIR="${HERMES_DIR:-$HOME/.hermes/hermes-agent}"
HERMES_REPO_URL="${HERMES_REPO_URL:-https://github.com/nousresearch/hermes-agent}"

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "ERROR: baseline file not found: $BASELINE_FILE"
  echo "Create it first and record the current Hermes commit/tag."
  exit 1
fi

# Extract baseline tag/commit from the baseline file (first code-ish line after "Baseline:").
BASELINE_TAG=$(grep -E '^[[:space:]]*-?[[:space:]]*(Baseline|Tag|Commit):' "$BASELINE_FILE" | head -1 | sed -E 's/.*:\s*//' | tr -d '[:space:]')

if [[ -z "$BASELINE_TAG" ]]; then
  echo "ERROR: could not parse baseline tag/commit from $BASELINE_FILE"
  exit 1
fi

LATEST_TAG=""
LATEST_COMMIT=""

if [[ -d "$HERMES_DIR/.git" ]]; then
  LATEST_TAG=$(git -C "$HERMES_DIR" describe --tags --abbrev=0 2>/dev/null || echo "")
  LATEST_COMMIT=$(git -C "$HERMES_DIR" rev-parse HEAD 2>/dev/null || echo "")
else
  echo "INFO: local Hermes clone not found at $HERMES_DIR"
  echo "      Fetching latest release metadata from GitHub API (read-only, no code download)."
  RELEASE_JSON=$(curl -sL "${HERMES_REPO_URL/https:\/\/github.com/https:\/\/api.github.com/repos}/releases/latest" || true)
  LATEST_TAG=$(echo "$RELEASE_JSON" | grep -o '"tag_name": "[^"]*"' | head -1 | cut -d'"' -f4 || true)
  LATEST_COMMIT=$(echo "$RELEASE_JSON" | grep -o '"target_commitish": "[^"]*"' | head -1 | cut -d'"' -f4 || true)
fi

if [[ -z "$LATEST_TAG" && -z "$LATEST_COMMIT" ]]; then
  echo "ERROR: could not determine latest Hermes tag/commit."
  exit 1
fi

echo "Hermes baseline: $BASELINE_TAG"
echo "Hermes latest:   ${LATEST_TAG:-unknown} (${LATEST_COMMIT:-unknown})"

if [[ "$LATEST_TAG" == "$BASELINE_TAG" || "$LATEST_COMMIT" == "$BASELINE_TAG" ]]; then
  echo "OK: Mimir is up to date with the tracked Hermes baseline."
  exit 0
fi

echo "NOTICE: Hermes has moved past the Mimir baseline."
echo "        Open a triage issue: upstream/hermes-$(date +%Y-%m-%d)"
echo "        Do NOT copy Hermes code into the Mimir repo."
exit 2
