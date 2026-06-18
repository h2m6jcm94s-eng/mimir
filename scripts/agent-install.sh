#!/usr/bin/env bash
set -euo pipefail

# Idempotent installer for a minimal Mimir node agent.
# In a real deployment this would install a compiled binary or Python service.
# For pilots it copies the heartbeat helper and prints a systemd/launchd example.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/mimir-node}"
mkdir -p "${INSTALL_DIR}/bin"

cp "${SCRIPT_DIR}/heartbeat.sh" "${INSTALL_DIR}/bin/mimir-heartbeat"
chmod +x "${INSTALL_DIR}/bin/mimir-heartbeat"

echo "Installed node agent helpers to ${INSTALL_DIR}/bin"
echo ""
echo "Add to your shell PATH, then run:"
echo "  mimir-heartbeat"
echo ""
echo "Example systemd unit (save to ~/.config/systemd/user/mimir-node.service):"
cat <<EOF
[Unit]
Description=Mimir node heartbeat
After=network.target

[Service]
Type=oneshot
ExecStart=${INSTALL_DIR}/bin/mimir-heartbeat
EOF

echo ""
echo "Then enable a timer to run it every minute:"
echo "  systemctl --user enable --now mimir-node.timer"
