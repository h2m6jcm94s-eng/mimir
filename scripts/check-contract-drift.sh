#!/usr/bin/env bash
set -euo pipefail

# Contract drift check (R-20): TS client and Python Pydantic models must both
# be generated from the same apps/api/openapi.json source of truth.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Regenerating OpenAPI spec"
cd apps/api
pnpm exec tsx src/scripts/generate-openapi.ts
cd "$ROOT_DIR"

echo "==> Regenerating TypeScript contracts"
cd packages/contracts
pnpm generate
cd "$ROOT_DIR"

echo "==> Regenerating Python Pydantic models"
uv run python scripts/generate-python-contracts.py

echo "==> Checking for drift"
if ! git diff --quiet -- apps/api/openapi.json packages/contracts services/shared/src/mimir_shared/generated_models.py; then
  echo "ERROR: Contract drift detected. Run the following and commit the result:"
  echo "  cd apps/api && pnpm exec tsx src/scripts/generate-openapi.ts"
  echo "  cd packages/contracts && pnpm generate"
  echo "  uv run python scripts/generate-python-contracts.py"
  git diff -- apps/api/openapi.json packages/contracts services/shared/src/mimir_shared/generated_models.py
  exit 1
fi

echo "==> No contract drift detected"
