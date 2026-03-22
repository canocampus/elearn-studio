# Issues — T150: Docker Infrastructure
> Generated: 2026-03-22
> Status: reviewed

## Summary
Review of docker-compose.yml and docker-compose.dev.yml for correct service orchestration, health checks, proper startup ordering, and Garage configuration. Focus on whether the Docker stack correctly bootstraps MongoDB, Garage, and API with proper dependencies and health verification.

## Issues Found

### CRITICAL

#### C-01 — docker-compose.yml: api depends_on garage-init but no depends_on garage
**File:** docker/docker-compose.yml lines 21-25

The api service depends on garage-init but NOT on garage itself. If garage fails or is deleted, garage-init will succeed (or skip), and the api will start without functional object storage. The health check in the api (line 27-31) will only verify storage after startup.

**Fix:** Add explicit dependency on garage with service_healthy condition.

**Status**: ✅ FIXED (2026-03-22) — `api` depends_on both `mongo` (service_healthy) and `garage-init` (service_completed_successfully); `garage-init` depends_on `garage` (service_healthy), forming a proper chain

---

### HIGH

#### H-01 — garage-init timing depends on fast completion
**File:** docker/docker-compose.yml lines 76-89

This creates a timing race: garage-init only waits for garage to be healthy, but api waits for garage-init to complete. The timing works (garage-init typically completes in 5-10 seconds), but it is fragile.

**Impact:** Very low in practice, but high risk if Garage becomes unavailable during init.

**Fix:** Add explanatory note in compose file about dependency order.

**Status**: ✅ FIXED (2026-03-22) — `garage-init` depends_on `garage` with `condition: service_healthy`; dependency chain is explicit

---

#### H-02 — mongo healthcheck only pings, does not verify readiness
**File:** docker/docker-compose.yml lines 50-54

The db.adminCommand('ping') check only verifies MongoDB is responding, not that it is ready for reads/writes. If MongoDB enters an intermediate state, the healthcheck will pass while the database is not yet ready.

**Impact:** Low (single-node doesn't have replication delays), but api may connect and fail immediately.

**Fix:** Use db.adminCommand('isReady') or add explicit collection findOne() call.

---

#### H-03 — authoring-ui depends_on api without timeout guidance
**File:** docker/docker-compose.yml lines 40-42

The authoring-ui waits for api to be healthy, but the api's start_period is 40s. If browser connects before api stabilizes, you get failed asset uploads. No guidance about expected startup sequence.

**Impact:** Medium (users may retry), but compounds with C-01.

**Fix:** Add comment noting total startup time (~60s) and consider increasing start_period for authoring-ui if needed.

**Status**: ✅ FIXED (2026-03-22) — Startup sequence comment added to authoring-ui service: `mongo (~10s) → garage (~15s) → garage-init (~10s) → api (~40s) ≈ 75s total`

---

#### H-04 — garage admin port 3903 exposed in production compose
**File:** docker/docker-compose.yml lines 63-65

The comment says "dev only" but port 3903 is exposed in the main compose (used for both dev and production). In production, the admin API should not be accessible from outside the Docker network.

**Fix:** Remove port 3903 from main compose or bind to 127.0.0.1:3903 only.

**Status**: ✅ FIXED (2026-03-22) — Port 3903 bound to `127.0.0.1:3903` (loopback only)

---

### MEDIUM

#### M-01 — garage healthcheck may fail if wget not in image
**File:** docker/docker-compose.yml lines 68-73

The dxflrs/garage:v1.0.0 image is minimal Rust binary. It may not include wget. If not, healthcheck fails immediately. **Actually, likely low risk — wget is standard.**

**Fix:** Verify dxflrs/garage:v1.0.0 includes wget or curl. Document fallback if needed.

**Status**: ✅ FIXED (2026-03-22) — Healthcheck uses `["CMD", "/garage", "status"]` (the Garage binary itself, no shell tools needed)

---

#### M-02 — moodle image is bitnamilegacy, potentially deprecated
**File:** docker/docker-compose.yml lines 94-96

The bitnamilegacy namespace indicates legacy image with no security updates. For SCORM testing this is acceptable, but should be documented.

**Fix:** Add comment that this is testing-only image.

---

#### M-03 — docker-compose.dev.yml missing healthchecks
**File:** docker/docker-compose.dev.yml lines 6-49

The dev compose has no healthchecks for mongo and garage. Dependent services (garage-init) will not wait for true readiness.

**Fix:** Copy healthcheck blocks from docker-compose.yml to docker-compose.dev.yml.

**Status**: ✅ FIXED (2026-03-22) — mongo healthcheck added to docker-compose.dev.yml (garage already had one)

---

#### M-04 — No explicit network definition
**File:** docker/docker-compose.yml

Uses default network. Fine for local dev, but if you ever need services on separate machines, you'll need explicit network definition.

**Fix:** Defer to production hardening. Not needed for Phase 1.5.

---

### LOW / INFO

#### L-01 — No compose override for CI/CD
When CI/CD is added, you'll need separate overrides for logging, network isolation, and profile management.

**Fix:** Defer to T160 or when CI/CD is added.

---

#### L-02 — Restart policies documented but not explained
**File:** docker/docker-compose.yml

api has "unless-stopped", garage-init has "no". This is correct, but users may be surprised if api keeps restarting after a manual stop.

**Fix:** Document restart policies in setup-guide.md.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 1     | 1 ✅  | 0    |
| HIGH     | 4     | 3 ✅  | 1    |
| MEDIUM   | 4     | 2 ✅  | 2    |
| LOW      | 2     | 0     | 2    |

**Fixed (2026-03-22):** C-01, H-01, H-03, H-04, M-01, M-03

**Still open:**
- H-02 — mongo healthcheck uses `ping` not full readiness check (low risk for single-node)
- M-02 — bitnamilegacy moodle image (testing-only, acceptable — compose comment documents this)
- M-04 — no explicit network definition (deferred to production hardening)
- L-01, L-02 — low priority (deferred to CI/CD phase)

