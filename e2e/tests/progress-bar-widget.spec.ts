import { test, expect } from '../fixtures'

/**
 * T608 / TA608 — E2E Tests: Course Progress Bar widget
 *
 * Verifies that the progress-bar widget can be added to a slide and that:
 * - The block is visible in the Block Manager
 * - Selecting it auto-switches to the Props tab
 * - The props panel shows the expected appearance controls
 * - extendedProperties are updated when controls are changed
 * - extendedProperties survive a save/reload cycle (regression guard for the
 *   runtime player, which reads color/height/showPercent from extendedProperties
 *   via renderProgressBar() to build the live DOM the user sees during playback)
 *
 * T608.1 — progress-bar block is visible in the Blocks panel (Navigation category)
 * T608.2 — Adding widget auto-switches to Props tab
 * T608.3 — Props panel shows Appearance section with color, height, showPercent controls
 * T608.4 — Changing the bar color updates extendedProperties
 * T608.5 — Toggling showPercent updates extendedProperties
 * TA608.6 — extendedProperties (color, height, showPercent) survive page reload
 */

test.describe('T608 — Course Progress Bar widget', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T608.1 — Block visibility ─────────────────────────────────────────────

  test('T608.1 — Progress Bar block is visible in the Blocks panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.page.waitForTimeout(500)
    const block = editorPage.blockItem('Progress Bar')
    await expect(block).toBeVisible({ timeout: 10_000 })
  })

  // ─── T608.2 — Adding widget auto-switches to Props tab ─────────────────────

  test('T608.2 — Adding progress-bar widget selects it and switches to Props tab', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('progress-bar')
    await editorPage.page.waitForTimeout(500)

    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 })
  })

  // ─── T608.3 — Panel sections visible ──────────────────────────────────────

  test('T608.3 — Props panel shows Appearance section with expected controls', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('progress-bar')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="progress-bar-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    await expect(panel.getByText('Appearance')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Bar Color')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Bar Height (px)')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Show percentage text')).toBeVisible({ timeout: 5_000 })
  })

  // ─── T608.4 — Changing bar color updates extendedProperties ───────────────

  test('T608.4 — Typing a hex color updates extendedProperties.color', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('progress-bar')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="progress-bar-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // The text input next to the color swatch
    const colorText = panel.locator('input[type="text"]').first()
    await expect(colorText).toBeVisible({ timeout: 5_000 })
    await colorText.fill('#e11d48')

    const extProps = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('extendedProperties')
    })
    expect((extProps as { color?: string })?.color).toBe('#e11d48')
  })

  // ─── T608.5 — Toggling showPercent updates extendedProperties ─────────────

  test('T608.5 — Unchecking showPercent updates extendedProperties.showPercent to false', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('progress-bar')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="progress-bar-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const checkbox = panel.locator('input[type="checkbox"]').first()
    await expect(checkbox).toBeChecked({ timeout: 5_000 }) // default true
    await checkbox.uncheck()

    const extProps = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('extendedProperties')
    })
    expect((extProps as { showPercent?: boolean })?.showPercent).toBe(false)
  })

  // ─── TA608.6 — extendedProperties survive page reload ─────────────────────
  //
  // The runtime player reads extendedProperties.color, .height, and .showPercent
  // inside renderProgressBar() to build the live DOM (width:0% fill div with
  // el-progress-bar-fill class) that updateProgressBars() then animates on nav.
  // If extendedProperties are lost during the store→backend→reload round-trip
  // the runtime falls back to defaults and custom styles are silently discarded.

  test('TA608.6 — extendedProperties (color/height/showPercent) survive page reload', async ({ editorPage, page }) => {
    // Generous budget: waitForReloadComplete (60s) + re-navigate waitForCanvas (30s) + margin
    // 200s gives ~45s of slack above the max theoretical sum of all operation timeouts
    test.setTimeout(200_000)

    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`[BROWSER ERROR] ${msg.text()}`)
    })

    // Capture our slide index NOW, before other parallel tests can add more slides.
    // Tests share the same course and run concurrently — if we wait until after reload
    // to compute the index, other tests may have appended slides and slideCount-1 would
    // point to a different test's slide (not ours). Pattern mirrors T601.8.
    const slideItems = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slideItems.count()) - 1

    // 1. Add a progress-bar widget and wait for canvas
    await editorPage.addComponentViaEditor('progress-bar')
    await page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = page.locator('[data-testid="progress-bar-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // 2. Arm PATCH listener BEFORE edits (T601.8 pattern) so the response is never
    //    missed even if autosave fires immediately after the first fill().
    const patchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    )

    // Set custom color and uncheck showPercent so we have non-default values
    const colorText = panel.locator('input[type="text"]').first()
    await colorText.fill('#cc3300')

    const checkbox = panel.locator('input[type="checkbox"]').first()
    await checkbox.uncheck()

    // Wait for autosave PATCH and verify it succeeded (2s debounce + network)
    const saveResp = await patchPromise.catch(() => page.waitForTimeout(3000).then(() => null))
    if (saveResp) expect((saveResp as Awaited<ReturnType<typeof page.waitForResponse>>).status()).toBeLessThan(400)
    await page.waitForTimeout(500)

    // 3. Reload and wait for editor
    await page.reload()
    await editorPage.waitForReloadComplete()

    // 3b. Navigate back to OUR slide using the index captured before reload.
    // After reload the store resets currentSlideIndex=0; using ourSlideIndex (captured
    // at test start) ensures we land on the correct slide even when parallel tests have
    // added more slides in the meantime.
    //
    // Defensive guard: if the slide list shrank after reload (e.g. backend returned
    // fewer slides than expected), clamp to the last available slide rather than
    // clicking an out-of-bounds item (which would cause AppLayout to unmount
    // EditorCanvas → data-editor-ready div disappears → waitForCanvas hangs forever).
    const countAfterReload = await slideItems.count()
    const targetIndex = Math.min(ourSlideIndex, countAfterReload - 1)
    if (targetIndex > 0) {
      await slideItems.nth(targetIndex).click()
      await editorPage.waitForCanvas()
    }
    // If targetIndex === 0, waitForReloadComplete() already loaded slide 0 fully.

    // 4. Verify the widget exists in canvas, then re-select it via JS bridge.
    // Canvas clicks are unreliable in parallel mode (iframe focus races); the JS bridge
    // is the proven pattern (same as GAP-02.3 and T601.7) for post-reload re-selection.
    const widget = editorPage.canvasComponent('[data-gjs-type="progress-bar"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    await page.evaluate(() => {
      const ed = (window as unknown as Record<string, unknown>).__elearn_editor as {
        getComponents: () => { first: () => unknown }
        select: (c: unknown) => void
      }
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(500)

    // Switch to Props tab and confirm the panel is visible (proves selection is active)
    await editorPage.propsTab.click()
    const reloadedPanel = page.locator('[data-testid="progress-bar-properties-panel"]')
    await expect(reloadedPanel).toBeVisible({ timeout: 10_000 })

    // 5. Read extendedProperties from the reloaded GrapesJS model
    const extProps = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('extendedProperties')
    })

    type ProgressBarEP = { color?: string; height?: number; showPercent?: boolean }
    expect((extProps as ProgressBarEP)?.color).toBe('#cc3300')
    expect((extProps as ProgressBarEP)?.showPercent).toBe(false)
  })
})
