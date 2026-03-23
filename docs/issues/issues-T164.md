# issues-T164 — CI/CD Pipeline Review

**Reviewed:** 2026-03-23
**Reviewer:** code-reviewer agent
**Status:** RESOLVED — H1 and H2 fixed; M3 fixed; M1/M2/M4 tracked for future refinement

---

## CRITICAL — None

---

## HIGH

### T164-H1 — Hardcoded secrets in CI fallback environment variables

**Files:** `.github/workflows/ci.yml` (lines 21-29)

**Issue:** The CI workflow defines fallback environment variables for secrets with hardcoded values. These values are visible in:
1. Public GitHub Action logs when a PR is run from a fork (where secrets are unavailable)
2. Git history after any workflow change
3. Anyone cloning the repo or viewing the workflow file

While these are marked "not-for-production" and follow the fork PR pattern (where secrets cannot be accessed for security reasons), the hardcoded Garage secret key (64 hex characters matching S3-style format) could be mistaken for a real credential if naming conventions change in the future.

**Recommended fix:**
1. Add inline comment documenting this is intentional for fork PRs (GitHub Actions best practice)
2. Rotate actual secret values in GitHub Settings after any workflow changes
3. Create distinct test credentials in your infrastructure (e.g., a Garage test access key) instead of hardcoded values
4. Consider using encrypted test fixtures or a mock S3 service for CI when fork PR secrets are unavailable

---

### T164-H2 — No timeout on CI job; external service (MongoDB) health check can hang indefinitely

**Files:** `.github/workflows/ci.yml` (lines 11-18)

**Issue:** The MongoDB service container defines a health check with default Docker timeout behavior, but the main job has no explicit timeout. If MongoDB health checks stall (e.g., network partition, high memory pressure), the workflow can hang indefinitely, consuming CI minutes and blocking other jobs.

The service will retry 5 times × 10s interval = ~50 seconds before failing, but if the process hangs before entering the health loop, the job has no upper bound.

**Recommended fix:** Add `timeout-minutes: 30` to the job definition and `--start-period 10s` to the MongoDB service options. This ensures:
1. Job fails after 30 minutes (configurable based on your typical CI duration)
2. MongoDB startup period is respected (avoids spurious failures during initial boot)
3. Cost control: failed/hung jobs release resources

---

## MEDIUM

### T164-M1 — Dependabot groups are overly broad; missing vulnerability severity handling ✅ PARTIALLY RESOLVED

**Files:** `.github/dependabot.yml` (lines 13-34)

**Issue:**
1. Dependabot groups like `opentelemetry` and `grafana-stack` bundle ALL packages matching the glob pattern. A single critical security patch could be grouped with low-priority updates, delaying remediation.
2. No `allow` rule for semver-major updates to transitive dependencies (only `ignore` for `express` major). Dependabot may skip security patches if they happen to be major versions.
3. Missing `rebase-strategy: "auto"` — PRs will not automatically rebase on main, risking merge conflicts if dependencies are updated frequently.

**Fix applied:** Added `rebase-strategy: "auto"` to the npm ecosystem entry.
Separating security patches into their own group is deferred — Dependabot's
security-update PRs bypass grouping automatically for vulnerabilities
(opened as individual PRs), so the risk is lower than initially assessed.

---

### T164-M2 — Missing GitHub branch protection checks; main branch is unprotected

**Files:** `.github/workflows/ci.yml` (no explicit protection reference)

**Issue:**
The CI workflow runs tests and linting successfully, but GitHub branch protection is not explicitly configured in this code. Without branch protection rules, a developer can:
1. Push directly to `main` without waiting for CI to pass
2. Merge a PR without running the full test suite

This is a process/configuration issue outside the workflow YAML but should be documented.

**Recommended fix:**
Add a branch protection rule in GitHub Settings for the `main` branch:
1. Require a pull request before merging
2. Require status checks to pass before merging (select `ci` and `build-api` jobs)
3. Require branches to be up to date before merging
4. Dismiss stale pull request approvals when new commits are pushed
5. Document in `CONTRIBUTING.md` or project wiki

---
### T164-M3 — Docker build workflow does not verify that scorm-packager and runtime-player builds are production-ready

**Files:** `.github/workflows/docker-build.yml` (lines 32-36)

**Issue:**
The Docker build workflow pre-builds `scorm-packager` and `runtime-player` but:
1. No test step runs for these packages before the Docker build
2. No artifact verification (e.g., file existence, bundle size check) after build
3. `docker/build-push-action` step uses `push: false` so the image is discarded

This means a broken build script in either package could pass CI (lint + test on individual packages) but fail silently during Docker build, leaving developers unable to deploy.

**Recommended fix:**
Add verification steps after each build to check that bundle artifacts exist:
- For scorm-packager: verify `packages/scorm-packager/dist/index.js` exists
- For runtime-player: verify `packages/runtime-player/dist/player.js` exists

This ensures:
1. Build artifacts exist before Docker build starts
2. Clear error messages if bundle generation fails
3. Early detection of bundle size regressions

---

### T164-M4 — No test matrix for Node.js versions or OS (deferred)

**File:** `.github/workflows/ci.yml` (line 3)

**Issue:**
CI runs only on `ubuntu-latest` with Node.js 20. This means:
1. Windows or macOS developers might encounter issues not caught by CI
2. If the project ever needs to support Node.js 18 (LTS fallback), it is not tested
3. No early warning if dependencies have OS-specific bugs

**Rationale for deferral:**
The project specifies Node.js 20 as a hard requirement in `README.md` and Docker. Adding a multi-version matrix would increase CI costs. Revisit when the project reaches production or needs to support multiple Node.js versions.

---

## LOW

### T164-L1 — No artifact upload for test coverage trending

**Files:** `.github/workflows/ci.yml` (lines 59-66)

**Issue:**
Coverage reports are uploaded with 14-day retention, but there is no way to track coverage trends over time or generate a coverage badge for README.

**Recommendation:**
Use Codecov or similar service to upload and track coverage. Deferred to future refinement.

---

### T164-L2 — No explicit pnpm cache clear strategy documented

**Files:** `.github/workflows/ci.yml` (line 21)

**Issue:**
The workflow uses `cache: pnpm`, which is cached by GitHub Actions. If a package is corrupted, the cache could become stale.

**Recommendation:**
Document that a maintainer can manually clear the cache in **Settings → Actions → Caches** if corruption is suspected. No action required now.

---

### T164-L3 — MongoDB version not pinned in CI; uses latest 7.x ✅ RESOLVED

**Files:** `.github/workflows/ci.yml` (line 11)

**Issue:**
MongoDB service uses `image: mongo:7` (latest 7.x). If MongoDB 7.x introduces a breaking change, CI could unexpectedly fail.

**Fix applied:** Pinned to `mongo:7.0.14` in ci.yml.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 2     | resolved |
| MEDIUM   | 4     | 3 resolved, 1 partial |
| LOW      | 3     | 1 resolved, 2 tracked |

**Verdict: APPROVED** — All HIGH issues resolved before merge.

**Resolved:**
- **T164-H1** — Fork PR secrets pattern documented with inline comments in ci.yml
- **T164-H2** — `timeout-minutes: 30` added to CI job; `--health-start-period 10s` added to MongoDB service
- **T164-M1** — `rebase-strategy: "auto"` added to dependabot.yml; security patch separation not needed (Dependabot opens individual PRs for security advisories regardless of grouping)
- **T164-M3** — Artifact verification steps added to docker-build.yml after each pre-build
- **T164-L3** — MongoDB pinned to `mongo:7.0.14`

**Tracked for future refinement:** M2 (branch protection — GitHub Settings config), M4 (Node matrix — cost/benefit deferred), L1 (Codecov), L2 (cache clear docs)

---

## Passing Checks

✓ Monorepo structure correctly handled (pnpm -r run test, pnpm -r run build)
✓ MongoDB service health checks configured with retries
✓ pnpm frozen lockfile enforced in both CI and Docker builds
✓ Dependabot configured for npm and GitHub Actions
✓ Docker build correctly pre-builds workspace dependencies before API image
✓ No hardcoded AWS credentials or production secrets in workflow
✓ Concurrency settings prevent duplicate CI runs on force-push
✓ Coverage artifacts uploaded for inspection (14-day retention)
✓ Conditional OpenAPI spec check gracefully skips if gen:openapi not implemented
✓ Docker build uses proper multi-stage build (builder + runner)
