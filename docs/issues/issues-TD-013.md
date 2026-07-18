# Issues — TD-013 (Screenshot campaign 100% automation)

> Per-subtask fixes and findings for the TD-013 block. Self-review section is
> appended at block closure (TD-013.10).

---

## TD-013.5c — Baseline investigation (2026-07-17): committed captures already defective

The owner reported "overlapping objects / captures before load completes" after
a campaign re-run. Pixel comparison against `HEAD` showed the regenerated PNGs
were content-identical to the committed baseline (≤1.1% sampled diff, all
antialiasing) — the defects were **in the committed baseline of `473067b`**:
§17 finals re-photographed the scratch course's stacked centred widgets at a
canvas-clipping 1280×720 viewport; `02-first-slide` used the scratch course's
empty slide 5 by design; `11-recipe-attempts` carried validation warning
banners; `01-full-ui-annotated` callouts 5–9 covered the tab labels. All fixed
by the TD-013.5c recomposition (worked-example course built for real). The
"white slide thumbnails" are NOT premature captures — thumbnail generation
(F02.16, P1) is simply not implemented.

## TD-013.5c — `editor.select(null)` via evaluate dies deterministically mid-build (2026-07-18)

**Symptom:** during the §17 build, a `page.evaluate(() =>
window.__elearn_editor?.select(null))` issued right after placing the slide-4
widgets failed on EVERY run with `Execution context was destroyed, most likely
because of a navigation` — including an immediate retry 1s later.

**Evidence:** instrumentation (main-frame `framenavigated`, browser `console`,
`pageerror` listeners — left in the spec as permanent diagnostics) showed NO
navigation, NO vite reload, NO page error; safety-net screenshots taken right
after prove the page and the built course survive intact.

**Workaround (shipped):** deselect via `page.keyboard.press('Escape')` (the
real-UI path) — the evaluate disappears and the build completes. A
`retryOnDestroyedContext()` helper additionally wraps the remaining §17
evaluates. **Root cause remains unexplained** — candidate: GrapesJS
`select(null)` interacting with the autosave debounce window recycling the
context the evaluate runs in. Revisit if it reappears elsewhere.

## TD-013.5c — Product/manual findings surfaced by the worked-example build (2026-07-18)

Documented here for owner triage — none fixed in this subtask (out of scope):

1. **No slide-level actions path.** `17-worked-example.md` §Slide 4 instructs
   wiring `enterSlide` "on **the slide itself** (no block selected)", but the
   shipped ActionsPanel renders an empty state ("Select a widget to edit its
   actions") whenever nothing is selected — slide-level sequences are not
   reachable from the UI. The campaign wires the branching on `BranchingNote`
   instead (visually identical panel). **Either the manual needs correcting or
   the product needs the feature.**
2. **Action sequences do not survive slide switches.** Sequences wired during
   the build phase were gone when the finals loop returned to the slide
   (component ids regenerate on slide reload and the sequences orphan). This is
   the e2e skill's GAP-02 persistence gap observed in practice. The campaign
   works around it by wiring each slide's actions immediately before its
   capture. **A real author who wires actions and navigates away may lose
   them** — needs a product-level regression test + fix.
3. **`nav-buttons` renders broken in the editor canvas.** The previous-button
   child renders without its "← Previous" label and overlaps the Next button.
   Both the programmatic path and `EditorPage.dragBlockToCanvas` create the
   widget the same way (`addComponents` by type), so real authors see this too.
4. **`done-button` label edits don't reflect in the canvas.** Filling "Button
   Label" = "Finish course" on a done-button (real Props input, committed with
   Tab) leaves the canvas rendering "✓ Done" after the save round-trip. The
   §17 slide-5 shot therefore shows the default label — honest capture of
   current behaviour.
5. **`name` trait stripped by the save/reload round-trip** (already documented
   for §09) — §17 re-resolves widgets via the persisted `[name]` DOM attribute
   and restores the visible NameField value through the real input where the
   shot needs it (slide 3).

---

## TD-013.5b — `captureElement` padding path: missing scroll-into-view (2026-07-17)

**Symptom (latent):** `captureElement(page, selector, { padding: N })` could
produce an invalid clip (or capture the wrong region) whenever the target
element sat below the fold — e.g. inside the scrolled Properties panel.

**Cause:** the helper's docstring promises "Handles scroll-into-view
automatically; robust to scrollable panels", but only the non-padding path
delivered on it (Playwright's `locator.screenshot()` scrolls internally). The
padding path switches to `page.screenshot({ clip })`, whose clip coordinates
are viewport-relative — it read `boundingBox()` without scrolling first, so a
below-viewport bbox produced a clip outside the viewport.

**Why it never surfaced before:** every pre-existing padded call site
(`02-create-course` dialog, `09-widget-dropdown-names` select, §13 overlay
captures) targeted elements already in view when invoked.

**Fix:** `await loc.scrollIntoViewIfNeeded()` before the `boundingBox()` read
in `e2e/utils/screenshot.ts` (no-op for elements already in view; benefits all
padded callers). Found during TD-013.5b pre-implementation investigation — the
new `scoring-section` capture is the first padded call site targeting a
potentially below-fold element.

**Verification:** e2e `tsc --noEmit` exit 0; campaign run green with
`08-scoring-section.png` emitted via the `(element)` path; no pre-existing
capture regressed (visual pass over the campaign output).

---

## TD-013.5b — Fallback design note: `-fullpage` net captured unconditionally (2026-07-17)

The task text said "replace the current `captureFullPage`" — implemented
instead as *fullpage first, then primary testid capture*, because the Python
post-crop fallback's idempotence contract ("checks file mtime vs source")
requires a fresh same-render source on every run: comparing the target against
a stale source from a previous session would make the skip/crop decision
non-deterministic. Cost: one extra PNG per run (status quo — the file was
already tracked). The rect in `scripts/screenshots-crop.json` was derived from
the live element bbox (1041,416,227×145 − 12px padding → `{1029, 404, 251×169}`,
clamped at the 1280px right edge) and validated pixel-equivalent against the
fresh fullpage.

---

## Block self-review (TD-013.10 closure, 2026-07-18)

**Scope delivered vs planned.** All 10 subtasks closed (.1–.4 April sessions;
.5 2026-04-29; .5b/.5c/.6/.7/.8/.9 July 17–18). One subtask was ADDED
mid-block (.5c, owner-approved option 1) after the 2026-07-17 investigation
showed the committed capture baseline itself was defective — the block's
original scope assumed the §17/§02/§11/§01 shots only needed automation, not
recomposition.

**Verification state at closure.** 55/55 placeholders automated and verified
(inventory cross-check + visual pass: 11 by hand, 44 by vision agent, 2
defects found by the pass and fixed in-block). Campaign green across 7+
consecutive runs (~40s each) including twice post-refactor. e2e `tsc` 0;
lint 0 errors (2 pre-existing TD-004 warnings); authoring-ui vitest
1039/1039 (only production change in the block: one additive testid, .5b).

**Severity-ranked open items handed to the backlog** (owner directive
2026-07-18 — filed, not fixed here):
- TD-015 (CRITICAL) — action sequences lost on slide switch (GAP-02).
- TD-016 (HIGH) — nav-buttons broken editor render.
- TD-017 (MEDIUM) — slide-level actions: manual §17 vs product mismatch.
- TD-018 (MEDIUM) — done-button label edits not reflected in canvas.
- TD-019 (MEDIUM) — `name` trait stripped on save round-trip.
- TD-020 (LOW) — `select(null)` evaluate context-destruction root cause.

**Honest deviations shipped in the captures** (product reality, not
airbrushed): nav-buttons Previous button broken (TD-016); FinishBtn shows
"✓ Done" (TD-018); slide-4 branching wired on BranchingNote (TD-017); the
§17 map image is an honestly-labelled illustrative SVG.

**Legacy retirement.** `docs/scripts/` (2 v1 capture scripts) deleted;
`docs/package.json` `capture` script + orphaned devDeps removed (lockfile
regenerated); `docs/assets/screenshots/` flagged legacy via README (kept only
while the root README embeds two v1 images); `user-manual-v2-scope.md`
capture-workflow section rewritten for the automated pipeline.

**Process notes.** The one-subtask-at-a-time cadence held except where the
owner explicitly batched (.6→.10 "continuamos trabajando"); the .9 Refine
gate (candidate list → owner pick) was honoured. The 2026-07-17 owner report
("PNGs incorrectly regenerated") was investigated BEFORE any fix — the
regeneration was exonerated and the real defects (committed baseline) became
.5c. Pillow could not be installed into the project `.venv` (persistent pip
hang, suspected AV — §4.1 pattern); the interpreter-probing launcher
(`run-crop.cjs`) makes the tool independent of which Python carries Pillow.
