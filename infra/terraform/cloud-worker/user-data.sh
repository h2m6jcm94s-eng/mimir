#!/bin/bash
set -euo pipefail

TAILSCALE_AUTH_KEY="${tailscale_auth_key}"
WEBHOOK_URL="${webhook_url}"
JOB_PAYLOAD="${job_payload}"

# All work happens on tmpfs; nothing persists to disk.
MOUNT_POINT="/mnt/mimir-work"
mkdir -p "$MOUNT_POINT"
mount -t tmpfs -o size=2G,mode=700 tmpfs "$MOUNT_POINT"

# Join the tailnet with the cloud tag. The ACL prevents this node from reaching
# the private mesh (brain/desktop/phone).
tailscale up --authkey "$TAILSCALE_AUTH_KEY" --advertise-tags tag:cloud --accept-routes=false

# Write the job payload to ephemeral storage.
echo "$JOB_PAYLOAD" | base64 -d > "$MOUNT_POINT/job.json"

# Run the job. This example pulls the Mimir worker container; replace with the
# actual worker invocation in production.
# shellcheck disable=SC2016
docker run --rm --network none \
  -v "$MOUNT_POINT:/work:rw" \
  mimir/cloud-worker:latest \
  /work/job.json > "$MOUNT_POINT/result.json" 2> "$MOUNT_POINT/stderr.log" || EXIT_CODE=$?

EXIT_CODE="${EXIT_CODE:-0}"

# Post the result back through the signed webhook.
curl -fsS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"<(jq -n \
    --argjson exit_code \"$EXIT_CODE\" \
    --slurpfile result \"$MOUNT_POINT/result.json" \
    --rawfile stderr \"$MOUNT_POINT/stderr.log" \
    '{exitCode:$exit_code, result:$result[0], stderr:$stderr}')"

# Wipe all ephemeral state before termination.
rm -rf "$MOUNT_POINT"/*
umount "$MOUNT_POINT"

# Self-terminate once the result is delivered.
shutdown -h now
