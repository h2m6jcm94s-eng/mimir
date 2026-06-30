#!/usr/bin/env bash
set -euo pipefail

# 3-2-1 backup for Mimir:
# - 3 copies: primary DB + two backup destinations
# - 2 different media: local filesystem + (optionally) S3/B2
# - 1 offsite: secondary local path or cloud bucket
#
# Backups are encrypted by default with age. Set BACKUP_UNENCRYPTED=1 only for
# local development or disaster-recovery exercises where you accept plaintext.
#
# Usage:
#   BACKUP_DIR=/var/backups/mimir AGE_RECIPIENT=age1... ./scripts/backup.sh

BACKUP_DIR="${BACKUP_DIR:-./backups}"
SECONDARY_DIR="${SECONDARY_BACKUP_DIR:-${BACKUP_DIR}/secondary}"
DATABASE_URL="${DATABASE_URL:-postgresql://mimir_app:mimir_app@localhost:5432/mimir}"
LIBSQL_PATH="${LIBSQL_PATH:-./apps/api/data/state.db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_UNENCRYPTED="${BACKUP_UNENCRYPTED:-0}"

if [ -z "${AGE_RECIPIENT:-}" ] && [ "${BACKUP_UNENCRYPTED}" != "1" ]; then
  echo '[backup] ERROR: AGE_RECIPIENT is required. Set BACKUP_UNENCRYPTED=1 to skip encryption (not recommended).' >&2
  exit 1
fi

if [ -n "${AGE_RECIPIENT:-}" ] && ! command -v age >/dev/null 2>&1; then
  echo '[backup] ERROR: age is required when AGE_RECIPIENT is set.' >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="${BACKUP_DIR}/${TIMESTAMP}"
mkdir -p "${DEST}"

echo "[backup] Starting backup at ${TIMESTAMP}"

# Postgres logical backup
pg_dump "${DATABASE_URL}" --no-owner --no-acl --clean --if-exists > "${DEST}/mimir.sql"
echo "[backup] Postgres dump: ${DEST}/mimir.sql"

# LibSQL state.db file copy (stop the API first in production)
if [ -f "${LIBSQL_PATH}" ]; then
  cp "${LIBSQL_PATH}" "${DEST}/state.db"
  echo "[backup] LibSQL copy: ${DEST}/state.db"
else
  echo "[backup] LibSQL not found at ${LIBSQL_PATH}, skipping"
fi

# Encrypt with age when configured
if [ -n "${AGE_RECIPIENT:-}" ]; then
  age -r "${AGE_RECIPIENT}" -o "${DEST}/mimir.sql.age" "${DEST}/mimir.sql"
  rm "${DEST}/mimir.sql"
  if [ -f "${DEST}/state.db" ]; then
    age -r "${AGE_RECIPIENT}" -o "${DEST}/state.db.age" "${DEST}/state.db"
    rm "${DEST}/state.db"
  fi
  echo "[backup] Encrypted with age"
fi

# Copy to secondary location (second medium / offsite)
mkdir -p "${SECONDARY_DIR}"
cp -r "${DEST}" "${SECONDARY_DIR}/"
echo "[backup] Copied to secondary: ${SECONDARY_DIR}/${TIMESTAMP}"

# Retention cleanup
find "${BACKUP_DIR}" -maxdepth 1 -type d -name '20*' -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +
find "${SECONDARY_DIR}" -maxdepth 1 -type d -name '20*' -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +

echo "[backup] Done: ${DEST}"
