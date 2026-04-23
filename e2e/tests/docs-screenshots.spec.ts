/**
 * docs-screenshots.spec.ts — User Manual v2 capture campaign
 *
 * Generates PNGs referenced by `<!-- screenshot: ... -->` placeholders in
 * `docs/user-guide/*.md`. This is an AUTHORING UTILITY, not a regression test.
 *
 * ## Canonical reference
 *
 * See `docs/developer-guide/10-docs-screenshots-playbook.md` for:
 *   - Prerequisites (dev stack, Moodle docker, Playwright browsers)
 *   - Every non-obvious technique used below (T-1…T-12) with the reason
 *   - Deferred placeholders and why they are not scripted
 *   - Commit/review checklist before pushing regenerated PNGs
 *
 * Anyone modifying this spec MUST read that playbook first. Each workaround
 * here exists because a naive approach failed during the original campaign —
 * preserve the workaround or update both the spec AND the playbook together.
 *
 * ## How to run
 *
 *     pnpm --filter @elearn-studio/e2e docs:screenshots
 *
 * The `--headed` flag is set by the npm script so the author can see which
 * captures land correctly. Images are written to
 * `docs/user-guide/assets/screenshots/`.
 *
 * ## Scope — 54 placeholders catalogued
 *
 * This script automates the straightforward ones (left-sidebar category
 * crops, Props panel crops after selecting a block, simple Actions-tab
 * compositions). For the hard-to-reach states (native <select> popups,
 * Simulation Editor with drawn hotspots, Preview popup from another
 * origin, complex Actions wiring), the script drives the UI as far as
 * it can and then emits a `*-fullpage.png` safety net via
 * `captureFullPage()` so the final crop can be produced manually from a
 * deterministic snapshot — much faster than reproducing the UI state by
 * hand from scratch.
 *
 * ## Expected output
 *
 * After a successful run, the folder should contain:
 *   - 55/55 final PNGs corresponding to every placeholder in the manual
 *   - `-fullpage.png` safety nets for captures whose primary path failed
 *     (defensive — if present, see the playbook to diagnose the regression)
 */

import { test, expect } from '../fixtures/auth'
import {
  addBlockById,
  addCallouts,
  capture,
  captureElement,
  captureFullPage,
  ensureWidgetIsCentered,
  removeCallouts,
  selectById,
  SCREENSHOTS_DIR,
} from '../utils/screenshot'

// This spec is single-worker, serial — the seed course state is carried
// forward between captures so we do not rebuild everything every shot.
// actionTimeout clamps every locator.click/fill so a broken step fails in
// seconds, not in the full 10-minute test budget.
test.describe.configure({ mode: 'serial', timeout: 600_000 })
test.use({ actionTimeout: 15_000 })

// ---------------------------------------------------------------------------
// One big test — inexpensive sequential captures against the same page.
// ---------------------------------------------------------------------------

// Stable container selectors — the AppLayout aside[aria-label=...] nodes are
// the only reliable anchors. Children (GrapesJS, custom panels) mount and
// unmount depending on which tab/widget is active, so we crop the wrapper.
const LEFT_SIDEBAR = 'aside[aria-label="Slide navigation"]'
const RIGHT_SIDEBAR = 'aside[aria-label="Properties"]'

test('Manual v2 screenshot campaign', async ({ editorPage, page }) => {
  // eslint-disable-next-line no-console
  console.log('[docs-screenshots] writing to', SCREENSHOTS_DIR)

  // Defensive crop helper — any widget that lacks a custom Props panel (Text,
  // Image, Rectangle) will render empty states. We still produce SOMETHING
  // for every placeholder: a right-sidebar crop when possible, a full-page
  // safety net otherwise. The spec never aborts on a single missing crop.
  async function safeCaptureRightPanel(filename: string): Promise<void> {
    try {
      await captureElement(page, RIGHT_SIDEBAR, {
        filename,
        timeout: 3000,
      })
    } catch {
      await captureFullPage(page, filename)
    }
  }

  async function safeCaptureLeftSidebar(filename: string): Promise<void> {
    try {
      await captureElement(page, LEFT_SIDEBAR, {
        filename,
        timeout: 3000,
      })
    } catch {
      await captureFullPage(page, filename)
    }
  }

  // Capture one of the per-widget PropertiesPanels, identified by its
  // `data-testid` (e.g. `button-properties-panel`). Two real-world caveats:
  //
  //   1. Every PropertiesPanel in AppLayout returns its own "Select a X
  //      widget" empty state when the active component doesn't match. That
  //      means a question panel is followed by 5-6 empty-state divs below it.
  //      Targeting the specific testid skips them.
  //
  //   2. The panel root is `overflow-y: auto; flex: 1` inside a
  //      viewport-height aside, so tall content (e.g. MC question's Scoring
  //      section) is clipped by the scroll container. A temporary stylesheet
  //      neutralises the constraint so locator.screenshot() captures the
  //      full laid-out panel, not just the visible window.
  async function captureWidgetProps(
    filename: string,
    panelTestId: string,
  ): Promise<void> {
    const style = await page.addStyleTag({
      content: `[data-testid="${panelTestId}"] {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        flex: 0 0 auto !important;
      }`,
    })
    try {
      await captureElement(page, `[data-testid="${panelTestId}"]`, {
        filename,
        timeout: 3000,
      })
    } catch {
      await captureFullPage(page, filename)
    } finally {
      await style.evaluate((el: Node) => {
        if (el instanceof Element) el.remove()
      })
    }
  }

  // Switch the left sidebar to the Slides tab before clicking a slide item.
  // Without this, slide-item nodes still exist in the DOM but are hidden by
  // display:none when the Blocks tab is active — the click times out.
  async function goToSlide(index: number): Promise<void> {
    await editorPage.slidesTab.click()
    await page.locator('[data-testid="slide-item"]').nth(index).click()
    await editorPage
      .readySignal()
      .waitFor({ state: 'attached', timeout: 15_000 })
  }

  // -------------------------------------------------------------------------
  // Seed — 5 slides with named, pre-configured blocks.
  // -------------------------------------------------------------------------
  //
  // The `editorPage` fixture already created a fresh course and the editor
  // is ready. Build four more slides (the first one exists) so the Slides
  // tab shows five entries in §03's capture.
  //
  // For robustness, slide additions and block placements go through the
  // normal UI flow where possible so we exercise the real authoring paths.

  // Seed exactly 5 slides regardless of the course's initial state.
  // The fixture currently creates a course with 0 slides, but older fixtures
  // produced 1; looping is resilient to either.
  const targetSlides = 5
  const slideList = page.locator('[data-testid="slide-item"]')
  let count = await slideList.count()
  while (count < targetSlides) {
    await editorPage.addSlide()
    count = await slideList.count()
  }
  await expect(slideList).toHaveCount(targetSlides)

  // Optional: name slide 1 "Intro" for nicer screenshots. Best-effort — if
  // the rename UI is not wired on this build, the default title survives.
  try {
    await slideList.first().dblclick({ timeout: 3000 })
    await page.keyboard.type('Intro')
    await page.keyboard.press('Enter')
  } catch {
    /* rename UI may vary — not critical */
  }

  // Go back to slide 1 for the initial captures.
  await slideList.first().click()
  await editorPage.readySignal().waitFor({ state: 'attached', timeout: 15_000 })

  // -------------------------------------------------------------------------
  // §01 — Welcome (T-13 callouts overlay, TD-013.1)
  // -------------------------------------------------------------------------

  // 01-full-ui-annotated — full-screen with 9 numbered callouts overlaid in
  // the DOM via addCallouts() (a fixed-position absolute layer above the UI).
  // Callouts removed in finally so downstream captures stay clean.
  //   (1) top toolbar
  //   (2) left sidebar (slide navigation)
  //   (3) canvas area (GrapesJS iframe host)
  //   (4) right sidebar container (Properties aside)
  //   (5) Layers tab   (6) Styles tab   (7) Props tab
  //   (8) Actions tab  (9) Anim tab
  //
  // Tabs targeted via the `role="tablist" aria-label="Right panel tabs"`
  // container's :nth-child — no production testid needed for those. Top
  // toolbar uses the [data-testid="top-toolbar"] added to TopToolbar.tsx.
  try {
    // Make sure the right sidebar shows the default Layers tab so the
    // tablist is laid out in its baseline form (all 5 tabs visible).
    await editorPage.layersTab.click().catch(() => undefined)
    await page.waitForTimeout(200)
    await addCallouts(page, [
      // Toolbar — default centre overlaps the "+ New Course" button; offset
      // into the gap between the course title and the first button.
      { number: 1, selector: '[data-testid="top-toolbar"]', offset: { x: 400, y: 24 } },
      { number: 2, selector: 'aside[aria-label="Slide navigation"]' },
      { number: 3, selector: 'main' },
      { number: 4, selector: 'aside[aria-label="Properties"]' },
      { number: 5, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(1)' },
      { number: 6, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(2)' },
      { number: 7, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(3)' },
      { number: 8, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(4)' },
      { number: 9, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(5)' },
    ])
    await page.waitForTimeout(150) // let the overlay paint
    await capture(page, { filename: '01-full-ui-annotated.png', fullPage: true })
  } finally {
    await removeCallouts(page)
  }

  // -------------------------------------------------------------------------
  // §02 — Getting Started (T-14 dashboard dialog, TD-013.2)
  // -------------------------------------------------------------------------

  // 02-create-course — the New Course dialog is opened from the top toolbar's
  // "New Course" button (NOT to be confused with the "+ New Slide" button).
  // The dialog renders a title input + a grid of 5 templates (Blank, Linear
  // Course, Software Tutorial, Process Training, Assessment Only). We crop
  // the modal via its aria-label so the capture is insensitive to the
  // background editor's state.
  try {
    await page.getByRole('button', { name: 'New Course', exact: true }).click({ timeout: 5000 })
    const newCourseDialog = page.locator('[role="dialog"][aria-label="New Course"]')
    await newCourseDialog.waitFor({ state: 'visible', timeout: 5000 })
    await page.waitForTimeout(200) // let the template grid render
    await captureElement(page, '[role="dialog"][aria-label="New Course"]', {
      filename: '02-create-course.png',
      padding: 20,
    })
    // Cancel so the editor state stays identical to pre-click.
    await newCourseDialog.getByRole('button', { name: 'Cancel' }).click({ timeout: 5000 })
    await newCourseDialog.waitFor({ state: 'hidden', timeout: 5000 })
  } catch {
    await captureFullPage(page, '02-create-course.png')
  }

  // 02-first-slide — empty editor view (use slide 5 which is still empty).
  await goToSlide(4)
  await capture(page, { filename: '02-first-slide.png', fullPage: true })

  // Return to slide 1 for subsequent captures.
  await goToSlide(0)

  // -------------------------------------------------------------------------
  // §03 — Slides
  // -------------------------------------------------------------------------

  // 03-slides-tab — left sidebar with 5 slides visible.
  // (Slide names are their defaults unless the rename above succeeded.)
  await editorPage.slidesTab.click()
  await safeCaptureLeftSidebar('03-slides-tab.png')

  // -------------------------------------------------------------------------
  // §04 — Basic Blocks
  // -------------------------------------------------------------------------

  await editorPage.blocksTab.click()

  // Block categories live in the left sidebar. Rather than match by text
  // (`:has-text()` is unreliable when the header is rendered in a collapsed
  // or shadowed element), target by positional index — the first-seen
  // registration order in registerBlocks.ts / registerQuestionBlocks.ts /
  // registerSimBlock.ts determines GrapesJS's category ordering. Verified
  // empirically from the generated thumbnails (run 2026-04-18):
  //   0=Basic, 1=Navigation, 2=Assessment, 3=Media, 4=Questions, 5=Simulations.
  const CATEGORY_INDEX: Record<string, number> = {
    Basic: 0,
    Navigation: 1,
    Assessment: 2,
    Media: 3,
    Questions: 4,
    Simulations: 5,
  }
  async function safeCategoryShot(filename: string, name: string): Promise<void> {
    const idx = CATEGORY_INDEX[name] ?? 0
    try {
      const cat = page.locator('.gjs-block-category').nth(idx)
      await cat.scrollIntoViewIfNeeded({ timeout: 3000 })
      await cat.screenshot({ path: SCREENSHOTS_DIR + '/' + filename })
      // eslint-disable-next-line no-console
      console.log(`[docs-screenshots] wrote ${filename} (category nth=${idx})`)
    } catch {
      await safeCaptureLeftSidebar(filename)
    }
  }

  // 04-basic-blocks-category — left sidebar cropped to the Basic category.
  await safeCategoryShot('04-basic-blocks-category.png', 'Basic')

  // Basic blocks: Text / Image / Rectangle surface their props via GrapesJS
  // Style Manager (Styles tab), not the custom Props tab. Only Button has a
  // dedicated ButtonPropertiesPanel.
  const textId = await addBlockById(page, 'text', 'IntroTitle')
  await ensureWidgetIsCentered(page, textId)
  await editorPage.stylesTab.click().catch(() => undefined)
  await safeCaptureRightPanel('04-text-props.png')

  const imageId = await addBlockById(page, 'image', 'MainImage')
  await ensureWidgetIsCentered(page, imageId)
  await selectById(page, imageId)
  await editorPage.stylesTab.click().catch(() => undefined)
  await safeCaptureRightPanel('04-image-props.png')

  const buttonId = await addBlockById(page, 'button', 'StartBtn')
  await ensureWidgetIsCentered(page, buttonId)
  await selectById(page, buttonId)
  await editorPage.propsTab.click().catch(() => undefined)
  await captureWidgetProps('04-button-props.png', 'button-properties-panel')

  const rectId = await addBlockById(page, 'rectangle', 'BackgroundPanel')
  await ensureWidgetIsCentered(page, rectId)
  await selectById(page, rectId)
  await editorPage.stylesTab.click().catch(() => undefined)
  await safeCaptureRightPanel('04-rectangle-props.png')

  // -------------------------------------------------------------------------
  // §05 — Navigation Blocks
  // -------------------------------------------------------------------------

  // Move to slide 2 where we place Navigation blocks.
  await goToSlide(1)
  await editorPage.blocksTab.click()

  await safeCategoryShot('05-navigation-blocks-category.png', 'Navigation')

  const navId = await addBlockById(page, 'nav-buttons', 'MainNav')
  await ensureWidgetIsCentered(page, navId)
  await selectById(page, navId)
  await editorPage.propsTab.click().catch(() => undefined)
  await captureWidgetProps('05-navbuttons-props.png', 'button-properties-panel')

  const doneId = await addBlockById(page, 'done-button', 'FinishBtn')
  await ensureWidgetIsCentered(page, doneId)
  await selectById(page, doneId)
  await captureWidgetProps('05-donebutton-props.png', 'button-properties-panel')

  const progressId = await addBlockById(page, 'progress-bar', 'CourseProgress')
  await ensureWidgetIsCentered(page, progressId)
  await selectById(page, progressId)
  await captureWidgetProps('05-progressbar-props.png', 'progress-bar-properties-panel')

  // -------------------------------------------------------------------------
  // §06 — Media Blocks
  // -------------------------------------------------------------------------

  await goToSlide(2)
  await editorPage.blocksTab.click()

  await safeCategoryShot('06-media-blocks-category.png', 'Media')

  const mediaId = await addBlockById(page, 'media-player', 'TutorialVideo')
  await ensureWidgetIsCentered(page, mediaId)
  await selectById(page, mediaId)
  await editorPage.propsTab.click().catch(() => undefined)
  await captureWidgetProps('06-mediaplayer-props.png', 'media-player-properties-panel')

  const audioId = await addBlockById(page, 'audio-narration', 'IntroVoiceover')
  await ensureWidgetIsCentered(page, audioId)
  await selectById(page, audioId)
  await captureWidgetProps('06-audionarration-props.png', 'audio-narration-properties-panel')

  const volId = await addBlockById(page, 'volume-control', 'GlobalVolume')
  await ensureWidgetIsCentered(page, volId)
  await selectById(page, volId)
  await captureWidgetProps('06-volumecontrol-props.png', 'volume-control-properties-panel')

  // -------------------------------------------------------------------------
  // §07 — Assessment Blocks
  // -------------------------------------------------------------------------

  // Keep on slide 3 for the Assessment category.
  await editorPage.blocksTab.click()
  await safeCategoryShot('07-assessment-blocks-category.png', 'Assessment')

  const quizScoreId = await addBlockById(page, 'score-quiz', 'FinalScore')
  await ensureWidgetIsCentered(page, quizScoreId)
  await selectById(page, quizScoreId)
  await editorPage.propsTab.click().catch(() => undefined)
  await safeCaptureRightPanel('07-quizscore-props.png')

  const scoreFieldId = await addBlockById(page, 'score-field', 'RunningScore')
  await ensureWidgetIsCentered(page, scoreFieldId)
  await selectById(page, scoreFieldId)
  await safeCaptureRightPanel('07-scorefield-props.png')

  // -------------------------------------------------------------------------
  // §08 — Questions
  // -------------------------------------------------------------------------

  await goToSlide(3)
  await editorPage.blocksTab.click()

  await safeCategoryShot('08-questions-category.png', 'Questions')

  const mcId = await addBlockById(page, 'question-mc', 'Q1Capital')
  await ensureWidgetIsCentered(page, mcId)
  await selectById(page, mcId)
  await editorPage.propsTab.click().catch(() => undefined)
  await captureWidgetProps('08-mc-props.png', 'question-properties-panel')

  // Close-up of the Scoring section — author crops from the fullpage snapshot
  // since the Scoring heading is inside QuestionPropertiesPanel and has no
  // stable individual selector.
  await captureFullPage(page, '08-scoring-section.png')

  const tfId = await addBlockById(page, 'question-tf', 'Q2Statement')
  await ensureWidgetIsCentered(page, tfId)
  await selectById(page, tfId)
  await captureWidgetProps('08-tf-props.png', 'question-properties-panel')

  const fillId = await addBlockById(page, 'question-fill', 'Q3BlankFill')
  await ensureWidgetIsCentered(page, fillId)
  await selectById(page, fillId)
  await captureWidgetProps('08-fill-props.png', 'question-properties-panel')

  // -------------------------------------------------------------------------
  // §09 — Actions Editor
  // -------------------------------------------------------------------------

  // Add a fresh button for the Actions example. Reusing the §04 buttonId is
  // unreliable because auto-save may not have persisted it before the
  // subsequent slide switches — GrapesJS regenerates ids on reload.
  await goToSlide(0)
  const hintButtonId = await addBlockById(page, 'button', 'HintButton')
  await ensureWidgetIsCentered(page, hintButtonId)
  await selectById(page, hintButtonId)

  // 09-widget-name-field — TD-013.3. The NameField (added 2026-04-23) sits at
  // the top of the Props tab and edits the `name` trait for any selected
  // widget. Switch to Props, ensure the field is mounted, capture it cropped.
  await editorPage.propsTab.click().catch(() => undefined)
  try {
    // HintButton is already selected from earlier in §09; the field should be
    // present. Fill it explicitly so the captured screenshot shows the
    // meaningful value (matches the placeholder description).
    const nameInput = page.locator('[data-testid="widget-name-input"]')
    await nameInput.waitFor({ state: 'visible', timeout: 5000 })
    await nameInput.fill('HintButton')
    await page.waitForTimeout(150)
    await captureElement(page, '[data-testid="widget-name-field"]', {
      filename: '09-widget-name-field.png',
      padding: 12,
    })
  } catch {
    await captureFullPage(page, '09-widget-name-field.png')
  }

  // Open the Actions tab and seed a Click event so the palette renders.
  await editorPage.actionsTab.click()

  // Open "+ Event" → Click. Guard around the menu click because availableEvents
  // is empty once the event is already added (second run on the same widget).
  //
  // Detection of "Click already exists": EventSelector does NOT use
  // `role="tab"` — each event is a `<div role="group" aria-label="Click">`
  // containing a toggle `<button>` (see EventSelector.tsx lines 33–45).
  // An earlier version of this helper queried `role="tab"` which ALWAYS
  // returned 0 hits, so the second invocation re-opened the `+ Event` menu,
  // failed to find a "Click" menuitem (already added → not in
  // availableEvents), and left the menu open — overlaying the widget-target
  // `<select>` and polluting the 09-widget-dropdown-names screenshot clip.
  async function ensureClickEvent(): Promise<void> {
    const clickGroup = page.getByRole('group', { name: /^Click$/i })
    if (await clickGroup.count() > 0) return
    try {
      await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
      await page.getByRole('menuitem', { name: /^Click$/i }).click({ timeout: 5000 })
    } catch {
      /* best effort — palette visibility check is what matters */
      // Close any still-open +Event menu so downstream captures aren't
      // covered by the overlay.
      if (await page.locator('[role="menu"]').count() > 0) {
        await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 1500 }).catch(() => undefined)
      }
    }
  }
  await ensureClickEvent()

  // 09-actions-tab.png — right sidebar with the Actions tab active. A first
  // action row helps the shot look populated; the palette ships visible.
  // Insert Navigate once via click on the palette's Navigate button.
  async function insertActionFromPalette(label: RegExp): Promise<void> {
    const palette = page.locator('[data-testid="action-palette"]')
    await palette.waitFor({ state: 'visible', timeout: 5000 })
    await palette.getByRole('button', { name: label }).first().click({ timeout: 4000 })
  }

  try {
    await insertActionFromPalette(/^Navigate$/)
  } catch {
    /* best effort — downstream captureFullPage still emits something */
  }
  await safeCaptureRightPanel('09-actions-tab.png')

  // 09-widget-dropdown-names — TD-013.4 (T-15: Zustand direct-sync).
  //
  // WidgetIdParam renders a <select> of widget names (vs a free-form <input>)
  // only when the Zustand course store has widgets for the current slide.
  // Zustand is populated at App bootstrap from getCourse(id) and is NOT
  // mutated by the autosave pipeline — widgets added during the session
  // land in the store only on page reload. A reload-based workaround was
  // tried first but the GrapesJS → course round-trip subtly strips the
  // `name` trait for unpersisted widgets, so the <select> rendered bare
  // ids (itllc, ioj4v…) instead of author-assigned names.
  //
  // Pivot: authoring-ui exposes `window.__elearn_store` (DEV/E2E only, see
  // EditorCanvas.tsx onReady). We read the live GrapesJS component tree
  // (whose `name` traits are already up-to-date — that's where the
  // NameField wrote them), derive the minimal BaseWidget-shaped entries
  // needed by WidgetIdParam, and force-sync Zustand via setState. No
  // reload, no persistence round-trip — the `name` goes straight from the
  // Backbone model where the user (or this spec) just wrote it into the
  // in-memory course.slides[i].widgets array the selector reads.
  try {
    // 1. Read GrapesJS component tree and build the Widget-shaped array.
    //    WidgetIdParam only reads `id` and `name` off each widget (see
    //    ActionItemEditor.tsx WidgetIdParam lines 182–196). We still
    //    populate `type`, `bounds`, `layer` so the shape is valid for
    //    any future selector that reads them — future-proofing at zero
    //    marginal cost since we already walk the tree.
    const syncResult = await page.evaluate(() => {
      const ed = window.__elearn_editor as
        | { getWrapper(): { components(): { map<R>(fn: (c: unknown, i: number) => R): R[] } } }
        | undefined
      const store = window.__elearn_store
      if (!ed || !store) return { ok: false as const, reason: 'editor or store not exposed' }

      type StoreShape = {
        course: {
          id: string
          slides: Array<{ id: string; title: string; widgets: unknown[] }>
        } | null
        currentSlideIndex: number
      }
      const s = store.getState() as StoreShape
      if (!s.course) return { ok: false as const, reason: 'course is null' }

      type Comp = {
        getId(): string
        get(k: string): unknown
      }
      const widgets = ed.getWrapper().components().map((c, idx) => {
        const comp = c as Comp
        return {
          id: comp.getId(),
          type: (comp.get('type') as string | undefined) ?? 'unknown',
          name: (comp.get('name') as string | undefined) ?? '',
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          layer: idx,
        }
      })

      const slides = s.course.slides.map((sl, i) =>
        i === s.currentSlideIndex ? { ...sl, widgets } : sl,
      )
      store.setState({ course: { ...s.course, slides } })
      return { ok: true as const, count: widgets.length, names: widgets.map((w) => w.name) }
    })
    // eslint-disable-next-line no-console
    console.log('[09-dropdown] Zustand sync:', syncResult)
    if (!syncResult.ok) throw new Error(`sync failed: ${syncResult.reason}`)
    await page.waitForTimeout(200) // let WidgetIdParam re-render

    // 2. Ensure the Actions tab is open with a Click event + Show action.
    //    HintButton is still selected from earlier in §09, and the Click
    //    event + Navigate action were seeded just above. Adding Show gives
    //    us a row whose WidgetIdParam triggers the <select> branch now that
    //    Zustand has widgets.
    await editorPage.actionsTab.click()
    await ensureClickEvent()
    await insertActionFromPalette(/^Show$/)
    await page.waitForTimeout(400) // let React commit the new action row

    // 3. Locate the widget-target <select> inside the Show action row.
    const showRow = page.locator('[data-action-type="show"]').first()
    await showRow.waitFor({ state: 'visible', timeout: 5000 })
    const widgetSelect = showRow.locator('select').first()
    await widgetSelect.waitFor({ state: 'visible', timeout: 5000 })

    // 4. Apply T-3 (native <select> size-expand) so every option is visible
    //    inline as a listbox instead of collapsed with the popup closed.
    await widgetSelect.evaluate((el: HTMLSelectElement) => {
      el.dataset['originalSize'] = String(el.size)
      el.size = Math.max(el.options.length, 2)
    })
    await page.waitForTimeout(150) // let the browser re-lay out the listbox

    await captureElement(page, '[data-action-type="show"] select', {
      filename: '09-widget-dropdown-names.png',
      padding: 20,
    })

    // 5. Restore the original size so the rest of the campaign sees the
    //    normal dropdown rendering.
    await widgetSelect.evaluate((el: HTMLSelectElement) => {
      el.size = Number.parseInt(el.dataset['originalSize'] ?? '0', 10) || 1
      delete el.dataset['originalSize']
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] 09-widget-dropdown-names try failed:', (err as Error)?.message ?? err)
    await captureFullPage(page, '09-widget-dropdown-names.png')
  }

  // -------------------------------------------------------------------------
  // §10 — Triggers & Actions Reference
  // -------------------------------------------------------------------------

  // 10-event-selector.png — Actions tab with "+ Event" menu open. After
  // capturing, toggle the menu OFF by re-clicking the "+ Event" button so
  // downstream action-row captures are not occluded by the overlay.
  const addEventButton = page.getByRole('button', { name: /\+ *Event/i })
  try {
    await addEventButton.click({ timeout: 5000 })
    await captureElement(page, '[role="menu"]', {
      filename: '10-event-selector.png',
      padding: 10,
    })
  } catch {
    await captureFullPage(page, '10-event-selector.png')
  } finally {
    // Guarantee the menu is closed — try the toggle first, then a safety
    // click on the sidebar background.
    if (await page.locator('[role="menu"]').count() > 0) {
      await addEventButton.click({ timeout: 1500 }).catch(() => undefined)
    }
    if (await page.locator('[role="menu"]').count() > 0) {
      await page.locator(RIGHT_SIDEBAR).click({
        position: { x: 10, y: 10 },
        timeout: 1500,
      }).catch(() => undefined)
    }
  }

  // 10-action-palette.png — the full palette with all 15 actions grouped.
  // Three constraints compound: overflow:auto on the container, flex-shrink
  // from the ActionsPanel flex column, AND viewport height capping the
  // visible area. Neutralise all three for the capture window: CSS lifts
  // the first two, a temporary viewport resize lifts the third. Every
  // tall-element capture in this block (palette + the 3 rows) reuses the
  // taller viewport, reverting at the end.
  const originalViewport = page.viewportSize()!
  await page.setViewportSize({ width: originalViewport.width, height: 3000 })

  const paletteStyle = await page.addStyleTag({
    content: `[data-testid="action-palette"],
    [data-testid="action-palette-area"] {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
      flex: 0 0 auto !important;
    }
    [data-testid="actions-panel"],
    aside[aria-label="Properties"] {
      overflow: visible !important;
      max-height: none !important;
    }`,
  })
  try {
    const palette = page.locator('[data-testid="action-palette"]').first()
    await palette.waitFor({ state: 'visible', timeout: 5000 })
    await palette.scrollIntoViewIfNeeded()
    const box = await palette.boundingBox()
    if (!box) throw new Error('no bbox for action-palette')
    const p = 12
    await page.screenshot({
      path: SCREENSHOTS_DIR + '/10-action-palette.png',
      type: 'png',
      fullPage: true,
      clip: {
        x: Math.max(0, Math.round(box.x - p)),
        y: Math.max(0, Math.round(box.y - p)),
        width: Math.round(box.width + 2 * p),
        height: Math.round(box.height + 2 * p),
      },
    })
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] wrote 10-action-palette.png (element)')
  } catch {
    await captureFullPage(page, '10-action-palette.png')
  } finally {
    await paletteStyle.evaluate((el: Node) => {
      if (el instanceof Element) el.remove()
    })
  }

  // 10-action-navigate / setvariable / ifelse — insert each action (if not
  // already present) and capture the specific row by its data-action-type.
  async function ensureRow(label: RegExp, type: string): Promise<void> {
    const row = page.locator(`[data-action-type="${type}"]`)
    if (await row.count() > 0) return
    await insertActionFromPalette(label)
    await row.first().waitFor({ state: 'visible', timeout: 4000 })
  }

  async function captureRow(filename: string, type: string): Promise<void> {
    // An action row can exceed viewport height (the `condition` row hosts
    // two nested ActionPalettes). Plain loc.screenshot() captures only what
    // fits in the viewport AND Playwright scrolls the sidebar before the
    // capture, so the clip ends up on the wrong region.
    // Workaround: read the bbox AFTER scrollIntoView, then screenshot the
    // full page with an explicit clip — Playwright renders the document at
    // its natural height so any clip beyond the viewport is honoured.
    const selector = `[data-action-type="${type}"]`
    try {
      const loc = page.locator(selector).first()
      await loc.waitFor({ state: 'visible', timeout: 4000 })
      await loc.scrollIntoViewIfNeeded()
      const box = await loc.boundingBox()
      if (!box) throw new Error(`captureRow(${filename}): no bbox`)
      await page.screenshot({
        path: SCREENSHOTS_DIR + '/' + filename,
        type: 'png',
        fullPage: true,
        clip: box,
      })
      // eslint-disable-next-line no-console
      console.log(`[docs-screenshots] wrote ${filename} (element)`)
    } catch {
      await captureFullPage(page, filename)
    }
  }

  try {
    await ensureRow(/^Navigate$/, 'navigate')
    await captureRow('10-action-navigate.png', 'navigate')

    await ensureRow(/^Set Variable$/, 'set-variable')
    await captureRow('10-action-setvariable.png', 'set-variable')

    await ensureRow(/^If \/ Else$/, 'condition')

    // Seed one nested action per branch so the shot shows structure, not
    // two empty palettes. The condition row embeds two ActionPalette
    // instances (Then first, Else second) — insert Show into each.
    const conditionRow = page.locator('[data-action-type="condition"]').first()
    const nestedPalettes = conditionRow.locator('[data-testid="action-palette"]')
    // The first nested palette is Then; after insertion the second becomes
    // Else's (Then palette repositions below its new child but the order
    // of the nested palettes within the condition row is preserved).
    await nestedPalettes.nth(0).getByRole('button', { name: /^Show$/ })
      .click({ timeout: 4000 }).catch(() => undefined)
    await nestedPalettes.nth(1).getByRole('button', { name: /^Hide$/ })
      .click({ timeout: 4000 }).catch(() => undefined)

    await captureRow('10-action-ifelse.png', 'condition')
  } catch {
    // Fall through: each captureRow has its own per-file fallback.
  } finally {
    // Restore viewport for subsequent captures (§11+ assume 720 height).
    await page.setViewportSize(originalViewport)
  }

  // -------------------------------------------------------------------------
  // §11 — Expressions, Recipes & Shared Sequences
  // -------------------------------------------------------------------------

  // 11-recipe-attempts.png — questionIncorrect event on an MC question with
  // Set Variable + If/Else → Show nested in the Then branch.
  try {
    // Navigate to the slide hosting the MC question and re-locate it by
    // data-widget attribute. The id captured at §08 (mcId) is invalid now:
    // GrapesJS regenerates component ids on reload, and we have switched
    // slides multiple times between §08 and here.
    await goToSlide(3)
    // Scan the editor tree for a question-mc component by its data-widget
    // attribute (set by registerQuestionBlocks). If the slide lost the
    // widget to autosave flakiness, fall through to adding a fresh one.
    let mcIdFresh = await page.evaluate(() => {
      const ed = window.__elearn_editor
      if (!ed) return undefined
      const byAttr = ed.getWrapper().find('[data-widget="question-mc"]')[0]?.getId()
      if (byAttr) return byAttr
      // Fallback: walk top-level components looking for type==='question-mc'
      const comps = ed.getWrapper().components()
      for (const c of comps) {
        if (c.get('type') === 'question-mc') return c.getId()
      }
      return undefined
    })
    if (!mcIdFresh) {
      // Seed an MC question so the recipe has a valid target.
      mcIdFresh = await addBlockById(page, 'question-mc', 'RecipeTarget')
      await ensureWidgetIsCentered(page, mcIdFresh)
    }
    await selectById(page, mcIdFresh)
    await editorPage.actionsTab.click()

    // Open +Event → Question Incorrect.
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await page.getByRole('menuitem', { name: /Question Incorrect/i })
      .click({ timeout: 5000 })

    // Insert Set Variable + Condition + nested Show in Then.
    const insertFromPalette = async (label: RegExp): Promise<void> => {
      const palette = page.locator('[data-testid="action-palette"]')
      await palette.waitFor({ state: 'visible', timeout: 5000 })
      await palette.getByRole('button', { name: label }).first()
        .click({ timeout: 4000 })
    }
    await insertFromPalette(/^Set Variable$/)
    await insertFromPalette(/^If \/ Else$/)

    // Nested Show in Then (first nested palette within the condition row).
    const conditionRow = page.locator('[data-action-type="condition"]').first()
    await conditionRow
      .locator('[data-testid="action-palette"]').nth(0)
      .getByRole('button', { name: /^Show$/ }).first()
      .click({ timeout: 4000 }).catch(() => undefined)

    await captureTallWidgetProps('11-recipe-attempts.png', 'actions-panel')
  } catch {
    await captureFullPage(page, '11-recipe-attempts.png')
  }

  // 11-shared-sequences-library.png — the Shared Sequence Library lives at
  // the bottom of the Actions panel. Seed two named sequences so the shot
  // shows a non-empty library (matches the placeholder: "Shared Sequence
  // Library panel with at least two named sequences").
  try {
    const library = page.locator('[data-testid="shared-sequence-library"]')
    await library.scrollIntoViewIfNeeded()
    const nameInput = library.locator('input[placeholder*="sequence name"]')
    await nameInput.fill('onboarding-intro')
    await library.getByRole('button', { name: /\+ *Add/i }).click({ timeout: 4000 })
    await nameInput.fill('closing-summary')
    await library.getByRole('button', { name: /\+ *Add/i }).click({ timeout: 4000 })

    await captureTallWidgetProps('11-shared-sequences-library.png', 'shared-sequence-library')
  } catch {
    await captureFullPage(page, '11-shared-sequences-library.png')
  }

  // -------------------------------------------------------------------------
  // §12 — Simulations Overview
  // -------------------------------------------------------------------------

  await goToSlide(4)
  await editorPage.blocksTab.click()

  await safeCategoryShot('12-simulations-category.png', 'Simulations')

  // -------------------------------------------------------------------------
  // §13 — Software Walkthrough
  // -------------------------------------------------------------------------

  const swId = await addBlockById(page, 'screenshot-sim', 'SoftwareDemo')
  await ensureWidgetIsCentered(page, swId)
  await selectById(page, swId)
  // Block placeholder on the canvas — capture the canvas iframe area.
  await capture(page, {
    filename: '13-block-placeholder.png',
    selector: 'iframe.gjs-frame',
    padding: 0,
  })

  // 13-overview.png — full three-column editor overlay AFTER a sample session
  // is loaded. Requires a recorded session or uploaded screenshots.
  // 13-hotspot-editor.png — hotspot drawn on a loaded screenshot.
  // TODO_MANUAL: both need Simulation Editor state that this script cannot
  // reproduce reliably.

  // -------------------------------------------------------------------------
  // §14 — Interactive Scenario
  // -------------------------------------------------------------------------

  const phaserId = await addBlockById(page, 'phaser-sim', 'ProcessFlowDemo')
  await ensureWidgetIsCentered(page, phaserId)
  await selectById(page, phaserId)
  await editorPage.propsTab.click().catch(() => undefined)

  await capture(page, {
    filename: '14-block-placeholder.png',
    selector: 'iframe.gjs-frame',
    padding: 0,
  })

  // 14-builder-types.png — Sim Type dropdown with all 5 options visible.
  // Native <select> popups close on screenshot. Trick: temporarily set
  // `size` attribute to the option count — the browser renders a listbox
  // instead of a dropdown, all options visible inline, and locator.screenshot()
  // can crop it deterministically. Revert after so the panel returns to its
  // normal dropdown rendering.
  const simTypeSelector = '[data-testid="phaser-sim-type-select"]'
  try {
    const simTypeSelect = page.locator(simTypeSelector)
    await simTypeSelect.waitFor({ state: 'visible', timeout: 5000 })
    await simTypeSelect.evaluate((el: HTMLSelectElement) => {
      el.dataset['originalSize'] = String(el.size)
      el.size = el.options.length
    })
    await captureElement(page, simTypeSelector, {
      filename: '14-builder-types.png',
      padding: 20,
    })
    await simTypeSelect.evaluate((el: HTMLSelectElement) => {
      el.size = Number.parseInt(el.dataset['originalSize'] ?? '0', 10) || 1
      delete el.dataset['originalSize']
    })
  } catch {
    // If the select is not reachable for any reason, emit the safety net so
    // the author can still crop from a fullpage snapshot.
    await captureFullPage(page, '14-builder-types.png')
  }

  // Tall-panel capture helper: the Phaser sim Props panel can exceed the
  // viewport when a builder populates nodes / hotspots / questions, so we
  // expand the viewport and use page.screenshot({ fullPage: true, clip })
  // — same trick as §10's action rows. The CSS overrides neutralise the
  // flex-shrink + overflow that would otherwise clip the panel.
  async function captureTallWidgetProps(
    filename: string,
    panelTestId: string,
  ): Promise<void> {
    const originalVp = page.viewportSize()!
    await page.setViewportSize({ width: originalVp.width, height: 3000 })
    const style = await page.addStyleTag({
      content: `[data-testid="${panelTestId}"] {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        flex: 0 0 auto !important;
      }
      aside[aria-label="Properties"] {
        overflow: visible !important;
        max-height: none !important;
      }`,
    })
    try {
      const panel = page.locator(`[data-testid="${panelTestId}"]`).first()
      await panel.waitFor({ state: 'visible', timeout: 5000 })
      await panel.scrollIntoViewIfNeeded()
      const box = await panel.boundingBox()
      if (!box) throw new Error(`captureTallWidgetProps(${filename}): no bbox`)
      await page.screenshot({
        path: SCREENSHOTS_DIR + '/' + filename,
        type: 'png',
        fullPage: true,
        clip: box,
      })
      // eslint-disable-next-line no-console
      console.log(`[docs-screenshots] wrote ${filename} (element)`)
    } catch {
      await captureFullPage(page, filename)
    } finally {
      await style.evaluate((el: Node) => {
        if (el instanceof Element) el.remove()
      })
      await page.setViewportSize(originalVp)
    }
  }

  // Helper: commit a JSON string to the Scene Definition textarea. The
  // panel listens to onBlur to parse and persist sceneDef, so blur must
  // fire before the new shape is reflected in the builder UI.
  async function pasteSceneDef(json: string): Promise<void> {
    const textarea = page
      .locator('[data-testid="phaser-sim-properties-panel"] textarea')
      .first()
    await textarea.waitFor({ state: 'visible', timeout: 3000 })
    await textarea.fill(json)
    await textarea.blur()
    // Let the panel re-parse sceneDef and the builder sub-sections re-render.
    await page.waitForTimeout(400)
  }

  // 14-processflow-builder.png — simType=process-flow (default). Panel
  // empty of nodes; the shot shows the builder skeleton (Nodes/Edges/
  // Steps sections + Scene Definition textarea).
  await captureTallWidgetProps('14-processflow-builder.png', 'phaser-sim-properties-panel')

  const simTypeSelect = page.locator(simTypeSelector)

  // 14-diagram-builder.png — simType=interactive-diagram + a JSON seed so
  // the Background Image URL is populated and 4 hotspots render.
  try {
    await simTypeSelect.selectOption('interactive-diagram', { timeout: 5000 })
    await page.waitForTimeout(300)
    await pasteSceneDef(JSON.stringify({
      simType: 'interactive-diagram',
      backgroundImageUrl: 'https://storage.example.com/assets/diagram.png',
      hotspots: [
        { id: 'h1', x: 100, y: 100, width: 60, height: 60, label: 'Zona A', correct: true },
        { id: 'h2', x: 220, y: 100, width: 60, height: 60, label: 'Zona B', correct: false },
        { id: 'h3', x: 340, y: 100, width: 60, height: 60, label: 'Zona C', correct: false },
        { id: 'h4', x: 460, y: 100, width: 60, height: 60, label: 'Zona D', correct: false },
      ],
    }, null, 2))
    await captureTallWidgetProps('14-diagram-builder.png', 'phaser-sim-properties-panel')
  } catch {
    await captureFullPage(page, '14-diagram-builder.png')
  }

  // 14-quiz-builder.png — simType=gamified-quiz + a JSON seed with timer,
  // lives, combo and three questions.
  try {
    await simTypeSelect.selectOption('gamified-quiz', { timeout: 5000 })
    await page.waitForTimeout(300)
    await pasteSceneDef(JSON.stringify({
      simType: 'gamified-quiz',
      timerSeconds: 60,
      lives: 3,
      comboMultiplier: 1.5,
      questions: [
        { id: 'q1', text: '¿Cuál es 2+2?', options: ['3', '4', '5'], correctIndex: 1, points: 10 },
        { id: 'q2', text: '¿Qué significa HTML?', options: ['Lenguaje de marcado', 'Hoja de estilo', 'Un script'], correctIndex: 0, points: 10 },
        { id: 'q3', text: 'Capital de Francia', options: ['Londres', 'Madrid', 'París'], correctIndex: 2, points: 10 },
      ],
    }, null, 2))
    await captureTallWidgetProps('14-quiz-builder.png', 'phaser-sim-properties-panel')
  } catch {
    await captureFullPage(page, '14-quiz-builder.png')
  }

  // 14-json-example.png — simType back to process-flow with a realistic
  // 3-nodes / 2-edges / 2-steps scene pasted into Scene Definition. The
  // tall capture covers both the populated builder sections AND the JSON
  // textarea at the bottom of the panel so the reader sees the full
  // Scene-Definition → builders correspondence.
  try {
    await simTypeSelect.selectOption('process-flow', { timeout: 5000 })
    await page.waitForTimeout(300)
    await pasteSceneDef(JSON.stringify({
      simType: 'process-flow',
      nodes: [
        { id: 'start', x: 100, y: 200, label: 'Ticket creado', type: 'start' },
        { id: 'triage', x: 300, y: 200, label: 'Triage L1', type: 'step' },
        { id: 'resolve', x: 500, y: 200, label: 'Resolver', type: 'decision' },
      ],
      edges: [
        { from: 'start', to: 'triage' },
        { from: 'triage', to: 'resolve' },
      ],
      interactionMode: 'practice',
      steps: [
        { nodeId: 'triage', instruction: '¿Qué haces primero?', correctAction: 'click' },
        { nodeId: 'resolve', instruction: '¿Lo resuelves o escalas?', correctAction: 'click' },
      ],
    }, null, 2))
    await captureTallWidgetProps('14-json-example.png', 'phaser-sim-properties-panel')
  } catch {
    await captureFullPage(page, '14-json-example.png')
  }

  // -------------------------------------------------------------------------
  // §15 — Preview + §16 — Publish SCORM (top-toolbar crops)
  // -------------------------------------------------------------------------

  await captureElement(page, 'button:has-text("Preview")', {
    filename: '15-preview-button.png',
    padding: 12,
  })

  await captureElement(page, 'button:has-text("Publish SCORM")', {
    filename: '16-publish-button.png',
    padding: 12,
  })

  // 16-publish-dialog.png — open the dialog and capture it.
  try {
    await editorPage.publishScormButton.click({ timeout: 5000 })
    await editorPage.publishDialog.waitFor({ state: 'visible', timeout: 8000 })
    await captureElement(page, 'dialog, [role="dialog"]', {
      filename: '16-publish-dialog.png',
      padding: 10,
    })
    await page
      .getByRole('button', { name: /^Cancel$/i })
      .click({ timeout: 3000 })
      .catch(() => undefined)
  } catch {
    await captureFullPage(page, '16-publish-dialog.png')
  }

  // 15-popup-rendered.png — preview popup lives in a separate BrowserContext
  // window served from /preview.html. The handshake is:
  //   1. opener window.open('/preview.html')
  //   2. popup sends 'elearn-preview-ready' via postMessage
  //   3. opener replies 'elearn-preview-data' with the course JSON
  //   4. ELearnPlayer.init(course, slideIndex) renders widgets into #player
  // Instead of a blind waitForTimeout, wait until at least one widget has
  // rendered inside #player — a reliable signal that the handshake and the
  // hydration both completed. Use popup.screenshot() directly so the
  // filename stays `15-popup-rendered.png` (captureFullPage always appends
  // a `-fullpage.png` safety-net suffix).
  try {
    // Go to slide 0 first so the preview opens on a populated slide
    // (slide 1 "Intro" has IntroTitle + StartBtn from §04).
    await goToSlide(0)
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.getByRole('button', { name: /^Preview$/i }).click({ timeout: 4000 }),
    ])
    await popup.waitForLoadState('domcontentloaded', { timeout: 10_000 })
    // Wait for any widget to render inside the player root. 15s budget
    // gives the handshake + hydration plenty of margin in slow CI runs.
    await popup.locator('#player .el-widget').first().waitFor({
      state: 'attached',
      timeout: 15_000,
    })
    // A small settling delay lets style layout complete before the shot.
    await popup.waitForTimeout(200)
    await popup.screenshot({
      path: SCREENSHOTS_DIR + '/15-popup-rendered.png',
      type: 'png',
      fullPage: true,
    })
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] wrote 15-popup-rendered.png (popup)')
    await popup.close().catch(() => undefined)
  } catch {
    /* Popup blocked or handshake failed — leave a safety net from the editor. */
    await captureFullPage(page, '15-popup-rendered.png')
  }

  // 16-lms-upload-placeholder.png — a real LMS UI. The local Moodle docker
  // (docker compose --profile moodle up, see docker/docker-compose.dev.yml)
  // exposes Bitnami Moodle on :8081 with admin credentials seeded via env.
  // Open a fresh browser context, log in, and screenshot the "Site home"
  // dashboard — this is a representative Moodle admin surface the reader
  // will recognise, and doesn't require navigating into specific courses
  // whose structure we can't guarantee across dev setups.
  // Env vars respected: MOODLE_BASE_URL (default http://localhost:8081),
  // MOODLE_ADMIN_USER (default 'admin'), MOODLE_ADMIN_PASSWORD (default
  // the dev compose default 'Admin1234!'). Falls back to a fullpage shot
  // of the editor if Moodle is unreachable.
  try {
    const moodleUrl = process.env.MOODLE_BASE_URL ?? 'http://localhost:8081'
    const moodleUser = process.env.MOODLE_ADMIN_USER ?? 'admin'
    const moodlePass = process.env.MOODLE_ADMIN_PASSWORD ?? 'Admin1234!'

    const moodleContext = await page.context().browser()!.newContext()
    const moodlePage = await moodleContext.newPage()

    await moodlePage.goto(moodleUrl + '/login/index.php', {
      timeout: 15_000,
      waitUntil: 'domcontentloaded',
    })
    await moodlePage.locator('#username').fill(moodleUser)
    await moodlePage.locator('#password').fill(moodlePass)
    await moodlePage.locator('#loginbtn').click()
    // After login, navigate to the SCORM module settings admin page —
    // this is a Moodle-internal page that explicitly references "SCORM
    // package" and exposes the upload / format-compatibility options
    // LMS administrators would recognise. Much closer to the placeholder
    // intent ("Upload SCORM package") than the bare dashboard.
    await moodlePage.goto(moodleUrl + '/admin/settings.php?section=modsettingscorm', {
      timeout: 15_000,
      waitUntil: 'networkidle',
    })
    // Dismiss any leftover loading overlay or modal.
    await moodlePage.waitForTimeout(1500)
    await moodlePage.screenshot({
      path: SCREENSHOTS_DIR + '/16-lms-upload-placeholder.png',
      type: 'png',
      fullPage: false,
    })
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] wrote 16-lms-upload-placeholder.png (moodle)')
    await moodleContext.close()
  } catch {
    await captureFullPage(page, '16-lms-upload-placeholder.png')
  }

  // -------------------------------------------------------------------------
  // §17 — Worked Example (5 finished slides)
  // -------------------------------------------------------------------------

  // The spec has already seeded each slide with a representative mix of
  // widgets (§04-§08), so a per-slide viewport capture produces a
  // reasonable "canvas + right sidebar" shot even if the worked-example
  // wiring is not 1:1 with docs/user-guide/17-worked-example.md.
  // Using page.screenshot() directly (instead of captureFullPage which
  // would append a -fullpage suffix) keeps the filename clean so the
  // placeholder slot is populated. Each shot is a 1280x720 viewport
  // crop showing the whole editor — top toolbar, slide list on the
  // left, canvas in the middle, Properties aside on the right.
  for (let i = 0; i < 5; i += 1) {
    await goToSlide(i)
    // Clear any active selection so the Props aside shows the empty-state
    // hint, not a stray widget panel inherited from the previous slide.
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      ed?.select(null)
    })
    await page.waitForTimeout(300)
    await page.screenshot({
      path: SCREENSHOTS_DIR + `/17-slide-${i + 1}-final.png`,
      type: 'png',
      fullPage: false,
    })
    // eslint-disable-next-line no-console
    console.log(`[docs-screenshots] wrote 17-slide-${i + 1}-final.png (viewport)`)
  }

  // -------------------------------------------------------------------------
  // Keep TypeScript happy — expect() call so the test is explicitly green.
  // -------------------------------------------------------------------------

  expect(true).toBe(true)
})
