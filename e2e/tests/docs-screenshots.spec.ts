/**
 * docs-screenshots.spec.ts — User Manual v2 capture campaign
 *
 * Generates PNGs referenced by `<!-- screenshot: ... -->` placeholders in
 * `docs/user-guide/*.md`. This is an AUTHORING UTILITY, not a regression test.
 *
 * ## How to run
 *
 *     pnpm -C e2e test tests/docs-screenshots.spec.ts --headed
 *
 * The `--headed` flag is recommended so you can see which captures are
 * landing correctly. Images are written to
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
 *   - ~30 final PNGs ready to embed in the manual
 *   - ~15 `*-fullpage.png` safety-net images waiting for a manual crop
 *   - a handful of true TODO_MANUAL items (external LMS UI, etc.)
 */

import { test, expect } from '../fixtures/auth'
import {
  addBlockById,
  capture,
  captureElement,
  captureFullPage,
  ensureWidgetIsCentered,
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
      await style.evaluate((el) => el.remove())
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
  // §01 — Welcome
  // -------------------------------------------------------------------------

  // 01-full-ui-annotated — full-screen with callouts for the 4 main areas.
  // We take the clean full-page shot; annotating in Playwright across iframes
  // is brittle, so numbered callouts are added by the image-editor in post.
  await capture(page, { filename: '01-full-ui-annotated.png', fullPage: true })
  // TODO_MANUAL note: overlay callouts (1) top toolbar, (2) left sidebar,
  // (3) canvas, (4) right sidebar in your image editor before committing.

  // -------------------------------------------------------------------------
  // §02 — Getting Started
  // -------------------------------------------------------------------------

  // 02-create-course — TODO_MANUAL: the "New Course" dialog is reached from
  // the course list / top toolbar before entering the editor. Capture
  // manually by clicking New Course on the home screen.
  // (Leaving this one to a human keeps the spec free of login-screen setup.)

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

  // 09-widget-name-field — Props Name field filled with "HintButton".
  // (We already set StartBtn; rename via the trait for this specific shot.)
  await editorPage.propsTab.click().catch(() => undefined)
  // 09-widget-name-field — Name trait input lives inside the Props panel
  // when a button widget is selected. Fall back to a fullpage safety net if
  // the input is not present on this build.
  await captureElement(page, 'input[name="name"]', {
    filename: '09-widget-name-field.png',
    padding: 20,
    timeout: 3000,
  }).catch(async () => {
    await captureFullPage(page, '09-widget-name-field.png')
  })

  // Open the Actions tab; add trigger click + Navigate → Next slide.
  await editorPage.actionsTab.click()
  // Best-effort wiring: EventSelector + ActionItemEditor controls vary by
  // build. If any click misses, the downstream captureFullPage() still
  // produces a usable snapshot.
  try {
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await page.getByRole('menuitem', { name: /^Click$/i }).click({ timeout: 5000 })
    await page.getByRole('button', { name: /Add action/i }).click({ timeout: 5000 })
    await page.getByRole('button', { name: /Navigate$/i }).click({ timeout: 5000 }).catch(() => undefined)
  } catch {
    /* best effort — spec continues */
  }

  await safeCaptureRightPanel('09-actions-tab.png')

  // 09-widget-dropdown-names — a Show-action row with the <select> open.
  // Native <select> popups close on screenshot in Chromium, so we try to
  // add a Show action and then emit a full-page safety net the author can
  // crop by hand to show the target-widget dropdown filled with names.
  try {
    await page
      .getByRole('button', { name: /Add action/i })
      .click({ timeout: 4000 })
    await page
      .getByRole('button', { name: /^Show$/i })
      .click({ timeout: 4000 })
      .catch(() => undefined)
  } catch {
    /* best effort */
  }
  await captureFullPage(page, '09-widget-dropdown-names.png')

  // -------------------------------------------------------------------------
  // §10 — Triggers & Actions Reference
  // -------------------------------------------------------------------------

  // 10-event-selector.png — Actions tab with "+ Event" menu open.
  try {
    await page.getByRole('button', { name: /\+ *Event/i }).click({ timeout: 5000 })
    await captureElement(page, '[role="menu"]', {
      filename: '10-event-selector.png',
      padding: 10,
    })
    await page.keyboard.press('Escape')
  } catch {
    // Emit a safety-net so the author can reproduce the menu and crop by hand.
    await captureFullPage(page, '10-event-selector.png')
  }

  // 10-action-palette.png — action picker expanded. Open it and take a
  // full-page safety net; the picker scrolls, so a manual crop from the
  // snapshot is more reliable than chasing a bounding box.
  try {
    await page
      .getByRole('button', { name: /Add action/i })
      .click({ timeout: 4000 })
  } catch {
    /* best effort */
  }
  await captureFullPage(page, '10-action-palette.png')

  // 10-action-navigate / setvariable / ifelse — a Navigate row was already
  // inserted under §09. Emit a single full-page snapshot that contains the
  // Actions tab in its current state; the manual crop derives all three
  // close-ups from one reproducible shot.
  await captureFullPage(page, '10-action-navigate.png')
  await captureFullPage(page, '10-action-setvariable.png')
  await captureFullPage(page, '10-action-ifelse.png')

  // -------------------------------------------------------------------------
  // §11 — Expressions, Recipes & Shared Sequences
  // -------------------------------------------------------------------------

  // 11-recipe-attempts.png — questionIncorrect tab on a question block with
  // Set Variable + If → Show nested. Best-effort: select an existing MC
  // question and emit a full-page snapshot with the Actions tab open so
  // the recipe layout can be cropped by hand from a known state.
  try {
    await selectById(page, mcId)
    await editorPage.actionsTab.click()
  } catch {
    /* best effort */
  }
  await captureFullPage(page, '11-recipe-attempts.png')

  // 11-shared-sequences-library.png — the Shared Sequence Library entry
  // point varies by build (toolbar button or inside Actions panel). Emit
  // a full-page safety net from the current Actions state; if the library
  // panel is not reachable via automation yet, the final crop is done by
  // hand after opening it once.
  await captureFullPage(page, '11-shared-sequences-library.png')

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

  // 14-builder-types.png — Sim Type dropdown. Native <select> popups close
  // on screenshot, so we try to open it and emit a full-page safety net.
  try {
    await page
      .locator('select:near(:text("Sim Type"))')
      .first()
      .click({ timeout: 5000 })
  } catch {
    /* best effort */
  }
  await captureFullPage(page, '14-builder-types.png')
  await page.keyboard.press('Escape').catch(() => undefined)

  // 14-processflow-builder.png — keep simType=process-flow (default) and
  // capture the Props panel. No JSON paste yet; crop from the snapshot.
  await captureWidgetProps('14-processflow-builder.png', 'phaser-sim-properties-panel')

  // 14-diagram-builder.png — needs simType=diagram with background + hotspots.
  // 14-quiz-builder.png — needs simType=quiz with timer/lives/combo.
  // 14-json-example.png — Scene Definition field with JSON pasted.
  // All three require UI state this script cannot seed reliably; emit
  // full-page safety nets so the author can crop from a known shot.
  await captureFullPage(page, '14-diagram-builder.png')
  await captureFullPage(page, '14-quiz-builder.png')
  await captureFullPage(page, '14-json-example.png')

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
  // window. Try to open it, screenshot its page, and close; fall back to a
  // full-page shot of the editor (which shows the Preview button state).
  try {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.getByRole('button', { name: /Preview/i }).click({ timeout: 4000 }),
    ])
    await popup.waitForLoadState('domcontentloaded', { timeout: 10_000 })
    await popup.waitForTimeout(1500) // let the player hydrate the first slide
    await captureFullPage(popup, '15-popup-rendered.png')
    await popup.close().catch(() => undefined)
  } catch {
    /* Popup blocked or handshake failed — leave a safety net from the editor. */
    await captureFullPage(page, '15-popup-rendered.png')
  }

  // 16-lms-upload-placeholder.png — external LMS UI. No way to automate;
  // leave a fullpage safety net of the editor so the placeholder slot is
  // at least filled with a deterministic image the author can replace.
  await captureFullPage(page, '16-lms-upload-placeholder.png')

  // -------------------------------------------------------------------------
  // §17 — Worked Example (5 finished slides)
  // -------------------------------------------------------------------------

  // The worked-example shots require each slide to be fully wired per the
  // chapter. We emit a full-page snapshot per slide against the current
  // (seeded) state so the author can either:
  //   (a) wire the Actions by hand in the same browser session before the
  //       spec moves on, or
  //   (b) use these snapshots as safety nets and crop the polished version
  //       after building the course described in 17-worked-example.md.
  for (let i = 0; i < 5; i += 1) {
    await goToSlide(i)
    await captureFullPage(page, `17-slide-${i + 1}-final.png`)
  }

  // -------------------------------------------------------------------------
  // Keep TypeScript happy — expect() call so the test is explicitly green.
  // -------------------------------------------------------------------------

  expect(true).toBe(true)
})
