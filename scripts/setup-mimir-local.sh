#!/usr/bin/env bash
set -euo pipefail

# Setup script for the Mimir-branded local model.
# Requires Ollama to be installed and running (default: http://localhost:11434).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODelfile="${PROJECT_ROOT}/models/mimir-local/Modelfile"
BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Download it from https://ollama.com/download"
  exit 1
fi

if ! curl -fsS "${BASE_URL}/api/tags" >/dev/null 2>&1; then
  echo "Ollama is not reachable at ${BASE_URL}. Start it with: ollama serve"
  exit 1
fi

echo "Pulling base weights for Mimir Local (qwen3:8b)..."
ollama -v pull qwen3:8b

echo "Creating mimir-local model from ${MODelfile}..."
ollama create mimir-local -f "${MODelfile}"

echo "Verifying mimir-local..."
ollama run mimir-local "Say hello as Mimir" --nowordwrap

echo "Mimir Local is ready. Set your chat model to 'mimir-local' in Settings -> Mimir Local."
