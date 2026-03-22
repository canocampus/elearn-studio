# Phase 1.5 Docker & Garage Infrastructure Review — T153

Review of Docker compose files, garage-init script, and Garage configuration.

---

## Issues Found

### T153-001 — Missing TLS in production compose
**Severity:** HIGH
**File:** docker/docker-compose.yml:66-67
**Description:** 
S3 API port (3900) is exposed to `0.0.0.0` without TLS. Admin API correctly binds to loopback only (127.0.0.1), but S3 API is unencrypted. In production, any client can intercept credentials or asset data in transit. The `GARAGE_USE_SSL=false` config confirms TLS is disabled entirely.

**Fix:** 
- Generate TLS cert for Garage S3 API
- Configure `GARAGE_USE_SSL=true` and update `api/src/storage/s3.ts` to verify TLS
- Restrict S3 API port binding to internal network only (e.g., `garage:3900` instead of `0.0.0.0:3900`)
- Document production TLS setup in README

**Status:** OPEN

---

### T153-002 — Hardcoded Garage RPC secret in version control
**Severity:** CRITICAL
**File:** docker/garage.toml:17
**Description:**
RPC secret is a hardcoded 64-char hex string (0000111122223333...). This is documented as "safe for local dev only" but is committed to the git repository. If this codebase is public or shared, the secret is exposed. Production Garage instances using this secret are vulnerable to RPC API hijacking.

**Fix:**
- Move `rpc_secret` to environment variable in Garage Docker service
- Generate unique secret per environment: openssl rand -hex 32
- Document in `.env.example` and startup docs
- If this secret was ever used in production, rotate all Garage instances

**Status:** ✅ FIXED (2026-03-22) — `docker/garage.toml.tmpl` uses `${GARAGE_RPC_SECRET}`; rendered at startup by `garage-config` Alpine init service via `envsubst` into a named Docker volume. `GARAGE_RPC_SECRET` documented in `docker/.env.example` with placeholder value.

---

### T153-003 — Garage admin token hardcoded in version control
**Severity:** CRITICAL
**File:** docker/garage.toml:28
**Description:**
Admin API token garage-admin-dev is hardcoded in both the Garage config file and in docker-compose files. The script explicitly states "This value is for local dev only; change in production" but there is no mechanism to enforce this at runtime. Any production deployment using the default config is compromised.

**Fix:**
- Move `admin_token` to environment variable in Garage startup
- Use `.env` to set unique token per environment
- Add validation in docker-compose to reject hardcoded defaults in production mode
- Document required changes in DEPLOYMENT.md

**Status:** ✅ FIXED (2026-03-22) — `docker/garage.toml.tmpl` uses `${GARAGE_ADMIN_TOKEN}`; rendered via `envsubst`. Docker Compose uses `${GARAGE_ADMIN_TOKEN:?...}` syntax — stack fails to start if variable is unset. Documented in `docker/.env.example`.

---

### T153-004 — Missing Garage data directory validation
**Severity:** MEDIUM
**File:** docker/docker-compose.yml:63-64 and docker/garage.toml:4-5
**Description:**
Garage is configured to use `/var/lib/garage/meta` and `/var/lib/garage/data` but there is no validation that these directories exist or are writable. If a volume mount fails silently, Garage will start but lose all data on container restart. The LMDB database engine will attempt to create files but may fail with insufficient permissions.

**Fix:**
- Add an init container that validates and sets permissions on mounted volumes
- Verify volume mount success in garage service healthcheck (check file existence)
- Document required volume permissions (garage user UID/GID)
- Add explicit tmpfs fallback warning if volumes are not provided

**Status:** OPEN

---

### T153-005 — No timeout on garage-init waiting loop
**Severity:** MEDIUM
**File:** docker/garage-init.sh:51-62
**Description:**
The 60-second wait loop for Garage admin API is good, but if Garage admin API fails after initialization completes (e.g., restarts), the init container will hang indefinitely on re-run without timeout. Additionally, the check uses -f (fail on error) which will exit immediately on any curl error, but transient network failures during the first 60s are silently retried.

**Fix:**
- Log retry attempts with timestamps and error details
- Add explicit backoff strategy (exponential or linear) instead of fixed 2s
- Document expected behavior if garage-init fails (Docker Compose does not retry by default)
- Consider adding a sidecar health monitor that re-validates initialization periodically

**Status:** OPEN

---

### T153-006 — garage-init layout assignment may not wait for consensus
**Severity:** MEDIUM
**File:** docker/garage-init.sh:73-82
**Description:**
After assigning the layout with POST /v1/layout, the script does not wait for Garage to apply consensus changes (commit to Raft). It immediately proceeds to apply the layout. In a multi-node cluster, this could race. For single-node dev, this works, but the comment suggests this is also used for production.

**Fix:**
- After layout assignment, poll /v1/layout until stagedRoleChanges is empty (layout applied)
- Add timeout (e.g., 30s) to prevent infinite loops
- Document single-node vs. multi-node initialization differences
- Add explicit note that script does not support cluster mode

**Status:** OPEN

---

### T153-007 — No validation of GARAGE_BUCKET environment variable format
**Severity:** MEDIUM
**File:** docker/garage-init.sh:28-31
**Description:**
The script validates that GARAGE_BUCKET is non-empty but does not validate its format. Garage bucket aliases must follow S3 naming rules (lowercase, alphanumeric, dash, length 3-63). If an invalid bucket name is passed, the create operation fails but the error message is generic.

**Fix:**
- Validate bucket name format before attempting creation
- Use regex: ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$
- Log specific error if validation fails
- Update `.env.example` and docs to show valid bucket names

**Status:** OPEN

---

### T153-008 — Garage metadata and data directory separation may not be enforced
**Severity:** LOW
**File:** docker/garage.toml:4-5
**Description:**
The config specifies separate `metadata_dir` and `data_dir`, but if both point to the same underlying volume (e.g., due to misconfiguration), performance will degrade. No validation at startup confirms they are on separate storage.

**Fix:**
- Document in deployment guide that metadata and data directories should be on separate physical volumes for production
- Add startup validation that checks directory inodes differ (are on different filesystems)
- Add optional stricter health check that logs warning if both are on same device

**Status:** OPEN

---

### T153-009 — Replication factor hardcoded to 1 in all environments
**Severity:** LOW
**File:** docker/garage.toml:9
**Description:**
`replication_factor = 1` is appropriate for single-node dev/test but this config is shared for both `docker-compose.yml` (production) and `docker-compose.dev.yml` (dev). Production deployments should use `replication_factor = 3` for data safety. No environment-specific override is provided.

**Fix:**
- Create separate `garage-prod.toml` with `replication_factor = 3`
- Use `GARAGE_CONFIG_FILE` environment variable to select config
- Document recommended replication settings per environment
- Add note in deployment guide

**Status:** OPEN

---

### T153-010 — Garage image tag pinned to v1.0.0, no digest
**Severity:** MEDIUM
**File:** docker/docker-compose.yml:60 and docker-compose.dev.yml:14
**Description:**
Uses `dxflrs/garage:v1.0.0` by tag, not by digest. A malicious actor or upstream mistake could re-tag v1.0.0 with different contents. For production, digest pinning is safer. Additionally, Garage v1.0.0 is relatively recent; no process exists to track security updates.

**Fix:**
- Use image digest: `dxflrs/garage:v1.0.0@sha256:...`
- Implement automated scanning for Garage security advisories
- Document in `.env.example` how to update Garage version safely
- Add comments on known vulnerabilities (if any)

**Status:** OPEN

---

## Summary

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 2     | 2 ✅  | 0    |
| HIGH     | 1     | 0     | 1    |
| MEDIUM   | 5     | 0     | 5    |
| LOW      | 2     | 0     | 2    |

**Fixed (2026-03-22):** T153-002 (RPC secret), T153-003 (admin token) — both now injected via `envsubst` from env vars; `garage.toml.tmpl` template in place.

**Still open:**
- T153-001 — No TLS on S3 API port (HIGH — defer to production hardening)
- T153-004 — No Garage data directory validation (MEDIUM)
- T153-005 — No retry logging/backoff detail in init loop (MEDIUM)
- T153-006 — Layout assignment doesn't wait for Raft consensus (MEDIUM — single-node only in Phase 1.5)
- T153-007 — Bucket name format not validated (MEDIUM)
- T153-008, T153-009, T153-010 — LOW infrastructure concerns

**Verdict:** PARTIAL — CRITICAL secrets issues resolved. HIGH (TLS) and MEDIUM issues remain; acceptable for Phase 1.5 local/dev deployment. TLS required before public-facing production.

