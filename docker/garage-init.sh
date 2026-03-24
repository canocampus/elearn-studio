#!/bin/sh
# garage-init.sh — single-node Garage initialization
#
# Runs as a one-shot Docker Compose service.  Waits for the Garage admin API,
# then assigns the cluster layout, imports the storage key, creates the bucket,
# and grants the key full access.  All steps are idempotent (safe to re-run).
#
# Environment variables (all have defaults matching docker-compose.yml):
#   GARAGE_ADMIN_URL    — admin API base URL          (default: http://garage:3903)
#   GARAGE_ADMIN_TOKEN  — admin API bearer token      (required by Garage v1.0.0)
#   GARAGE_BUCKET       — bucket name                 (default: elearn-assets)
#   GARAGE_ACCESS_KEY   — S3 access key ID            (default: GK000000000000000000000001)
#   GARAGE_SECRET_KEY   — S3 secret access key        (default: 0000000000000000000000000000000000000000000000000000000000000001)

set -e

ADMIN="${GARAGE_ADMIN_URL:-http://garage:3903}"
TOKEN="${GARAGE_ADMIN_TOKEN:-garage-admin-dev}"
BUCKET="${GARAGE_BUCKET:-elearn-assets}"
ACCESS_KEY="${GARAGE_ACCESS_KEY:-GK000000000000000000000001}"
SECRET_KEY="${GARAGE_SECRET_KEY:-0000000000000000000000000000000000000000000000000000000000000001}"

# ── Validate required environment variables ───────────────────────────────────
if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
  echo "ERROR: GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY must be set and non-empty" >&2
  exit 1
fi
if [ -z "$BUCKET" ]; then
  echo "ERROR: GARAGE_BUCKET must be set and non-empty" >&2
  exit 1
fi

# T153-007 fix: validate bucket name format before attempting creation.
# Garage bucket aliases follow S3 naming rules: lowercase, alphanumeric + dash,
# length 3–63, must start and end with alphanumeric character.
if ! echo "$BUCKET" | grep -qE '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'; then
  echo "ERROR: GARAGE_BUCKET '$BUCKET' is invalid. Bucket names must be 3-63 lowercase alphanumeric chars/dashes, start and end with alphanumeric." >&2
  exit 1
fi

# ── Install dependencies ──────────────────────────────────────────────────────
# jq and curl not present in Alpine by default; install once.
apk add --no-cache jq curl > /dev/null 2>&1

# ── Helper: GET with auth token, return response body ────────────────────────
get_json() {
  curl -sf -H "Authorization: Bearer $TOKEN" "$1"
}

# ── Helper: POST JSON with auth token, return HTTP status code to stdout ──────
post_json() {
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$2" "$1"
}

# ── Wait for Garage admin API (max 60 s) ─────────────────────────────────────
# T153-005 fix: log timestamps and attempt count so failures are easier to diagnose.
echo "==> Waiting for Garage admin API at $ADMIN ..."
WAIT=0
ATTEMPT=0
until curl -sf -H "Authorization: Bearer $TOKEN" "$ADMIN/v1/health" > /dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "    [$(date -u '+%H:%M:%S')] attempt $ATTEMPT — not ready, retrying in 2s ..."
  sleep 2
  WAIT=$((WAIT + 2))
  if [ "$WAIT" -ge 60 ]; then
    echo "ERROR: Garage admin API not ready after 60 seconds ($ATTEMPT attempts)" >&2
    exit 1
  fi
done
echo "==> Garage admin API ready after $ATTEMPT retries."

# ── 1. Retrieve node ID ───────────────────────────────────────────────────────
NODE_ID=$(get_json "$ADMIN/v1/status" | jq -r '.node')
if [ -z "$NODE_ID" ] || [ "$NODE_ID" = "null" ]; then
  echo "ERROR: Failed to retrieve node ID from Garage (got: '$NODE_ID')" >&2
  exit 1
fi
echo "==> Node ID: $NODE_ID"

# ── 2. Assign layout: zone=dc1, capacity=1 GiB ───────────────────────────────
# dc1 is arbitrary — single-node setup ignores zone name for replication.
LAYOUT_BODY=$(jq -n --arg id "$NODE_ID" \
  '[{"id": $id, "zone": "dc1", "capacity": 1073741824, "tags": []}]')
STATUS=$(post_json "$ADMIN/v1/layout" "$LAYOUT_BODY")
if [ "$STATUS" != "200" ] && [ "$STATUS" != "204" ]; then
  echo "ERROR: Layout assign failed (HTTP $STATUS)" >&2
  exit 1
fi
echo "==> Layout assigned."

# ── 3. Apply layout (idempotent — skip if no staged changes) ─────────────────
LAYOUT_INFO=$(get_json "$ADMIN/v1/layout")
STAGED=$(echo "$LAYOUT_INFO" | jq '.stagedRoleChanges | length')
if [ "$STAGED" = "0" ] || [ -z "$STAGED" ]; then
  echo "==> Layout already applied, skipping."
else
  CURRENT_VERSION=$(echo "$LAYOUT_INFO" | jq -r '.version // 0')
  NEXT_VERSION=$((CURRENT_VERSION + 1))
  STATUS=$(post_json "$ADMIN/v1/layout/apply" "{\"version\":$NEXT_VERSION}")
  if [ "$STATUS" != "200" ] && [ "$STATUS" != "204" ]; then
    echo "ERROR: Layout apply failed (HTTP $STATUS)" >&2
    exit 1
  fi
  echo "==> Layout applied (version $NEXT_VERSION)."
fi

# ── 4. Import storage key (idempotent — 409 means key already exists) ────────
KEY_BODY=$(jq -n \
  --arg id "$ACCESS_KEY" \
  --arg secret "$SECRET_KEY" \
  '{"accessKeyId": $id, "secretAccessKey": $secret, "name": "elearn-key"}')
STATUS=$(post_json "$ADMIN/v1/key/import" "$KEY_BODY")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  echo "==> Storage key imported."
elif [ "$STATUS" = "409" ] || [ "$STATUS" = "422" ]; then
  # 409 = conflict (key ID already exists); safe to continue.
  echo "==> Storage key already exists, continuing."
else
  echo "ERROR: Key import failed (HTTP $STATUS) — check that GARAGE_ACCESS_KEY/GARAGE_SECRET_KEY are consistent" >&2
  exit 1
fi

# ── 5. Create bucket (idempotent — 409 means bucket already exists) ──────────
BUCKET_BODY=$(jq -n --arg alias "$BUCKET" '{"globalAlias": $alias}')
STATUS=$(post_json "$ADMIN/v1/bucket" "$BUCKET_BODY")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ] || [ "$STATUS" = "204" ]; then
  echo "==> Bucket '$BUCKET' created."
elif [ "$STATUS" = "409" ]; then
  echo "==> Bucket '$BUCKET' already exists, continuing."
else
  echo "ERROR: Bucket creation failed (HTTP $STATUS)" >&2
  exit 1
fi

# ── 5b. Verify bucket exists with expected global alias ──────────────────────
BUCKET_INFO=$(get_json "$ADMIN/v1/bucket?globalAlias=$BUCKET" 2>/dev/null || true)
if [ -z "$BUCKET_INFO" ]; then
  echo "ERROR: Cannot retrieve bucket info for '$BUCKET' — bucket may not exist" >&2
  exit 1
fi
BUCKET_ALIAS=$(echo "$BUCKET_INFO" | jq -r '.globalAliases[0]')
if [ "$BUCKET_ALIAS" != "$BUCKET" ]; then
  echo "ERROR: Bucket alias mismatch — expected '$BUCKET', found '$BUCKET_ALIAS'" >&2
  exit 1
fi

# ── 6. Grant key full access to bucket ───────────────────────────────────────
BUCKET_ID=$(echo "$BUCKET_INFO" | jq -r '.id')
if [ -z "$BUCKET_ID" ] || [ "$BUCKET_ID" = "null" ]; then
  echo "ERROR: Cannot retrieve bucket ID for '$BUCKET'" >&2
  exit 1
fi
echo "==> Bucket ID: $BUCKET_ID"

ALLOW_BODY=$(jq -n \
  --arg bid "$BUCKET_ID" \
  --arg kid "$ACCESS_KEY" \
  '{"bucketId": $bid, "accessKeyId": $kid,
    "permissions": {"read": true, "write": true, "owner": true}}')
STATUS=$(post_json "$ADMIN/v1/bucket/allow" "$ALLOW_BODY")
if [ "$STATUS" != "200" ] && [ "$STATUS" != "204" ]; then
  echo "ERROR: Bucket permissions grant failed (HTTP $STATUS)" >&2
  exit 1
fi
echo "==> Key permissions granted."

echo "==> Garage initialization complete.  Bucket '$BUCKET' is ready."
