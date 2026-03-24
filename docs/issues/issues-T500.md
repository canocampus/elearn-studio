# issues-T500 — Playwright Screenshot Automation Review

**Task:** T500 — Screenshot capture script + 19 screenshots
**Date:** 2026-03-24
**Reviewer:** Claude Sonnet 4.6
**Status:** PASS with notes (18/19 screenshots captured)

---

## Summary

The capture script (`docs/scripts/capture-screenshots.ts`) runs end-to-end
successfully. 18 of the 19 planned screenshots were captured; 1 was skipped
because the Moodle service is not running.

Reviewing all 18 captured PNGs, the following issues were identified.

---

## Issues

### T500-I01 — No standalone dashboard / course-list view (MEDIUM)

**File:** `01-dashboard.png`
**Finding:** The application loads directly into the editor for the most-recently-opened
course. There is no browseable course-list screen. `01-dashboard.png` is identical in
layout to `03-editor-empty.png` — both show the editor.
**Impact:** User documentation cannot show a meaningful "launch the app → see your courses"
flow. New users have no way to navigate between courses except via URL manipulation.
**Recommendation:** Add a minimal course-selection splash screen that lists all user courses
and allows opening or creating one. This would also fix the screenshot for docs.

---

### T500-I02 — Grafana screenshot captured login page, not dashboard (LOW)

**File:** `19-grafana-dashboard.png`
**Finding:** Grafana's default credentials (admin/admin) were refused or the admin
password was changed during initial setup. The screenshot shows the "Welcome to Grafana"
login page instead of the eLearn overview dashboard.
**Impact:** Documentation cannot show the observability dashboard.
**Recommendation:** Either (a) document the Grafana password in `docker/.env.example`
and pass it via `DOCS_GRAFANA_PASSWORD` env var in the capture script, or (b) configure
Grafana with anonymous access for the local dev stack.

---

### T500-I03 — Programmatic widget drag-and-drop fails across iframe boundary (LOW)

**Files:** `05-editor-widgets.png`, `06-layer-manager.png`
**Finding:** The capture script attempts to drag GrapesJS blocks onto the canvas via
Playwright. The drag does not succeed because the GrapesJS canvas renders inside an
`<iframe>` and the drag source (block) is in the main DOM. As a result,
`05-editor-widgets.png` shows an empty canvas instead of a slide with mixed widgets.
**Impact:** Screenshots intended to show a populated canvas look identical to the empty
editor screenshots.
**Recommendation:** Inject widget HTML directly via `page.evaluate()` calling
`editor.addComponents(...)` on the `window.gjsEditor` reference, or add the widgets
to the course via the backend API before navigating to that course in the browser. The
API approach is more reliable.

---

### T500-I04 — Moodle service is DOWN — T500.19 blocked (LOW)

**File:** `18-moodle-course.png` — NOT CAPTURED
**Finding:** `curl http://localhost:8081/` returns connection refused. The Moodle
Docker container is not running.
**Impact:** `18-moodle-course.png` is absent from `docs/assets/screenshots/`.
**Recommendation:** Start the Moodle container (`docker compose up moodle`) and re-run
`pnpm --filter @elearn-studio/docs run capture` to generate the missing screenshot.
Track Moodle startup issue separately.

---

### T500-I05 — Grafana port in skill doc vs actual differs (LOW)

**Finding:** The `elearn-docs-technical` skill document lists Grafana at port `3002`.
The actual running container is bound to `0.0.0.0:3010->3000/tcp`.
The capture script already uses port 3010 (correct), but the skill document is stale.
**Recommendation:** Update `elearn-docs-technical/SKILL.md` port reference table:
`Grafana: 3010` (not 3002).

---

### T500-I06 — Contributing guide referenced wrong E2E test paths (LOW)

**File:** `docs/contributing-guide.md` (pre-existing, not introduced by T500)
**Finding:** Line 76 references `pnpm --filter authoring-ui exec playwright install`
but the E2E tests now live in the separate `e2e/` workspace package
(`@elearn-studio/e2e`), not inside `authoring-ui`.
**Recommendation:** Update the E2E section of contributing-guide.md to use
`pnpm --filter @elearn-studio/e2e exec playwright install --with-deps` and
`pnpm --filter @elearn-studio/e2e run test`.

---

## Resolved before closing T500

None of the above issues block documentation generation. All Phase 5 tasks
(T501–T506) can proceed using the 18 captured screenshots.

Issues T500-I01 and T500-I03 are the most impactful for documentation quality.
T500-I01 (no course list) is a product-level UX gap that should be tracked as a
new feature task. T500-I03 (widget population) can be improved in the next
capture-script refinement pass.
