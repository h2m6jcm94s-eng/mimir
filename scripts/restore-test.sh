#!/usr/bin/env bash
set -euo pipefail

# Restore the latest backup into a throwaway database and verify it.
#
# Encrypted backups require AGE_IDENTITY. Plaintext backups are supported when
# no .age file is present.
#
# Usage:
#   RESTORE_DATABASE_URL=postgresql://mimir_app:mimir_app@localhost:5433/mimir_restore ./scripts/restore-test.sh

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RESTORE_DATABASE_URL="${RESTORE_DATABASE_URL:-postgresql://mimir_app:mimir_app@localhost:5432/mimir_restore}"

LATEST=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name '20*' | sort | tail -n 1)
if [ -z "${LATEST}" ]; then
  echo "[restore-test] No backup found in ${BACKUP_DIR}"
  exit 1
fi

echo "[restore-test] Restoring from ${LATEST}"

SQL_DUMP="${LATEST}/mimir.sql"
if [ -f "${LATEST}/mimir.sql.age" ]; then
  if ! command -v age >/dev/null 2>&1; then
    echo "[restore-test] age not installed, cannot decrypt"
    exit 1
  fi
  if [ -z "${AGE_IDENTITY:-}" ]; then
    echo "[restore-test] AGE_IDENTITY is required to decrypt ${LATEST}/mimir.sql.age"
    exit 1
  fi
  age -d -i "${AGE_IDENTITY}" -o - "${LATEST}/mimir.sql.age" | psql "${RESTORE_DATABASE_URL}" -q
elif [ -f "${SQL_DUMP}" ]; then
  psql "${RESTORE_DATABASE_URL}" -q < "${SQL_DUMP}"
else
  echo "[restore-test] No mimir.sql or mimir.sql.age found in ${LATEST}"
  exit 1
fi

# Verify restore by counting key tables
JOB_COUNT=$(psql "${RESTORE_DATABASE_URL}" -t -c "SELECT count(*) FROM job;" | tr -d ' ')
NODE_COUNT=$(psql "${RESTORE_DATABASE_URL}" -t -c "SELECT count(*) FROM node;" | tr -d ' ')

echo "[restore-test] Verified: ${JOB_COUNT} jobs, ${NODE_COUNT} nodes"

if [ "${JOB_COUNT}" -eq 0 ] && [ "${NODE_COUNT}" -eq 0 ]; then
  echo "[restore-test] WARNING: restored database is empty"
fi

echo "[restore-test] OK"
