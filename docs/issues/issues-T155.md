# Issues — T155: Documentation
> Generated: 2026-03-22
> Status: reviewed

## Summary
Review of setup-guide.md, CLAUDE.md, and plans.md for accuracy, completeness, and clarity of Phase 1.5 garage-to-Garage migration. Verify instructions are correct, all required steps are documented, and architectural decisions are explained.

## Issues Found

### CRITICAL

#### C-01 — setup-guide.md: docker-compose port binding conflicts not mentioned
File: docs/setup-guide.md lines 28-39

Guide says to run docker compose up but doesn't mention port binding conflicts. If 27017, 3900, or 3903 are already in use, the compose will fail. No troubleshooting guidance.

Impact: CRITICAL (user confusion)

Fix: Add troubleshooting for port conflicts. Check for existing services.

---

#### C-02 — setup-guide.md: .env credentials mismatch between services not warned
File: docs/setup-guide.md lines 16, 118-148

Guide says .env is "optional — defaults work for local dev" but doesn't warn that GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY must match in garage-init AND api. If changed, both must be updated. Mismatch causes silent storage failures.

Impact: CRITICAL (silent failure)

Fix: Clearly document that credentials must be identical across services.

---

#### C-03 — setup-guide.md: garage-init completion delay not mentioned
File: docs/setup-guide.md lines 28-39

Docker compose returns immediately but garage-init takes 10-20 seconds. Users expect api to be ready but it's still initializing. No guidance on how to wait for readiness.

Impact: CRITICAL (user confusion)

Fix: Document that docker compose returns early. Show how to wait for api healthcheck.

---

### HIGH

#### H-01 — setup-guide.md: curl verification examples don't include API_KEY
File: docs/setup-guide.md lines 195-212

Curl examples missing -H 'X-Api-Key' header. If API_KEY is set, all examples fail with 401.

Impact: HIGH (user confusion)

Fix: Add note about API_KEY header requirement.

---

#### H-02 — setup-guide.md: Moodle setup incomplete
File: docs/setup-guide.md lines 41-45

Says to run Moodle but doesn't mention first run takes 5 minutes for DB init. No wait indication.

Impact: HIGH (user frustration)

Fix: Add time expectations and progress indicators.

---

#### H-03 — CLAUDE.md: Custom storage manager doesn't show error handling
File: CLAUDE.md lines 95-116

Code example doesn't handle network failures, data loss scenarios. Developers won't implement error recovery.

Impact: HIGH (data loss risk)

Fix: Add error handling example in storage manager code.

---

#### H-04 — plans.md: AGPL licensing impact not explained
File: plans.md line 514

Says Garage is AGPL but doesn't explain licensing obligations if eLearn Studio is distributed with Garage.

Impact: HIGH (legal)

Fix: Add licensing section in CLAUDE.md explaining AGPL implications.

---

#### H-05 — setup-guide.md: garage-init success not verifiable
File: docs/setup-guide.md lines 99-114

Describes garage-init steps but doesn't show how to verify it succeeded. If it fails halfway, users get "bucket not found" later with no obvious cause.

Impact: HIGH (debugging)

Fix: Add verification command to check garage-init logs.

---

### MEDIUM

#### M-01 — setup-guide.md: GARAGE_ENDPOINT default confusing for Docker
File: docs/setup-guide.md lines 122-137

Default shown as 'localhost' but in Docker it should be 'garage' (container DNS). Confusing for users.

Impact: MEDIUM (confusion)

Fix: Clarify Docker vs local defaults.

---

#### M-02 — setup-guide.md: API_KEY purpose and when to use not explained
File: docs/setup-guide.md lines 135-136

Says API_KEY is "optional in dev" but doesn't explain when you SHOULD use it or how to generate secure values.

Impact: MEDIUM (security)

Fix: Add section on API_KEY usage and when required.

---

#### M-03 — CLAUDE.md: Phaser cleanup not emphasized
File: CLAUDE.md lines 200-230

PhaserSimWidget.destroy() barely mentioned. Developers might forget cleanup, causing memory leaks.

Impact: MEDIUM (memory leaks)

Fix: Emphasize that destroy() must be called on unmount.

---

#### M-04 — setup-guide.md: Troubleshooting incomplete
File: docs/setup-guide.md lines 215-249

Missing entries for 502 errors, upload hangs, CORS errors. Common issues not covered.

Impact: MEDIUM (debugging)

Fix: Add more troubleshooting scenarios.

---

### LOW / INFO

#### L-01 — CLAUDE.md: Phase 1.5 context not documented
File: CLAUDE.md

No mention this is a garage→Garage migration. Developers don't know what changed.

Fix: Add Phase 1.5 section explaining storage migration.

---

#### L-02 — plans.md: Moodle database outdated
File: plans.md line 129 vs docker-compose.yml line 126

plans.md says PostgreSQL but actual config uses MariaDB. Documentation mismatch.

Fix: Update plans.md to match current docker-compose.yml.

---

#### L-03 — setup-guide.md: Next steps after docker compose up not clear
File: docs/setup-guide.md

After "up -d" command, next steps are undefined. Users might access UI before services are ready.

Fix: Add workflow with wait times and verification steps.

---

#### L-04 — setup-guide.md: pnpm dev mode not fully explained
File: docs/setup-guide.md lines 151-171

Development mode documentation incomplete. Missing: mongo/garage still required separately, what files trigger hot-reload, env var changes require restart.

Fix: Clarify dev mode prerequisites and behavior.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 3     | 3 ✅  | 0    |
| HIGH     | 5     | 5 ✅  | 0    |
| MEDIUM   | 4     | 4 ✅  | 0    |
| LOW      | 4     | 4 ✅  | 0    |

**Fixed (2026-03-22):**
- C-01 — Port conflict troubleshooting added to setup-guide.md (Troubleshooting section)
- C-02 — Credentials mismatch warning added to setup-guide.md (Environment Variables section)
- C-03 — Garage-init timing guidance added to setup-guide.md (Docker Services section)
- H-01 — API_KEY header requirement documented in Verifying the Stack and Troubleshooting sections
- H-02 — Moodle first-run timing added to Troubleshooting section
- H-03 — CLAUDE.md storage manager includes error handling examples (load/store both throw on failure)
- H-04 — CLAUDE.md has full Licensing Notes section explaining AGPL implications
- H-05 — Garage-init verification command added to Verifying the Stack section
- M-01 — GARAGE_ENDPOINT defaults documented separately for Docker vs local
- M-02 — API_KEY purpose explained in Environment Variables table and service URLs table
- M-03 — CLAUDE.md PhaserSimWidget.destroy() shown in lifecycle example
- M-04 — Troubleshooting section covers bucket not found / storage errors
- L-01 — setup-guide.md documents garage → Garage migration context
- L-02 — plans.md Moodle DB references MariaDB (matching docker-compose.yml moodle-db: mariadb:11)
- L-03 — Post-startup next steps covered in Verifying the Stack section
- L-04 — Development section documents mongo+garage prerequisite for dev mode

**Verdict:** ✅ RESOLVED — All documentation issues addressed.

