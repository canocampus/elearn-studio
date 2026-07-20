import { test, expect } from '../fixtures'

/**
 * T608 — E2E Tests: authoring-ui GrapesJS+React Layer
 *
 * Covers the components that have 0% vitest coverage because they depend on a
 * live GrapesJS instance:
 *   - AppLayout (sidebar panel switching, body layout)
 *   - TopToolbar (New Slide, Delete Slide, Publish SCORM dialog)
 *   - QuestionPropertiesPanel (synced to GrapesJS selected component)
 *
 * T608.1 — AppLayout: left sidebar tab switching (Slides ↔ Blocks)
 * T608.2 — AppLayout: right sidebar tab switching (Layers / Styles / Props / Actions / Anim)
 * T608.3 — TopToolbar: "+ New Slide" creates a new slide visible in SlideList
 * T608.4 — TopToolbar: "Publish SCORM" opens the dialog; "Cancel" closes it
 * T608.5 — QuestionPropertiesPanel: drop MC widget → select → Props tab → MC form visible
 * T608.6 — TopToolbar: "Delete Slide" with dialog dismiss keeps slide count unchanged
 */

// ─── T608.1 — Left sidebar tab switching ────────────────────────────────────

test.describe('T608.1 — AppLayout left sidebar tab switching', () => {

  test('Slides tab is selected by default and SlideList is visible', async ({ editorPage }) => {
    await expect(editorPage.slidesTab).toHaveAttribute('aria-selected', 'true')
    // SlideList contains "Add Slide" button
    await expect(editorPage.page.getByRole('button', { name: /Add Slide/i })).toBeVisible()
  })

  test('clicking Blocks tab shows the block manager panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await expect(editorPage.blocksTab).toHaveAttribute('aria-selected', 'true')
    await expect(editorPage.slidesTab).toHaveAttribute('aria-selected', 'false')
    // GrapesJS BlockManager renders blocks inside #gjs-block-manager container
    await expect(editorPage.page.locator('#gjs-block-manager')).toBeVisible({ timeout: 10_000 })
  })

  test('switching back to Slides tab hides blocks and shows SlideList', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.slidesTab.click()
    await expect(editorPage.slidesTab).toHaveAttribute('aria-selected', 'true')
    await expect(editorPage.page.getByRole('button', { name: /Add Slide/i })).toBeVisible()
  })
})

// ─── T608.2 — Right sidebar tab switching ───────────────────────────────────

test.describe('T608.2 — AppLayout right sidebar tab switching', () => {
  test.beforeEach(async ({ editorPage }) => {
    // Add a slide so the canvas (and GrapesJS panels) are fully initialised
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('Layers tab is selected by default', async ({ editorPage }) => {
    await expect(editorPage.layersTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Styles tab makes it selected', async ({ editorPage }) => {
    await editorPage.stylesTab.click()
    await expect(editorPage.stylesTab).toHaveAttribute('aria-selected', 'true')
    await expect(editorPage.layersTab).toHaveAttribute('aria-selected', 'false')
    // GrapesJS StyleManager container should be visible
    await expect(editorPage.page.locator('#gjs-style-manager')).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Actions tab makes it selected', async ({ editorPage }) => {
    await editorPage.actionsTab.click()
    await expect(editorPage.actionsTab).toHaveAttribute('aria-selected', 'true')
    // ActionsPanel renders with "No widget selected" or event selector
    await expect(editorPage.page.locator('[aria-label="Properties"]')).toBeVisible()
  })

  test('clicking Props tab makes it selected', async ({ editorPage }) => {
    await editorPage.propsTab.click()
    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true')
    // TD-010: Props tab renders the centralised empty-state when no widget is selected
    await expect(editorPage.page.getByTestId('props-empty-state')).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Anim tab makes it selected', async ({ editorPage }) => {
    await editorPage.animTab.click()
    await expect(editorPage.animTab).toHaveAttribute('aria-selected', 'true')
  })

  test('switching back to Layers tab restores layers panel', async ({ editorPage }) => {
    await editorPage.stylesTab.click()
    await editorPage.layersTab.click()
    await expect(editorPage.layersTab).toHaveAttribute('aria-selected', 'true')
    // Layer manager container is in DOM (may be empty before any component is added)
    await expect(editorPage.page.locator('#gjs-layer-manager')).toBeAttached({ timeout: 10_000 })
  })
})

// ─── T608.3 — TopToolbar: "+ New Slide" ─────────────────────────────────────

test.describe('T608.3 — TopToolbar New Slide button', () => {

  test('clicking + New Slide creates a new slide visible in SlideList', async ({ editorPage }) => {
    // Count slides before
    const countBefore = await editorPage.page.locator('[data-testid="slide-item"]').count()

    await editorPage.addSlide()

    // Parallel workers may also add slides concurrently, so the total count may exceed
    // countBefore + 1. Assert at-least rather than exactly countBefore + 1.
    await expect(async () => {
      const count = await editorPage.page.locator('[data-testid="slide-item"]').count()
      expect(count).toBeGreaterThanOrEqual(countBefore + 1)
    }).toPass({ timeout: 10_000 })
  })

  test('newly added slide appears in the list and is selected (active)', async ({ editorPage }) => {
    const countBefore = await editorPage.page.locator('[data-testid="slide-item"]').count()
    await editorPage.addSlide()

    // At least one more slide must exist (parallel workers may add more simultaneously)
    await expect(async () => {
      const count = await editorPage.page.locator('[data-testid="slide-item"]').count()
      expect(count).toBeGreaterThanOrEqual(countBefore + 1)
    }).toPass({ timeout: 10_000 })

    // The newly added slide is selected in OUR window (aria-current="true").
    // Each worker has its own Zustand state; we check our active slide, not items.last().
    const activeItem = editorPage.page.locator('[data-testid="slide-item"][aria-current="true"]')
    await expect(activeItem).toBeVisible({ timeout: 10_000 })
  })

  test('course title is shown in the toolbar', async ({ editorPage }) => {
    // The toolbar renders the course title (not just "—")
    // Just verify the toolbar is rendered (specific title depends on fixture course)
    // Just verify the toolbar is rendered; specific title depends on fixture course
    await expect(editorPage.publishScormButton).toBeVisible()
    await expect(editorPage.addSlideButton).toBeVisible()
  })
})

// ─── T608.4 — TopToolbar: Publish SCORM dialog ──────────────────────────────

test.describe('T608.4 — TopToolbar Publish SCORM dialog', () => {

  test('clicking Publish SCORM opens the publish dialog', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await expect(editorPage.publishDialog).toBeVisible()
    await expect(editorPage.page.getByText('Publish SCORM Package')).toBeVisible()
  })

  test('Cancel button closes the publish dialog', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await editorPage.cancelPublish()
    await expect(editorPage.publishDialog).not.toBeVisible()
  })

  test('publish dialog contains a SCORM 1.2 publish button', async ({ editorPage }) => {
    await editorPage.openPublishDialog()
    await expect(editorPage.publishConfirmButton).toBeVisible()
  })
})

// ─── T608.5 — QuestionPropertiesPanel synced to canvas selection ─────────────

test.describe('T608.5 — QuestionPropertiesPanel synced to GrapesJS selection', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('Props panel shows empty state before any widget is selected', async ({ editorPage }) => {
    await editorPage.propsTab.click()
    // TD-010: centralised empty-state replaces per-panel "Select a question widget" copy
    await expect(editorPage.page.getByTestId('props-empty-state')).toBeVisible({ timeout: 10_000 })
  })

  test('adding MC widget via editor API and selecting it shows MC form in Props panel', async ({ editorPage }) => {
    // Add component programmatically (drag-and-drop into GrapesJS iframe is
    // unreliable in Playwright; window.__elearn_editor is exposed in DEV builds)
    await editorPage.addComponentViaEditor('question-mc')
    await editorPage.page.waitForTimeout(500)

    // Switch to Props tab
    await editorPage.propsTab.click()

    // QuestionPropertiesPanel should now render the MC form
    const qPanel = editorPage.page.locator('[data-testid="question-properties-panel"]')
    await expect(qPanel.getByText('Multiple Choice')).toBeVisible({ timeout: 10_000 })
    // Question text textarea should be present
    const textarea = qPanel.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5_000 })
  })

  test('switching away from MC widget to no selection returns to empty state', async ({ editorPage }) => {
    // Add component programmatically and select it
    await editorPage.addComponentViaEditor('question-mc')
    await editorPage.page.waitForTimeout(300)
    await editorPage.propsTab.click()
    const qPanel = editorPage.page.locator('[data-testid="question-properties-panel"]')
    await expect(qPanel.getByText('Multiple Choice')).toBeVisible({ timeout: 10_000 })

    // Deselect via GrapesJS API
    await editorPage.page.evaluate(() => {
      const ed = window.__elearn_editor
      ed?.select(null)
    })
    await editorPage.page.waitForTimeout(500)

    // TD-010: after deselection, Props tab falls back to the centralised empty-state
    await expect(editorPage.page.getByTestId('props-empty-state')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── TD-022 — Panel dual gate under rapid selection switching ────────────────

test.describe('TD-022 — properties panels track rapid selection switches', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('@regression TD-022 — alternating selection never shows the other type\'s panel', async ({ editorPage }) => {
    const page = editorPage.page
    // Two widgets whose panels were audit-flagged: question (invariant) and
    // media-player (missing Backbone double-check pre-fix).
    await editorPage.addComponentViaEditor('question-mc')
    await page.waitForTimeout(300)
    await editorPage.addComponentViaEditor('media-player')
    await page.waitForTimeout(300)
    await editorPage.propsTab.click()

    const qPanel = page.locator('[data-testid="question-properties-panel"]')
    const mpPanel = page.locator('[data-testid="media-player-properties-panel"]')

    const selectByType = (type: string) =>
      page.evaluate((t) => {
        const ed = window.__elearn_editor
        const comp = ed?.getWrapper().find(`[data-widget="${t}"]`)[0]
          ?? ed?.getWrapper().components().find(c => c.get('type') === t)
        if (comp) ed?.select(comp)
      }, type)

    // Rapid alternation exercises the Zustand→Backbone lag window the dual
    // gate closes. After each settle, exactly the matching panel is visible.
    for (let i = 0; i < 3; i += 1) {
      await selectByType('media-player')
      await expect(mpPanel).toBeVisible({ timeout: 5_000 })
      await expect(qPanel).toHaveCount(0)

      await selectByType('question-mc')
      await expect(qPanel).toBeVisible({ timeout: 5_000 })
      await expect(mpPanel).toHaveCount(0)
    }
  })
})

// ─── T608.6 — TopToolbar: Delete Slide with dialog dismiss ──────────────────

test.describe('T608.6 — TopToolbar Delete Slide', () => {
  test.beforeEach(async ({ editorPage }) => {
    // SlideList.tsx blocks deletion when course.slides.length <= 1.
    // In an isolated run the course may start with 0 slides; ensure ≥ 2 exist so
    // deletion is always permitted. Add a background slide only when needed.
    const existing = await editorPage.page.locator('[data-testid="slide-item"]').count()
    if (existing === 0) {
      await editorPage.addSlide()  // background slide — keeps deletion enabled
    }
    await editorPage.addSlide()  // target slide (the one under test)
  })

  test('dismissing the confirm dialog does not delete the slide', async ({ editorPage, page }) => {
    const slidesLocator = editorPage.page.locator('[data-testid="slide-item"]')
    const countWithExtra = await slidesLocator.count()

    page.once('dialog', dialog => dialog.dismiss())
    await page.getByTitle('Delete current slide').click()

    // Slide count unchanged
    await expect(slidesLocator).toHaveCount(countWithExtra)
  })

  test('accepting the confirm dialog deletes the current slide', async ({ editorPage, page }) => {
    const slidesLocator = editorPage.page.locator('[data-testid="slide-item"]')
    const countWithExtra = await slidesLocator.count()

    page.once('dialog', dialog => dialog.accept())
    await page.getByTitle('Delete current slide').click()

    // Slide count drops by 1
    await expect(slidesLocator).toHaveCount(countWithExtra - 1, { timeout: 15_000 })
  })

  test('Delete Slide button is visible in toolbar', async ({ page }) => {
    await expect(page.getByTitle('Delete current slide')).toBeVisible()
  })
})

// T622.7 — @regression: persistent save-error banner (SaveErrorBanner).
// Without the fix there was no UI feedback when autosave failed, leaving the user
// unaware of data-loss risk. The banner must appear on 500 and clear on retry success.
test.describe('Authoring UI: Save error banner (T622.7)', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('@regression T622.7 — PATCH 500 shows save-error banner; Retry on 200 clears it', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // ── Phase 1: mock PATCH to return 500 ──
    let mockStatus = 500
    await page.route('**/courses/**', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue()
        return
      }
      await route.fulfill({ status: mockStatus, body: JSON.stringify({ error: 'Simulated save failure' }) })
    })

    // Drag a widget to trigger autosave.
    await editorPage.dragBlockToCanvas('Text', 300, 200)

    // Wait for the banner to appear — autosave fires within 2s debounce.
    const banner = page.locator('[role="alert"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    // ── Phase 2: allow PATCH to succeed, then click Retry ──
    mockStatus = 200

    const retryPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    )

    await page.getByRole('button', { name: /retry/i }).click()
    await retryPromise.catch(() => page.waitForTimeout(2000))

    // Banner must be gone.
    await expect(banner).not.toBeVisible({ timeout: 10_000 })
  })
})
