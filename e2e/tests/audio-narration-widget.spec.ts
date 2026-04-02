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

  // ─── T607.6 — src survives save → slide-switch → return (WIDGETS_WITH_SRC_TRAIT regression) ──

  test('T607.6 — audio-narration src persists through slide-switch round-trip (BUG-T607-01 regression)', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')
    const slideAIndex = (await slides.count()) - 1

    // 1. Add audio-narration widget and set its src via editor API
    await editorPage.addComponentViaEditor('audio-narration')
    await page.waitForTimeout(300)

    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { set: (k: string, v: unknown) => void } | null
      } | undefined
      ed?.getSelected()?.set('src', 'https://example.com/narration.mp3')
    })
    await page.waitForTimeout(300)

    // 2. Wait for autosave PATCH to confirm persistence
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3_000))

    // 3. Switch to a new slide (forces a save+load cycle via EditorCanvas Effect 2)
    await editorPage.addSlide()
    await slides.last().click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 4. Return to slide A — triggers load from backend
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 5. src must survive the round-trip — regression test for WIDGETS_WITH_SRC_TRAIT fix
    const srcAfterReload = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getComponents: () => { models: Array<{ get: (k: string) => unknown; get type(): string }> }
      } | undefined
      const models = ed?.getComponents().models ?? []
      const audio = models.find((m) => (m.get('type') as string) === 'audio-narration')
      return audio?.get('src')
    })
    expect(srcAfterReload).toBe('https://example.com/narration.mp3')
  })
})
