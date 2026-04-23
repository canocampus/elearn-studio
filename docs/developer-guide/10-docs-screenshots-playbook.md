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
playwright test tests/docs-screenshots.spec.ts --headed
```

`--headed` is intentional — so the author can see which captures land correctly and catch UI drift early. PNGs land in `docs/user-guide/assets/screenshots/`.

Expected output per run:

- **~30 final PNGs** ready to embed in the manual (e.g. `04-text-props.png`, `10-action-palette.png`).
- **~15 `*-fullpage.png` safety nets** for placeholders that need a manual crop after the run.
- **A handful of `TODO_MANUAL` placeholders** the spec intentionally does not attempt (see §Deferred below).

Single-worker, serial — the seed course state is carried forward across all captures so the spec does not rebuild everything per shot. Test timeout: 10 minutes.

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

### T-6 — `editor.select(null)` before slide captures

§17 loops over all 5 slides and shoots "canvas + right sidebar" for each. Without clearing the selection between slides, the Props aside inherits the previous slide's panel state (stale widget selected → wrong panel showing).

```typescript
await page.evaluate(() => {
  const ed = window.__elearn_editor  // typed via T-A augmentation (see §A)
  ed?.select?.(null)
})
await page.waitForTimeout(300)
```

The 300 ms settling delay is deliberate — React's empty-state transition commits after `select(null)` and needs a microtask + layout pass before the shot.

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
  const eventList = page.getByRole('tab', { name: /^Click$/i })
  if (await eventList.count() > 0) return  // already there, no-op
  try {
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await page.getByRole('menuitem', { name: /^Click$/i }).click({ timeout: 5000 })
  } catch { /* best effort */ }
}
```

Apply the same pattern any time you add a second event to a widget that may already carry it.

---

## Deferred placeholders

Intentionally NOT captured by the spec. The reason is documented inline; these need human intervention or a separate block.

| Placeholder | Section | Why deferred |
|---|---|---|
| `02-create-course.png` | §02 Getting Started | "New Course" dialog lives in the dashboard (outside the editor). Requires navigating to the course list + capturing the modal — adds login-screen setup cost that outweighs the single-shot benefit. Capture manually. |
| `09-widget-name-field.png` | §09 Actions Editor | Name trait lives inside GrapesJS traits, not a React Props panel. The spec falls back to a full-page safety net — a UX refactor is the proper fix, not a screenshot trick. |
| `09-widget-dropdown-names.png` | §09 Actions Editor | `WidgetIdParam` only renders a `<select>` (vs a free-form `<input>`) when the **Zustand** course store has widgets for the current slide. The Zustand course is populated at App bootstrap from `getCourse(id)` and is **not** mutated by the autosave pipeline — widgets added in the session only land in the store on page reload. Forcing `editor.store()` hits the backend but does not re-populate Zustand either. Candidate for a separate refactor block; the spec emits the fullpage safety net. |
| `13-overview.png` | §13 Software Walkthrough | Requires Simulation Editor state loaded with a recorded session — not reproducible from a clean spec run. |
| `13-hotspot-editor.png` | §13 Software Walkthrough | Same as above — needs drawn hotspots on an uploaded screenshot. |
| `01-full-ui-annotated.png` | §01 Welcome | The spec writes a clean full-page shot; numbered callouts (1 top toolbar, 2 left sidebar, 3 canvas, 4 right sidebar) are added in an image editor after the run. Annotating in Playwright across iframes is brittle. |

If you close one of these, add the corresponding capture block to the spec and update this table.

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
