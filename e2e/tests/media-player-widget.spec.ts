import { test, expect } from '../fixtures'

/**
 * T604 — E2E Tests: Media Player Properties Panel
 *
 * Verifies that the media-player widget can be added to a slide and that
 * selecting it in the Props tab shows the MediaPlayerPropertiesPanel with
 * the expected fields.
 *
 * T604.1 — Media Player block is visible in the Blocks panel (Media category)
 * T604.2 — Adding media-player widget and selecting it opens Props tab automatically
 * T604.3 — Props panel shows Media Source, Media Type, and Playback Options sections
 * T604.4 — Typing a URL into the src field updates the component model
 * T604.5 — Changing mediaType to "audio" reflects in the select field
 * T604.6 — Playback option checkboxes (controls, autoplay, loop) are present
 *
 * T632 — Asset Manager type filtering (@regression T632)
 * T632.4 — "Choose from Asset Library…" button opens the GrapesJS Asset Manager
 */

test.describe('T604 — Media Player Properties Panel', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T604.1 — Block visibility ─────────────────────────────────────────────

  test('T604.1 — Media Player block is visible in the Blocks panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.page.waitForTimeout(500)
    const block = editorPage.blockItem('Media Player')
    await expect(block).toBeVisible({ timeout: 10_000 })
  })

  // ─── T604.2 — Adding widget auto-switches to Props tab ─────────────────────

  test('T604.2 — Adding media-player widget via editor API selects it and switches to Props tab', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)

    // Props tab should be active (auto-switched by component:selected handler)
    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 })
  })

  // ─── T604.3 — Panel sections visible ──────────────────────────────────────

  test('T604.3 — Props panel shows Media Source, Media Type, and Playback Options sections', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="media-player-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Section titles (uppercase via CSS text-transform, but text content is as written)
    await expect(panel.getByText('Media Source')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Media Type')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Playback Options')).toBeVisible({ timeout: 5_000 })
  })

  // ─── T604.4 — URL input updates component model ───────────────────────────

  test('T604.4 — Typing a URL into the src field updates the component trait', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="media-player-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const srcInput = panel.locator('input[type="text"]').first()
    await expect(srcInput).toBeVisible({ timeout: 5_000 })

    await srcInput.fill('https://example.com/test-video.mp4')

    // Verify the component model was updated via the editor API
    const modelSrc = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('src')
    })
    expect(modelSrc).toBe('https://example.com/test-video.mp4')
  })

  // ─── T604.5 — Media type selector works ───────────────────────────────────

  test('T604.5 — Changing media type to audio reflects in the select and model', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="media-player-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const typeSelect = panel.locator('select').first()
    await expect(typeSelect).toBeVisible({ timeout: 5_000 })

    // Default should be video
    await expect(typeSelect).toHaveValue('video')

    // Switch to audio
    await typeSelect.selectOption('audio')
    await expect(typeSelect).toHaveValue('audio')

    // Verify model updated
    const modelType = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('mediaType')
    })
    expect(modelType).toBe('audio')
  })

  // ─── T604.6 — Playback option checkboxes present ──────────────────────────

  test('T604.6 — Playback checkboxes (controls, autoplay, loop) are present and interactive', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="media-player-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    await expect(panel.getByText('Show controls')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Autoplay')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Loop')).toBeVisible({ timeout: 5_000 })

    // Toggle autoplay on
    const autoplayCheckbox = panel.locator('input[type="checkbox"]').nth(1) // controls=0, autoplay=1, loop=2
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

// ─── T632 — Asset Manager type filtering (@regression T632) ───────────────────

test.describe('T632 — Media Player Asset Manager integration', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // T632.4 — "Choose from Asset Library…" opens AM (smoke: no pre-seeded assets needed)
  test('T632.4 — "Choose from Asset Library…" button opens the Asset Manager modal (@regression T632)', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('media-player')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="media-player-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // The "Choose from Asset Library…" button must be visible (T632: AM type filtering fix)
    const amButton = panel.getByText('Choose from Asset Library…')
    await expect(amButton).toBeVisible({ timeout: 5_000 })

    // Click it — the GrapesJS Asset Manager modal should open
    await amButton.click()
    await editorPage.page.waitForTimeout(500)

    // AM modal is rendered outside the panel — look for GrapesJS AM container
    const amModal = page.locator('.gjs-am-assets-cont, [class*="gjs-am"]').first()
    await expect(amModal).toBeVisible({ timeout: 5_000 })

    // Close the AM by pressing Escape
    await page.keyboard.press('Escape')
  })
})
