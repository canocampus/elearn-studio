import { test, expect } from '../fixtures'

/**
 * T607 — E2E Tests: Audio Narration Properties Panel
 *
 * Verifies that the audio-narration widget can be added to a slide and that
 * selecting it in the Props tab shows the AudioNarrationPropertiesPanel with
 * the expected fields.
 *
 * T607.1 — Audio Narration block is visible in the Blocks panel (Media category)
 * T607.2 — Adding audio-narration widget and selecting it opens Props tab automatically
 * T607.3 — Props panel shows Audio Source and Playback Options sections
 * T607.4 — Typing a URL into the src field updates the component model
 * T607.5 — Playback option checkboxes (controls, autoplay) are present and interactive
 */

test.describe('T607 — Audio Narration Properties Panel', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T607.1 — Block visibility ─────────────────────────────────────────────

  test('T607.1 — Audio Narration block is visible in the Blocks panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.page.waitForTimeout(500)
    const block = editorPage.blockItem('Audio Narration')
    await expect(block).toBeVisible({ timeout: 10_000 })
  })

  // ─── T607.2 — Adding widget auto-switches to Props tab ─────────────────────

  test('T607.2 — Adding audio-narration widget via editor API selects it and switches to Props tab', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('audio-narration')
    await editorPage.page.waitForTimeout(500)

    // Props tab should be active (auto-switched by component:selected handler)
    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 })
  })

  // ─── T607.3 — Panel sections visible ──────────────────────────────────────

  test('T607.3 — Props panel shows Audio Source and Playback Options sections', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('audio-narration')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="audio-narration-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Section titles (uppercase via CSS text-transform, but text content is as written)
    await expect(panel.getByText('Audio Source')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Playback Options')).toBeVisible({ timeout: 5_000 })
  })

  // ─── T607.4 — URL input updates component model ───────────────────────────

  test('T607.4 — Typing a URL into the src field updates the component trait', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('audio-narration')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="audio-narration-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const srcInput = panel.locator('input[type="text"]').first()
    await expect(srcInput).toBeVisible({ timeout: 5_000 })

    await srcInput.fill('https://example.com/narration.mp3')

    // Verify the component model was updated via the editor API
    const modelSrc = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('src')
    })
    expect(modelSrc).toBe('https://example.com/narration.mp3')
  })

  // ─── T607.5 — Playback option checkboxes present ──────────────────────────

  test('T607.5 — Playback checkboxes (controls, autoplay) are present and interactive', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('audio-narration')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="audio-narration-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    await expect(panel.getByText('Show controls')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Autoplay on slide load')).toBeVisible({ timeout: 5_000 })

    // Toggle autoplay on
    const autoplayCheckbox = panel.locator('input[type="checkbox"]').nth(1) // controls=0, autoplay=1
    await autoplayCheckbox.check()

    const extProps = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('extendedProperties')
    })
    expect((extProps as { autoplay?: boolean })?.autoplay).toBe(true)
  })
})
