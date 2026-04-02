import { test, expect } from '../fixtures'

/**
 * T608 — E2E Tests: Course Progress Bar widget
 *
 * Verifies that the progress-bar widget can be added to a slide and that:
 * - The block is visible in the Block Manager
 * - Selecting it auto-switches to the Props tab
 * - The props panel shows the expected appearance controls
 * - extendedProperties are updated when controls are changed
 *
 * T608.1 — progress-bar block is visible in the Blocks panel (Navigation category)
 * T608.2 — Adding widget auto-switches to Props tab
 * T608.3 — Props panel shows Appearance section with color, height, showPercent controls
 * T608.4 — Changing the bar color updates extendedProperties
 * T608.5 — Toggling showPercent updates extendedProperties
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
})
