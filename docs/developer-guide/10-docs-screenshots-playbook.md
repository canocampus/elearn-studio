# 10 — Docs Screenshots Playbook

Reference for regenerating the User Manual v2 screenshots under `docs/user-guide/assets/screenshots/`.

The capture campaign lives in `e2e/tests/docs-screenshots.spec.ts` — an authoring utility driven by Playwright, **not** a regression test. It re-creates the course state needed for every placeholder in `docs/user-guide/*.md` and writes the PNGs in one pass. This document explains the non-obvious techniques it uses so future re-runs keep producing the same images when the UI changes.

Read this before:

- Re-running the campaign after a UI change that shifts widget layout, panel testids, or action-palette labels.
- Adding new placeholders to the manual.
- Touching anything in `e2e/utils/screenshot.ts` or `e2e/tests/docs-screenshots.spec.ts`.

---

## Prerequisites

1. Docker dev stack up (for Moodle §16 capture):
   ```bash
   docker compose -f docker/docker-compose.dev.yml --profile moodle up -d
   ```
   Moodle reaches `http://localhost:8081` with `admin` / `Admin1234!` by default. Override with `MOODLE_BASE_URL`, `MOODLE_ADMIN_USER`, `MOODLE_ADMIN_PASSWORD` env vars.

2. Dev servers running:
   ```bash
   pnpm dev
   ```
   The authoring UI must be reachable at `http://localhost:3000` with `__elearn_editor` exposed on `window` (DEV build or `VITE_E2E_MODE=true`).

3. Playwright browsers installed:
   ```bash
   pnpm --filter @elearn-studio/e2e exec playwright install chromium
   ```

---

## Running the campaign

```bash
pnpm --filter @elearn-studio/e2e docs:screenshots
```

This runs:

```
playwright test tests/docs-screenshots.spec.ts --headed && node ../scripts/run-crop.cjs
```

`--headed` is intentional — so the author can see which captures land correctly and catch UI drift early. **Do not interact with the headed window while the campaign runs** — clicks/closes destroy Playwright evaluation contexts mid-build. PNGs land in `docs/user-guide/assets/screenshots/`. The chained `run-crop.cjs` step is the Python post-crop fallback (T-17); it can also be run standalone via `pnpm --filter @elearn-studio/e2e docs:crop`.

Expected output per run (since TD-013.5c, 2026-07-18):

- **55/55 final PNGs** — every placeholder in the manual is automated; no `TODO_MANUAL` remains.
- **`08-scoring-section-fullpage.png`** — the only *by-design* safety net, captured unconditionally each run as the fresh same-render source for the T-17 mtime-idempotent crop fallback.
- Any **other** `*-fullpage.png` in the output means a primary capture failed that run — diagnose before committing (see the per-technique notes below).

Single-worker, serial — the seed course state is carried forward across all captures so the spec does not rebuild everything per shot (§17 additionally creates a second course — see T-18). Test timeout: 10 minutes.

---

## Filename conventions

| Pattern | Source | Meaning |
|---|---|---|
| `NN-name.png` | `capture()` / `captureElement()` / `page.screenshot()` | Final asset, ready to embed |
| `NN-name-fullpage.png` | `captureFullPage()` | Whole-viewport safety net — needs manual crop |
| `NN-name.png` via `page.screenshot({ fullPage: false })` | direct call | Clean-filename viewport shot (bypasses the `-fullpage` suffix that `captureFullPage` always appends) |

`captureFullPage()` **always** appends `-fullpage.png` to the filename. If you want the final asset named `15-popup-rendered.png`, call `popup.screenshot()` or `page.screenshot()` directly — this is what §15 and §17 do.

---

## Techniques used by the spec

Each technique below is a specific workaround for a Playwright / browser / app constraint that kept a naive capture from working. If you change the spec, preserve the workaround — every one of them is a scar from an observed failure during the original campaign.

### T-1 — Defensive fallback for every capture

Every capture is wrapped in `try/catch` and falls back to `captureFullPage()` on failure. A single missing panel never aborts the whole campaign; the author can crop the safety net by hand.

```typescript
try {
  await captureElement(page, RIGHT_SIDEBAR, { filename, timeout: 3000 })
} catch {
  await captureFullPage(page, filename)
}
```

### T-2 — Tall-panel capture (viewport resize + CSS neutralisation)

Several right-sidebar panels exceed 720 px when populated — MC question Scoring, Phaser Sim builders, Shared Sequences library, Actions palette, action rows. Three constraints stack:

1. `overflow: auto` on the panel root.
2. `flex-shrink` from the `ActionsPanel` flex column.
3. Viewport height (720 px by default) caps the visible area.

**Solution — `captureTallWidgetProps(filename, panelTestId)`:**

- Temporarily resize viewport: `page.setViewportSize({ width, height: 3000 })`.
- Inject a stylesheet that sets `overflow: visible !important; max-height: none !important; height: auto !important; flex: 0 0 auto !important` on the panel testid and on the parent `aside[aria-label="Properties"]`.
- Read `panel.boundingBox()` AFTER `scrollIntoView`.
- Call `page.screenshot({ fullPage: true, clip: box })` — `fullPage: true` forces Playwright to render at natural document height so clips past the viewport are honoured.
- Restore viewport + remove stylesheet in `finally`.

Used for: §10 action palette + action rows (Navigate, Set Variable, If/Else), §11 recipe-attempts + shared-sequences library, §14 Phaser Sim builders (process-flow, diagram, gamified-quiz, JSON example).

**Why not `locator.screenshot()`?** It scrolls the sidebar's internal scrollbar before the capture; the clip ends up on the wrong region. Only `page.screenshot({ fullPage: true, clip })` gives deterministic coordinates at full document height.

### T-3 — Native `<select>` size-expand trick

Native `<select>` popups close the moment a screenshot is taken (the browser dismisses the overlay as "focus lost"). The trick:

```typescript
await selectEl.evaluate((el: HTMLSelectElement) => {
  el.dataset['originalSize'] = String(el.size)
  el.size = el.options.length
})
// Now the <select> renders as an inline listbox with all options visible
await captureElement(page, simTypeSelector, { filename, padding: 20 })
// Restore the original size so the UI returns to dropdown rendering
await selectEl.evaluate((el: HTMLSelectElement) => {
  el.size = Number.parseInt(el.dataset['originalSize'] ?? '0', 10) || 1
  delete el.dataset['originalSize']
})
```

Used for: `14-builder-types.png` (Phaser Sim type dropdown).

### T-4 — `ensureWidgetIsCentered` after every `addBlockById`

`editor.addComponents(...)` places widgets at canvas origin `(0, 0)`, not where a real drag-drop would land them. Thumbnails end up top-left-clipped.

`ensureWidgetIsCentered(page, blockId, x=400, y=250)` runs the same mutation `initEditor.ts::block:drag:stop` performs for real drag-drops: `component.addStyle({ position: 'absolute', left, top })`. Apply it after every `addBlockById` so the captured slide looks like an authored one.

### T-5 — Re-locate widgets after slide switches (IDs regenerate)

GrapesJS regenerates component IDs on reload. The `mcId` captured in §08 is **invalid** by the time §11 runs because several slide switches happened between the two sections (the `storageManager` loads the slide fresh each hop).

**Solution in §11:**

```typescript
const mcIdFresh = await page.evaluate(() => {
  const ed = (window as Record<string, unknown>).__elearn_editor as { getWrapper: ... }
  // Prefer scanning by data-widget attribute (set by registerQuestionBlocks)
  const byAttr = ed.getWrapper().find('[data-widget="question-mc"]')[0]?.getId()
  if (byAttr) return byAttr
  // Fallback: walk top-level components looking for type==='question-mc'
  ...
})
if (!mcIdFresh) {
  // Seed a fresh MC widget if autosave flakiness dropped the original
  mcIdFresh = await addBlockById(page, 'question-mc', 'RecipeTarget')
}
```

Never cache an ID across a `goToSlide()`.

### T-6 — Deselect via Escape, NOT `editor.select(null)` evaluate (superseded 2026-07-18)

Clean-canvas shots need the selection cleared so the Props aside shows its empty state instead of a stale widget panel. The original technique (`page.evaluate(() => ed?.select(null))`) is **retired**: during the TD-013.5c §17 build that exact evaluate died with `Execution context was destroyed` on every run at the same build point — with instrumentation proving no navigation, no vite reload, no page error, and a surviving page (full evidence in `docs/issues/issues-TD-013.md`; root-cause investigation tracked as TD-020).

```typescript
await page.keyboard.press('Escape')   // real-UI deselect
await page.waitForTimeout(200)
```

The remaining §17 evaluates are wrapped in `retryOnDestroyedContext()` as defence in depth. Do not reintroduce evaluate-based deselection until TD-020 explains the destruction.

### T-7 — Clean-filename bypass for `page.screenshot()` / `popup.screenshot()`

`captureFullPage()` always appends `-fullpage.png` (by design — the suffix flags safety-net shots that still need manual cropping). For captures that should emit a final, already-cropped asset from a whole-viewport shot, call `page.screenshot()` or `popup.screenshot()` directly:

- §15 `15-popup-rendered.png` — `popup.screenshot({ fullPage: true })`.
- §17 `17-slide-N-final.png` — `page.screenshot({ fullPage: false })`.

This is the only way to have "whole page/viewport" semantics with a clean filename.

### T-8 — `pasteSceneDef` + `selectOption` sequencing (§14)

The Phaser Sim builder only renders its sub-sections (Nodes, Edges, Steps, Hotspots, Quiz) when both conditions hold:

1. `simType` dropdown matches the builder.
2. `sceneDef` JSON in the textarea is valid and parses to the expected shape.

**Sequence:**

```typescript
await simTypeSelect.selectOption('interactive-diagram', { timeout: 5000 })
await page.waitForTimeout(300)  // let React re-render the builder skeleton
await pasteSceneDef(JSON.stringify({ simType: 'interactive-diagram', ... }, null, 2))
await captureTallWidgetProps('14-diagram-builder.png', 'phaser-sim-properties-panel')
```

`pasteSceneDef` fills the textarea, fires `blur` (the panel listens to `onBlur` to parse-and-persist), and waits 400 ms for the builder to re-render. Change the order (fill before select) and the JSON is parsed against the previous simType's shape → silently dropped → builder stays empty.

### T-9 — Event-menu toggle close (§10)

`10-event-selector.png` captures the "+ Event" dropdown open. Once the shot is taken, the menu stays open and occludes every subsequent action-row capture. The spec closes it in `finally`:

```typescript
finally {
  // Try re-clicking the toggle
  if (await page.locator('[role="menu"]').count() > 0) {
    await addEventButton.click({ timeout: 1500 }).catch(() => undefined)
  }
  // Safety: click the sidebar background as a force-close
  if (await page.locator('[role="menu"]').count() > 0) {
    await page.locator(RIGHT_SIDEBAR).click({
      position: { x: 10, y: 10 }, timeout: 1500,
    }).catch(() => undefined)
  }
}
```

Always close overlays before moving on.

### T-10 — Moodle context in §16

SCORM upload placeholder needs a real LMS screenshot. The spec opens a **fresh browser context** (different cookie jar, different origin) for Moodle:

1. `page.context().browser()!.newContext()` — isolated from the authoring-UI session.
2. Log in at `/login/index.php`.
3. Navigate to `/admin/settings.php?section=modsettingscorm` — an admin surface explicitly referencing "SCORM package", closer to the placeholder intent than the bare dashboard.
4. `moodlePage.screenshot({ fullPage: false })` — clean filename.
5. `moodleContext.close()`.

Fallback: if Moodle is unreachable, `captureFullPage` emits a safety net from the editor. Rebuild Moodle if the healthcheck is red:

```bash
docker compose -f docker/docker-compose.dev.yml --profile moodle up -d --force-recreate
```

The healthcheck uses an array-form `CMD` (not `CMD-SHELL`) to avoid the `$` in the PHP oneliner being eaten by `sh` — see `docker-compose.dev.yml:198`.

### T-11 — Category-by-index block-sidebar crops (§04–§08, §12)

`.gjs-block-category` has no stable text selector (the header markup varies between collapsed/expanded states). Instead, the spec targets by positional index — the order reflects registration order in `registerBlocks.ts` / `registerQuestionBlocks.ts` / `registerSimBlock.ts`:

| Index | Category |
|---|---|
| 0 | Basic |
| 1 | Navigation |
| 2 | Assessment |
| 3 | Media |
| 4 | Questions |
| 5 | Simulations |

If a new category is added, re-number this table AND the `CATEGORY_INDEX` constant in the spec.

### T-12 — `ensureClickEvent()` guard (§09)

The `EventSelector` hides the `+ Event` button once every event is already added. On a second run against the same widget (during iteration), the menu path no longer exists. The spec guards for this:

```typescript
async function ensureClickEvent(): Promise<void> {
  // EventSelector does NOT use role="tab" — each event renders as a
  // <div role="group" aria-label="Click"> with a toggle <button>
  // (EventSelector.tsx:33-45). Querying role="tab" always returned 0 hits,
  // silently re-opening the +Event menu on second runs (fixed in TD-013.4).
  const clickGroup = page.getByRole('group', { name: /^Click$/i })
  if (await clickGroup.count() > 0) return  // already there, no-op
  try {
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await page.getByRole('menuitem', { name: /^Click$/i }).click({ timeout: 5000 })
  } catch { /* best effort — close any half-open menu in the catch */ }
}
```

Apply the same pattern any time you add a second event to a widget that may already carry it. §17's generalised `ensureEvent(label)` follows the same structure for arbitrary events (Click, Question Correct, Enter Slide).

### T-13 — Callouts overlay via `addCallouts()` (§01)

`01-full-ui-annotated.png` needs 9 numbered circles over UI regions. `addCallouts(page, specs)` (in `e2e/utils/screenshot.ts`) injects a `position:fixed` DOM layer above everything (`z-index` max), one 32 px circle per spec, positioned from the target element's `getBoundingClientRect()`. Pair with `removeCallouts()` in `finally` so downstream shots stay clean.

Each spec's `offset` is **per-axis optional** (TD-013.5c): omit an axis to keep the circle centred on it. The five right-panel tab callouts use `offset: { y: 58 }` so the circle drops *below* its tab — pointing at it without covering the label.

### T-14 — New Course dialog + genuine first-slide capture (§02)

- `02-create-course.png`: the dialog opens from the top toolbar's **New Course** button (no dashboard navigation needed). Crop the modal via its `[role="dialog"][aria-label="New Course"]` selector, then **Cancel** so the editor state stays untouched.
- `02-first-slide.png` is captured inside the §17 block (T-18), right after the worked-example course is created — the only moment the UI genuinely shows a just-created course with a single empty slide. Capturing it from the scratch course's "empty slide 5" rendered a misleading five-slide list (baseline defect, fixed 2026-07-18).

### T-15 — Zustand direct-sync for widget-name dropdowns (§09)

`WidgetIdParam` renders its named-option `<select>` only when the Zustand course store has widgets for the current slide — and Zustand is only repopulated on full page reload (whose save round-trip strips `name` traits; see T-19 caveat in `issues-TD-013.md`). The spec syncs Zustand directly instead: read the live GrapesJS component tree via `window.__elearn_editor`, derive `{id, name, type, bounds, layer}` per widget, and `window.__elearn_store.setState(...)` the current slide's `widgets` array. No reload, no round-trip, names stay authoritative.

### T-16 — Sim Editor overlay captures via pure real-UI flow (§13)

`13-overview.png` + `13-hotspot-editor.png` drive the real authoring surface end-to-end — zero store seeding (owner principle: *"todas las funcionalidades dadas por operativas tienen que poder usarse y reproducirse"*): dblclick the widget → overlay opens → `+ Add step` ×2 with per-step screenshot upload (`input[type=file]` + fixture image) → select step 0 → capture overlay (`sim-editor-overlay` testid) → draw the hotspot with a real `page.mouse` gesture on the Konva stage (0.15/0.85 inset) → capture canvas area (`sim-canvas-area`) → Cancel. `__simStore` is read-only verification (polling the hotspot commit), never a seeding mechanism. Helpers live in `e2e/utils/simulation.ts`, shared with `simulation-editor.spec.ts`.

### T-17 — Python post-crop fallback (`scripts/crop-screenshots.py`)

Dual-strategy captures (currently `08-scoring-section.png`) emit their `-fullpage.png` safety net **unconditionally first**, then attempt the primary testid capture. The chained post-step (`scripts/run-crop.cjs` → `crop-screenshots.py`, config in `scripts/screenshots-crop.json`) then applies **mtime idempotence**: if the final PNG is at least as new as its source, the primary capture won and the entry is skipped; otherwise the tool crops the configured rect (plus optional padding/callouts) from the fresh same-render source. Missing source or invalid config exits non-zero so a chained run fails loudly. `_`-prefixed JSON keys are ignored (comments). The launcher probes interpreters for Pillow (`py -3` → `python` → `python3` on Windows) because a project venv without Pillow may shadow the system Python.

### T-18 — Worked-example course build (§17 + §02)

§17's five finals show the *finished* "Capitals of Europe" course from `17-worked-example.md`, built for real in a **second course** (created via the New Course dialog; `globalTeardown` deletes every course owned by the E2E user, so no bespoke cleanup):

- **A Blank course starts with 0 slides** — wait for the toolbar title to confirm the course switch, `addSlide()` once, and only THEN wait on the editor ready signal (the canvas never mounts, and `data-editor-ready` never appears, while the course has no slides).
- **Explicit per-widget coordinates** — every `placeAt(type, name, x, y, size?)` passes distinct positions; never rely on `ensureWidgetIsCentered`'s defaults for more than one widget per slide (stacked-centring was the §17 baseline defect).
- **Action wiring happens in each final's prep, immediately before its shot** — sequences wired during the build phase did NOT survive the intervening slide switches (ids regenerate → sequences orphan; filed as TD-015). Widgets are re-resolved by their persisted `[name]` DOM attribute (`idByName`), since the `name` *trait* is stripped by the round-trip (TD-019).
- **Nested action params** (inside the If/Else condition row) must be targeted by placeholder *within the condition row* — nested rows don't carry their own `data-action-type` wrapper.
- **Finals at 1600×900** — at 1280×720 the canvas viewport clips the 1024×768 slide's right third. Resize, wait ~600 ms for relayout, shoot with clean-filename `page.screenshot()` (T-7), restore in `finally`.
- Known product quirks visible in the shots (filed for triage): nav-buttons renders with a broken Previous button (TD-016); done-button ignores label edits (TD-018); slide-level actions are wired on `BranchingNote` because the ActionsPanel has no no-selection path (TD-017 — the manual currently documents one).

---

## Historical deferrals — now automated

Everything in the original "Deferred placeholders" table has been automated. Kept for the paper trail:

| Placeholder | Automated by | Technique |
|---|---|---|
| `01-full-ui-annotated.png` | TD-013.1 (+ .5c offset fix) | T-13 |
| `02-create-course.png` | TD-013.2 | T-14 |
| `02-first-slide.png` (genuine) | TD-013.5c | T-14 / T-18 |
| `09-widget-name-field.png` | TD-013.3 (NameField component) | — |
| `09-widget-dropdown-names.png` | TD-013.4 | T-15 |
| `13-overview.png` / `13-hotspot-editor.png` | TD-013.5 (unblocked by TD-014) | T-16 |
| `08-scoring-section.png` (deterministic crop) | TD-013.5b / .6 | T-17 |
| `17-slide-N-final.png` (real worked example) | TD-013.5c | T-18 |

If a placeholder regresses to needing manual work, re-add a Deferred row AND file the regression.

---

## Checklist before committing regenerated screenshots

1. Diff the PNG set: `git status docs/user-guide/assets/screenshots/`.
2. Open every modified PNG and confirm the content looks right (widgets centred, panels populated, no occluding menus).
3. Revert any PNG whose only change is antialiasing / timing drift — noise commits churn the git history without value. Use `git checkout -- <file>` for pixel-drift-only files.
4. Keep new captures whose layout intentionally changed.
5. Commit the spec changes + the PNGs together so the capture logic and its output are one coherent unit.

A pass-by-pass commit cadence (`pass 1 — §09+§10`, `pass 2 — §14 sim builders`, etc.) makes regressions bisectable — prefer it over "regen all" commits.

---

## When to update this document

- New placeholder section added to the manual → add a row to the Deferred table (if applicable) or document the new capture technique here.
- New technique used in the spec → add a numbered `T-N` entry with the failing naive approach, the fix, and the affected section.
- Filename convention changes → update §Filename conventions and the relevant `T-N` entries.

Keep the layout symmetric with `e2e/tests/docs-screenshots.spec.ts` — every `§NN` section in the spec should be locatable from this playbook.
