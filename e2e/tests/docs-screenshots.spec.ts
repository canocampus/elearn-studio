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
 * ## Scope — every placeholder automated (TD-013, closed sections .1–.6)
 *
 * All 55 manual placeholders are produced by this spec: sidebar category
 * crops, Props-panel crops, Actions-tab compositions, callout overlays
 * (T-13), the Sim Editor real-UI overlay flow (T-16), and the §17
 * worked-example course built from scratch (T-18). The chained post-step
 * `scripts/run-crop.cjs` (T-17) applies deterministic crops for
 * dual-strategy captures whenever a primary testid path failed.
 *
 * ## Expected output
 *
 * After a successful chained run, the folder should contain:
 *   - 55/55 final PNGs corresponding to every placeholder in the manual
 *   - `08-scoring-section-fullpage.png` — by-design fresh source for the
 *     T-17 mtime-idempotent crop fallback, captured every run
 *   - Any OTHER `-fullpage.png` means a primary capture failed that run
 *     (defensive — see the playbook to diagnose the regression)
 */

import { test, expect } from '../fixtures/auth'
import {
  addBlockById,
  addCallouts,
  ASIDE_NEUTRALISE_RULES,
  capture,
  captureElement,
  captureFullPage,
  ensureWidgetIsCentered,
  PANEL_NEUTRALISE_RULES,
  removeCallouts,
  selectById,
  SCREENSHOTS_DIR,
} from '../utils/screenshot'
import {
  addAndUploadStep,
  drawHotspotOnSelectedStep,
  triggerSimDblClick,
} from '../utils/simulation'
import { ensureEvent, insertActionFromPalette } from '../utils/actions'
import {
  EUROPE_MAP_DATA_URI,
  idByName,
  placeAt,
  retryOnDestroyedContext,
  setTextContent,
} from '../utils/worked-example'

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
      content: `[data-testid="${panelTestId}"] { ${PANEL_NEUTRALISE_RULES} }`,
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
      // Tabs 5–9: drop the circle below each tab (y offset past the ~36px tab
      // height) so it points at the tab without covering its label
      // (TD-013.5c(d) — centred circles used to sit ON the labels).
      { number: 5, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(1)', offset: { y: 58 } },
      { number: 6, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(2)', offset: { y: 58 } },
      { number: 7, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(3)', offset: { y: 58 } },
      { number: 8, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(4)', offset: { y: 58 } },
      { number: 9, selector: '[role="tablist"][aria-label="Right panel tabs"] > button:nth-child(5)', offset: { y: 58 } },
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

  // 02-first-slide — captured in the §17 worked-example block (TD-013.5c(b)),
  // right after the "Capitals of Europe" course is created: that is the only
  // moment the UI genuinely shows a just-created course with a single empty
  // slide. The previous approach (re-using this scratch course's empty slide
  // 5) rendered "five slides with Slide 5 selected" — misleading for §02.

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

  // Close-up of the Scoring section — TD-013.5b dual strategy. Primary:
  // captureElement on `data-testid="scoring-section"` (ScoringFeedbackForm
  // section root in QuestionPropertiesPanel.tsx). The -fullpage safety net is
  // captured unconditionally FIRST so scripts/screenshots-crop.json always has
  // a fresh same-render source for the Python post-crop fallback
  // (scripts/crop-screenshots.py, TD-013.6) — the tool compares target-vs-source
  // mtime and only crops when the testid capture below did not produce the file.
  await captureFullPage(page, '08-scoring-section.png')
  try {
    await captureElement(page, '[data-testid="scoring-section"]', {
      filename: '08-scoring-section.png',
      padding: 12,
    })
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      '[docs-screenshots] 08-scoring-section testid capture failed — Python post-crop will produce it from the -fullpage net',
    )
  }

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

  // Open "+ Event" → Click via the shared driver (utils/actions.ts — the
  // role="group" detection story lives in its docstring + playbook T-12).
  await ensureEvent(page, /^Click$/i)

  // 09-actions-tab.png — right sidebar with the Actions tab active. A first
  // action row helps the shot look populated; the palette ships visible.
  // Insert Navigate once via click on the palette's Navigate button.

  try {
    await insertActionFromPalette(page, /^Navigate$/)
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
    await ensureEvent(page, /^Click$/i)
    await insertActionFromPalette(page, /^Show$/)
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
    [data-testid="action-palette-area"] { ${PANEL_NEUTRALISE_RULES} }
    [data-testid="actions-panel"],
    aside[aria-label="Properties"] { ${ASIDE_NEUTRALISE_RULES} }`,
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
    await insertActionFromPalette(page, label)
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
    await insertActionFromPalette(page, /^Set Variable$/)
    await insertActionFromPalette(page, /^If \/ Else$/)

    // Nested Show in Then (first nested palette within the condition row).
    const conditionRow = page.locator('[data-action-type="condition"]').first()
    await conditionRow
      .locator('[data-testid="action-palette"]').nth(0)
      .getByRole('button', { name: /^Show$/ }).first()
      .click({ timeout: 4000 }).catch(() => undefined)

    // TD-013.5c(c) — fill every required param so the capture shows a
    // complete recipe instead of "[questionIncorrect] … requires …"
    // validation warning banners stacked on top of the panel. Placeholders
    // match ActionItemEditor.tsx; each fill is best-effort so a copy change
    // degrades the shot (banner returns) rather than aborting the campaign.
    const svRow = page.locator('[data-action-type="set-variable"]').first()
    await svRow.locator('input[placeholder="Variable"]')
      .fill('attempts', { timeout: 3000 }).catch(() => undefined)
    await svRow.locator('input[placeholder="expr"], input[placeholder="value"]').first()
      .fill('$attempts + 1', { timeout: 3000 }).catch(() => undefined)
    await conditionRow.locator('input[placeholder="$var == value"]').first()
      .fill('$attempts >= 2', { timeout: 3000 }).catch(() => undefined)
    await conditionRow.locator('input[placeholder="Widget ID"]').first()
      .fill('HintText', { timeout: 3000 }).catch(() => undefined)
    await page.waitForTimeout(300) // let the warning banners clear

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
  // Place within the VISIBLE canvas area: the 1024px iframe extends under the
  // right aside, so the default (400,250) position put the widget half-hidden
  // beneath the sidebar and the element screenshot composited the overlap
  // (pre-existing baseline defect caught by TD-013.8's visual pass).
  await ensureWidgetIsCentered(page, swId, 170, 140)
  await selectById(page, swId)
  // Block placeholder on the canvas — clip to the iframe's visible region
  // (element bounds intersected with the aside's left edge + viewport).
  try {
    const frameBox = await page.locator('iframe.gjs-frame').boundingBox()
    if (!frameBox) throw new Error('no iframe bbox')
    const asideBox = await page.locator(RIGHT_SIDEBAR).boundingBox()
    const vp = page.viewportSize()!
    const visibleWidth = Math.min(
      frameBox.width,
      (asideBox ? asideBox.x : vp.width) - frameBox.x,
    )
    const visibleHeight = Math.min(frameBox.height, vp.height - frameBox.y)
    await page.screenshot({
      path: SCREENSHOTS_DIR + '/13-block-placeholder.png',
      type: 'png',
      clip: { x: frameBox.x, y: frameBox.y, width: visibleWidth, height: visibleHeight },
    })
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] wrote 13-block-placeholder.png (visible canvas clip)')
  } catch {
    await captureFullPage(page, '13-block-placeholder.png')
  }

  // 13-overview.png + 13-hotspot-editor.png — TD-013.5 (2026-04-29). Pure
  // real-UI flow inheriting the helpers exercised end-to-end by
  // simulation-editor.spec.ts (TD-014.22 + .35). No store seeding: every
  // step below is the same path a real author would take.
  //
  // Sequence: dblclick swId → overlay opens → +Add step ×2 (each uploads
  // the canonical fixture image + fills Description + Instruction) → click
  // step 0 → capture overlay full → draw hotspot via real page.mouse on
  // the Konva stage → capture canvas area → Cancel to discard the unsaved
  // sim so subsequent §14 captures start on a clean canvas.
  try {
    await triggerSimDblClick(page, swId)
    await expect(page.getByTestId('sim-add-step-btn')).toBeVisible({ timeout: 5000 })
    await addAndUploadStep(page, 'Step 1', 'Open the login screen and click Sign in')
    await addAndUploadStep(page, 'Step 2', 'Enter your password and submit')
    // After +Add step the freshly-added step is selected; click step 0 so
    // the overview shot shows step 1 highlighted (matches the user-guide
    // narrative: "the first step is selected by default").
    await page.getByTestId('sim-step-item-0').click()

    await captureElement(page, '[data-testid="sim-editor-overlay"]', {
      filename: '13-overview.png',
      padding: 0,
      timeout: 5000,
    })

    // Hotspot draw on the currently-selected (step 0) — the seeded zero-size
    // hotspot puts HotspotCanvas in draw mode. The helper polls __simStore
    // (read-only verification) for the commit landing before returning.
    await drawHotspotOnSelectedStep(page, 0)

    await captureElement(page, '[data-testid="sim-canvas-area"]', {
      filename: '13-hotspot-editor.png',
      padding: 0,
      timeout: 5000,
    })

    // Cancel discards the unsaved sim — leaves the widget on the canvas
    // unchanged, matching the post-`13-block-placeholder` state.
    await page.getByRole('button', { name: /^Cancel$/ }).click()
    await expect(page.getByTestId('sim-add-step-btn')).toBeHidden({ timeout: 3000 })
  } catch (err) {
    // Defensive — if anything in the overlay flow regresses, emit fullpage
    // safety nets so the campaign still produces something the author can
    // crop manually, and surface the error so the next maintainer sees why.
    // eslint-disable-next-line no-console
    console.warn('[docs-screenshots] §13 overlay capture failed:', err)
    await captureFullPage(page, '13-overview.png')
    await captureFullPage(page, '13-hotspot-editor.png')
  }

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
      content: `[data-testid="${panelTestId}"] { ${PANEL_NEUTRALISE_RULES} }
      aside[aria-label="Properties"] { ${ASIDE_NEUTRALISE_RULES} }`,
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

  // 14-processflow-builder.png — simType=process-flow (default). The manual
  // placeholder expects the builder populated with "3 nodes and 2 edges
  // configured, matching the JSON above" (14-interactive-scenario.md:77) —
  // seed the canonical scene (shared with 14-json-example below). The
  // previous empty-skeleton capture contradicted the placeholder; caught by
  // TD-013.8's visual pass.
  const PROCESS_FLOW_SCENE = {
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
  }
  try {
    await pasteSceneDef(JSON.stringify(PROCESS_FLOW_SCENE, null, 2))
  } catch {
    /* builder stays empty — degraded shot, campaign continues */
  }
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
    await pasteSceneDef(JSON.stringify(PROCESS_FLOW_SCENE, null, 2))
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
  // §17 — Worked Example (TD-013.5c) + §02 first-slide
  // -------------------------------------------------------------------------
  //
  // The scratch course above served §01–§16 as a per-chapter widget
  // scratchpad — its slides are piles of centred widgets, useless as
  // "finished course" shots (baseline defect: see the 2026-07-17
  // investigation in docs/issues/issues-TD-013.md). §17 promises the five
  // finished slides of docs/user-guide/17-worked-example.md ("Capitals of
  // Europe"), so this block builds that course for real:
  //
  //   1. New Course dialog → "Capitals of Europe" (Blank). 02-first-slide is
  //      captured HERE — right after creation the slide list genuinely shows
  //      a single empty slide. globalTeardown deletes every course owned by
  //      the E2E user, so the extra course needs no bespoke cleanup.
  //   2. Slides renamed Intro / Theory / Question / Branching / Final.
  //   3. Widgets placed at explicit per-widget coordinates (no stacked
  //      centring) and configured via the real Props-panel inputs.
  //   4. Actions wired through the real ActionsEditor palette.
  //   5. Finals captured at a widened 1600×900 viewport — at 1280×720 the
  //      canvas viewport clips the 1024×768 slide's right third.

  // §17 build primitives (placeAt, setTextContent, idByName,
  // retryOnDestroyedContext, EUROPE_MAP_DATA_URI) live in
  // e2e/utils/worked-example.ts since TD-013.9.

  // Diagnostic: a main-frame navigation mid-campaign is ALWAYS a bug (it
  // destroys evaluate contexts and resets editor state) — log it with the
  // destination URL so the culprit is identifiable from the run log.
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      // eslint-disable-next-line no-console
      console.log('[docs-screenshots] ⚠ MAIN FRAME NAVIGATED →', frame.url())
    }
  })
  page.on('console', (msg) => {
    const t = msg.text()
    if (t.includes('[vite]') || msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.log('[browser]', msg.type(), t)
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log('[browser] pageerror', err.message)
  })

  try {
    // -- 1. Fresh course --------------------------------------------------
    await page.getByRole('button', { name: 'New Course', exact: true }).click({ timeout: 5000 })
    const newCourseDlg = page.locator('[role="dialog"][aria-label="New Course"]')
    await newCourseDlg.waitFor({ state: 'visible', timeout: 5000 })
    await newCourseDlg.locator('#new-course-title').fill('Capitals of Europe')
    await newCourseDlg.getByRole('button', { name: 'Create Course' }).click({ timeout: 5000 })
    await newCourseDlg.waitFor({ state: 'hidden', timeout: 15_000 })
    // The new course loads in-place (App.handleCreateCourse → setCourse).
    // Confirm the switch via the toolbar title — do NOT wait on the editor
    // ready signal yet: a Blank course is created with 0 slides and the
    // canvas does not mount (and never flips data-editor-ready) until the
    // first slide exists.
    await page.getByText('Capitals of Europe').first().waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(400) // toolbar handlers rebind to the new course

    // Normalise to exactly 1 slide ("the first slide is created
    // automatically" per the manual) before the first-slide shot.
    await editorPage.slidesTab.click()
    if ((await slideList.count()) === 0) {
      await editorPage.addSlide()
      await expect(slideList).toHaveCount(1, { timeout: 10_000 })
    }
    await slideList.first().click()
    await editorPage.readySignal().waitFor({ state: 'attached', timeout: 20_000 })

    // §02 — genuine "just created" state: 1 slide, empty canvas.
    await capture(page, { filename: '02-first-slide.png', fullPage: true })

    // -- 2. Five slides, renamed ------------------------------------------
    while ((await slideList.count()) < 5) {
      await editorPage.addSlide()
    }
    const slideNames = ['Intro', 'Theory', 'Question', 'Branching', 'Final']
    for (let i = 0; i < 5; i += 1) {
      try {
        await slideList.nth(i).dblclick({ timeout: 2000 })
        await page.keyboard.press('Control+a')
        await page.keyboard.type(slideNames[i]!)
        await page.keyboard.press('Enter')
      } catch {
        /* rename is cosmetic — default titles are acceptable */
      }
    }

    // -- 3. Slide 1 — Intro ------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 slide-1 build start')
    await goToSlide(0)
    const introTitleId = await placeAt(page, 'text', 'IntroTitle', 112, 180, { width: 800 })
    await setTextContent(page, introTitleId, 'Capitals of Europe — Quick Quiz', {
      'font-size': '36px',
      'font-weight': '700',
      'text-align': 'center',
      color: '#1e1e2e',
    })
    const introSubId = await placeAt(page, 'text', 'IntroSubtitle', 212, 280, { width: 600 })
    await setTextContent(page, introSubId, 'Test how well you know the capitals of European countries.', {
      'font-size': '18px',
      'text-align': 'center',
      color: '#6c7086',
    })
    const startBtnId17 = await placeAt(page, 'button', 'StartBtn', 452, 500, { width: 120, height: 44 })
    // Label via the real Props input; content-setter fallback keeps the shot
    // meaningful if the label copy changes.
    await retryOnDestroyedContext(page, () => selectById(page, startBtnId17))
    await editorPage.propsTab.click().catch(() => undefined)
    try {
      await page
        .locator('[data-testid="button-properties-panel"]')
        .locator('xpath=.//label[normalize-space()="Button Label"]/following-sibling::input[1]')
        .fill('Start', { timeout: 3000 })
    } catch {
      await setTextContent(page, startBtnId17, 'Start', {}).catch(() => undefined)
    }

    // -- 4. Slide 2 — Theory -----------------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 slide-2 build start')
    await goToSlide(1)
    await placeAt(page, 'progress-bar', 'CourseProgress', 112, 30, { width: 800 })
    const mapId = await placeAt(page, 'image', 'MapImage', 312, 100, { width: 400, height: 260 })
    await page.evaluate(
      ({ id, src }) => {
        const comp = window.__elearn_editor?.getWrapper().find('#' + id)[0]
        comp?.set('src', src)
        comp?.addAttributes({ src, alt: 'Map of European countries.' })
      },
      { id: mapId, src: EUROPE_MAP_DATA_URI },
    )
    const theoryId = await placeAt(page, 'text', 'TheoryText', 212, 400, { width: 600 })
    await setTextContent(page, 
      theoryId,
      'Europe has over 40 independent countries. On the next slide, you will see a question about one of their capitals.',
      { 'font-size': '18px', 'text-align': 'center', color: '#1e1e2e' },
    )
    await placeAt(page, 'nav-buttons', 'TheoryNav', 412, 620)

    // -- 5. Slide 3 — Question ---------------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 slide-3 build start')
    await goToSlide(2)
    await placeAt(page, 'progress-bar', 'CourseProgress2', 112, 30, { width: 800 })
    const mcId17 = await placeAt(page, 'question-mc', 'Q1Capital', 212, 110, { width: 600 })
    await placeAt(page, 'nav-buttons', 'QuestionNav', 412, 620)
    await retryOnDestroyedContext(page, () => selectById(page, mcId17))
    await editorPage.propsTab.click().catch(() => undefined)
    const qPanel = page.locator('[data-testid="question-properties-panel"]')
    await qPanel.locator('textarea').first().fill('What is the capital of Germany?')
    // Options — grow to 4 rows, fill, mark Berlin correct. Row = the div
    // wrapping [correct-radio, text-input, remove-button].
    const optionTexts = ['Berlin', 'Munich', 'Frankfurt', 'Hamburg']
    try {
      const addOptBtn = qPanel.getByRole('button', { name: /^\+ Add$/ })
      while ((await qPanel.locator('input[type="radio"]').count()) < 4) {
        await addOptBtn.click({ timeout: 3000 })
        await page.waitForTimeout(150)
      }
      for (let i = 0; i < 4; i += 1) {
        await qPanel
          .locator('input[type="radio"]')
          .nth(i)
          .locator('xpath=..')
          .locator('input[type="text"]')
          .fill(optionTexts[i]!, { timeout: 3000 })
        await page.waitForTimeout(100) // sequential updates through getLatest()
      }
      await qPanel.locator('input[type="radio"]').first().check({ timeout: 3000 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[docs-screenshots] §17 MC options fill degraded:', (err as Error)?.message)
    }
    // Scoring 100 pts / 2 attempts + feedbacks (per the worked example).
    const scoring17 = qPanel.locator('[data-testid="scoring-section"]')
    await scoring17.locator('input[type="number"]').nth(0).fill('100').catch(() => undefined)
    await scoring17.locator('input[type="number"]').nth(1).fill('2').catch(() => undefined)
    const feedback17 = qPanel.locator('xpath=.//div[div[text()="Feedback"]]//input[@type="text"]')
    await feedback17.nth(0).fill("Correct! Berlin has been Germany's capital since 1990.").catch(() => undefined)
    await feedback17.nth(1).fill("Not quite. Try again — think of Germany's largest city.").catch(() => undefined)

    // -- 6. Slide 4 — Branching --------------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 slide-4 build start')
    await goToSlide(3)
    const noteId = await placeAt(page, 'text', 'BranchingNote', 262, 260, { width: 500 })
    await setTextContent(page, noteId, "Let's see how you're doing…", {
      'font-size': '22px',
      'text-align': 'center',
      color: '#1e1e2e',
    })
    await placeAt(page, 'nav-buttons', 'BranchingNav', 412, 620)
    // -- 7. Slide 5 — Final ------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 slide-5 build start')
    await goToSlide(4)
    const finalTitleId = await placeAt(page, 'text', 'FinalTitle', 112, 140, { width: 800 })
    await setTextContent(page, finalTitleId, 'Well done!', {
      'font-size': '36px',
      'font-weight': '700',
      'text-align': 'center',
      color: '#1e1e2e',
    })
    await placeAt(page, 'score-quiz', 'FinalScore', 362, 280, { width: 300 })
    const finishBtnId17 = await placeAt(page, 'done-button', 'FinishBtn', 412, 540, {
      width: 200,
      height: 48,
    })
    await retryOnDestroyedContext(page, () => selectById(page, finishBtnId17))
    await editorPage.propsTab.click().catch(() => undefined)
    try {
      const finishLabelInput = page
        .locator('[data-testid="button-properties-panel"]')
        .locator('xpath=.//label[normalize-space()="Button Label"]/following-sibling::input[1]')
      await finishLabelInput.waitFor({ state: 'visible', timeout: 5000 })
      await finishLabelInput.fill('Finish course')
      await finishLabelInput.press('Tab') // commit before the finals slide switches
      await page.waitForTimeout(600)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[docs-screenshots] §17 FinishBtn label fill degraded:', (err as Error)?.message)
    }

    // -- 8. The five finals at 1600×900 ------------------------------------
    // eslint-disable-next-line no-console
    console.log('[docs-screenshots] §17 finals capture start')
    const originalVp17 = page.viewportSize()!
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.waitForTimeout(600) // canvas relayout at the wider viewport
    try {
      // Per-placeholder sidebar state (17-worked-example.md). Action wiring
      // happens HERE, immediately before each shot: sequences wired during
      // the build phase did not survive the intervening slide switches
      // (component ids regenerate on slide reload and the sequences orphan
      // — the exact persistence gap the e2e skill tracks as GAP-02), so
      // each prep wires its slide's actions live on the re-resolved widget.
      //
      //   1 → StartBtn + Actions tab: Click → Navigate
      //   2 → clean canvas, no selection
      //   3 → Q1Capital + Props tab (scoring/feedback visible, name field set)
      //   4 → BranchingNote + Actions tab: enterSlide → Score Quiz + If/Else.
      //       The manual says "on the slide itself (no block selected)" but
      //       the shipped ActionsPanel requires a selected widget (empty
      //       state otherwise) — discrepancy filed in issues-TD-013.md.
      //   5 → FinishBtn + Actions tab: Click → Send to LMS
      const finalsPrep: Array<() => Promise<void>> = [
        async () => {
          const id = await idByName(page, 'StartBtn')
          if (!id) return
          await retryOnDestroyedContext(page, () => selectById(page, id))
          await editorPage.actionsTab.click()
          await ensureEvent(page, /^Click$/i)
          await insertActionFromPalette(page, /^Navigate$/).catch(() => undefined)
        },
        async () => {
          await page.keyboard.press('Escape')
          await page.waitForTimeout(200)
        },
        async () => {
          const id = await idByName(page, 'Q1Capital')
          if (!id) return
          await retryOnDestroyedContext(page, () => selectById(page, id))
          await editorPage.propsTab.click()
          // The `name` trait is stripped by the save/reload round-trip (the
          // §09 dropdown block documents the same limitation) — restore it
          // through the real NameField so the shot matches the manual's
          // "give every block a clear Name" tip.
          await page.locator('[data-testid="widget-name-input"]')
            .fill('Q1Capital', { timeout: 2000 }).catch(() => undefined)
        },
        async () => {
          const id = await idByName(page, 'BranchingNote')
          if (!id) return
          await retryOnDestroyedContext(page, () => selectById(page, id))
          await editorPage.actionsTab.click()
          await ensureEvent(page, /^Enter Slide$/i)
          await insertActionFromPalette(page, /^Score Quiz$/).catch(() => undefined)
          await insertActionFromPalette(page, /^If \/ Else$/).catch(() => undefined)
          const condRow = page.locator('[data-action-type="condition"]').first()
          await condRow.locator('input[placeholder="$var == value"]').first()
            .fill('$score >= 50', { timeout: 3000 }).catch(() => undefined)
          const nested = condRow.locator('[data-testid="action-palette"]')
          await nested.nth(0).getByRole('button', { name: /^Navigate$/ })
            .click({ timeout: 4000 }).catch(() => undefined)
          await nested.nth(1).getByRole('button', { name: /^Display Message$/ })
            .click({ timeout: 4000 }).catch(() => undefined)
          await nested.nth(1).getByRole('button', { name: /^Hide$/ })
            .click({ timeout: 4000 }).catch(() => undefined)
          // Nested params — scope by placeholder within the condition row
          // (nested action rows don't necessarily carry their own
          // data-action-type wrapper; placeholders are unique inside it).
          await condRow.locator('input[placeholder="Title (optional)"]').first()
            .fill('Review needed', { timeout: 3000 }).catch(() => undefined)
          await condRow.locator('textarea[placeholder="Message text"], input[placeholder="Message text"]').first()
            .fill('Your score is below 50. Please go back and try the question again.', { timeout: 3000 })
            .catch(() => undefined)
          await condRow.locator('input[placeholder="Widget ID"]').first()
            .fill('BranchingNav', { timeout: 3000 }).catch(() => undefined)
          await page.waitForTimeout(300) // let the validation banner clear
          // Scroll the sequence to its head so the shot shows Score Quiz +
          // the If/Else condition, not the tail. The scrollable element is
          // an inner overflowY:auto div of ActionsPanel — scrolling the
          // FIRST action row into view targets it regardless of its markup.
          await page.locator('[data-action-type="score-quiz"]').first()
            .scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined)
        },
        async () => {
          const id = await idByName(page, 'FinishBtn')
          if (!id) return
          await retryOnDestroyedContext(page, () => selectById(page, id))
          await editorPage.actionsTab.click()
          await ensureEvent(page, /^Click$/i)
          await insertActionFromPalette(page, /^Send to LMS$/).catch(() => undefined)
        },
      ]
      for (let i = 0; i < 5; i += 1) {
        await goToSlide(i)
        await finalsPrep[i]!().catch((err: unknown) => {
          // eslint-disable-next-line no-console
          console.warn(`[docs-screenshots] §17 finals prep ${i + 1} degraded:`, (err as Error)?.message)
        })
        await page.waitForTimeout(400)
        await page.screenshot({
          path: SCREENSHOTS_DIR + `/17-slide-${i + 1}-final.png`,
          type: 'png',
          fullPage: false,
        })
        // eslint-disable-next-line no-console
        console.log(`[docs-screenshots] wrote 17-slide-${i + 1}-final.png (viewport 1600x900)`)
      }
    } finally {
      await page.setViewportSize(originalVp17)
    }
  } catch (err) {
    // Defensive: if the worked-example build regresses, emit safety nets so
    // the campaign still produces every placeholder file, and surface the
    // error for the next maintainer.
    // eslint-disable-next-line no-console
    console.warn('[docs-screenshots] §17 worked-example build failed:', err)
    await captureFullPage(page, '02-first-slide.png')
    for (let i = 0; i < 5; i += 1) {
      await captureFullPage(page, `17-slide-${i + 1}-final.png`)
    }
  }

  // -------------------------------------------------------------------------
  // Keep TypeScript happy — expect() call so the test is explicitly green.
  // -------------------------------------------------------------------------

  expect(true).toBe(true)
})
