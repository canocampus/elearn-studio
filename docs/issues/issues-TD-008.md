# Self-Review — TD-008: Manual-audit pass — 4 minor UI/UX bugs

**Status:** RESOLVED — all 4 bugs fixed and CI green
**Date:** 2026-04-18
**Version:** v0.5.62
**Commits:** `62153ca` (bugs #1-#3) + `de0ad2e` (bug #4)
**CI runs:** `24608241954` (bugs #1-#3, green 17 min) + `24608814942` (bug #4, green ~17 min)
**Scope doc (pre-requisite):** [`docs/user-manual-v2-scope.md`](../user-manual-v2-scope.md)

---

## Context

Before drafting the v2 user manual (`docs/user-manual-v2-scope.md`), we ran a functional audit of v0.5.61 (`docs/user-manual-v1.md` was too shallow and was written against an audit that surfaced four inconsistencies). This ticket closes all four in two commits so the manual can document correct UX, not workarounds.

## The four bugs

### #1 — `PhaserSimPreviewModal` layout stale on window resize (LOW)

- **Symptom:** Opening the Phaser preview modal captured `window.innerWidth` / `window.innerHeight` once at mount. Resizing the browser afterwards left the modal at its original size, clipping or overflowing.
- **Root cause:** Direct `window.inner*` reads in the render body (lines 79, 80, 126 of `PhaserSimPreviewModal.tsx`).
- **Fix:** Added `useState(viewport)` initialised from `window.inner*` with SSR guard (`typeof window !== 'undefined'`), and `useEffect` that registers a `'resize'` listener (+ cleanup on unmount). Replaced the three inline `window.inner*` references with `viewport.w` / `viewport.h`.
- **Files:** `packages/authoring-ui/src/components/simulation/PhaserSimPreviewModal.tsx` (+21 / −3).

### #2 — `properties: []` vs `{}` inconsistency across widget defaults (LOW)

- **Symptom:** Latent, no user-visible symptom at the time of the audit. Three "T608-era" widgets (`audio-narration`, `progress-bar`, `volume-control`) used `properties: []` in their component defaults; eleven other widgets used `properties: {}`. The converter's `NavButtonChildDef` type further declared `properties: Record<string, unknown>` (object shape).
- **Root cause:** GrapesJS's Style Manager `PropertyComposite` internally calls `new model_Properties(this.get('properties') || [], ...).forEach(...)`. Passing an object (`{}`) crashes with `TypeError: Cannot read properties of undefined (reading 'forEach')` inside `loadData` when the widget enters a code path that constructs a `PropertyComposite`. `GENERATED_CONTENT_TYPES` in `converters.ts` already omitted `properties` on load for the widgets known to crash, so the bug stayed latent — but the per-type inconsistency was a drift vector.
- **Fix:** Standardised every component default to `properties: []` (the format GrapesJS expects). Updated:
  - `registerBlocks.ts` — 11 widget defaults + 2 `nav-buttons` children.
  - `registerQuestionBlocks.ts` — 3 (MC/TF/Fill).
  - `registerSimBlock.ts` — 1 (`screenshot-sim`).
  - `registerPhaserSimBlock.ts` — 1 (`phaser-sim`).
  - `converters.ts` — `NavButtonChildDef.properties: []` with an inline comment documenting why, and the two sites in `grapesjsFromWidgets` that build `nav-buttons` children.
  - Test `registerBlocks.test.ts` — `expect(defaults?.properties).toEqual({})` → `toEqual([])` for all 14 types.
- **Scope note:** `converters.ts` BaseWidget-level `widget.properties: Record<string, unknown>` stays as-is — that is the MongoDB storage shape for user data, not the GrapesJS defaults. Only the GrapesJS component-def path was standardised.

### #3 — Phaser placeholder scene only fires `sim-complete` in demo mode (LOW)

- **Symptom:** In the placeholder scene used until T036 ships real per-simType scene builders, the `sim-complete` event fired only when `config.mode === 'demo'`. Practice and assessment modes rendered the placeholder label but never emitted completion, so a learner in those modes could not finish the course.
- **Verification that T036 was not in the immediate backlog:** `grep T036 tasks.md WORKING_CONTEXT.md` → 0 matches. Per the task-complete skill's Bug #3 instruction ("if T036 is NOT in backlog: fix now"), fixed directly.
- **Fix:** Removed the `if (config.mode === 'demo')` guard. All modes now auto-complete 2 s after mount. Score reported: `100` for demo/practice (unconditional pass — course progresses), `config.passingScore` for assessment (course meets the author's threshold). Added an inline comment explaining this is placeholder behaviour pending T036.
- **File:** `packages/runtime-player/src/widgets/phaserSimWidget.ts` (+8 / −5).

### #4 — Actions Editor dropdown shows cryptic widget IDs (HIGH UX)

- **Symptom:** Every widget has a "Name" trait editable in Props → Name. Authors set e.g. "HintButton". The Actions Editor `Show` / `Hide` / `Play Media` / `Score Question` dropdown then showed `c32kq3`, `df12x8`, `a9p2lo` — the auto-generated GrapesJS IDs — not the names.
- **Root cause:**
  1. `converters.ts::widgetsFromGrapesjs` did not extract the `name` trait to a top-level field; it leaked into `widget.properties.name` via the T611 attribute restoration loop but was never surfaced.
  2. `ActionItemEditor.tsx:190-195` rendered `<option value={w.id}>{w.id}</option>` — same ID as label.
- **Fix (3 places, all behind the same invariant: `id` stays the technical routing key, `name` becomes the display label):**
  1. `packages/shared-types/src/widgets.ts` — added `BaseWidget.name?: string`. Optional for backward compatibility with courses saved before this field existed.
  2. `packages/authoring-ui/src/editor/converters.ts` — `widgetsFromGrapesjs` now reads `c.get('name') ?? attributes.name ?? ''`, trims, and populates `widget.name` (omitted when empty to keep storage tidy). `grapesjsFromWidgets` restores `attributes.name = widget.name` on reload when present.
  3. `packages/authoring-ui/src/components/actions/ActionItemEditor.tsx:190-197` — `<option>` label changed to `{w.name || w.id}`. `value` untouched.
- **Backward compatibility:** Courses saved before TD-008 have the name inside `widget.properties.name` (carried by the T611 attribute loop). On next reload, `grapesjsFromWidgets` copies it to `attributes.name` via that same loop, `widgetsFromGrapesjs` then reads it via `attributes.name` → new top-level `widget.name`. Verified by the dedicated test "falls back gracefully when only properties.name exists (legacy courses)".

## Tests added (6 new, all in `converters.test.ts`)

New describe block `Bug #4 — name trait round-trip for Actions Editor dropdown`:

1. `widgetsFromGrapesjs reads the name trait from model into widget.name`
2. `widget.name is undefined when the name trait is blank` — guards against empty-string leakage.
3. `grapesjsFromWidgets restores widget.name into def.attributes.name`
4. `grapesjsFromWidgets does not set attributes.name when widget.name is absent`
5. `full round-trip preserves the name trait` — `widget → def → component → widget` cycle.
6. `falls back gracefully when only properties.name exists (legacy courses)` — backward-compat guard.

## Verification

| Check | Result |
|---|---|
| `npx tsc -b packages/shared-types packages/authoring-ui packages/runtime-player` | **EXIT 0** |
| `pnpm -C packages/authoring-ui test -- --run` | **761/761 pass** (was 755; +6 round-trip tests) |
| `pnpm -C packages/runtime-player test -- --run` | **265/265 pass** |
| `pnpm lint` | 0 errors (2 historical TD-004 warnings unchanged) |
| CI run `24608241954` (bugs #1-#3) | **success** (17 min, incl. full E2E) |
| CI run `24608814942` (bug #4) | **success** (~17 min, incl. full E2E) |

## What this ticket does NOT do

- **Does not** modify the MongoDB `widget.properties` storage shape (stays `Record<string, unknown>`). Only GrapesJS component-def defaults were standardised to `[]`.
- **Does not** implement T036 (per-simType Phaser scene builders). Bug #3 is a placeholder tweak; real scenes remain future work.
- **Does not** migrate legacy course documents: courses saved before TD-008 that have `name` inside `properties` continue to work via the fallback path.
- **Does not** touch any production code outside the 8 files listed in the verification table above.

## Open issues

CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 0

Block closed.

## Unblocks

User manual v2 §3 (Actions Editor chapter) — now authors can be told "name your widget in Props → Name and it appears as that name in the dropdown" instead of documenting the cryptic-ID limitation as a workaround.
