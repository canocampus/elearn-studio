import { test, expect } from '../fixtures'

/**
 * T609 — E2E Tests: Global Volume Control widget
 *
 * Verifies that the volume-control widget can be added to a slide and that:
 * - The block is visible in the Block Manager
 * - Selecting it auto-switches to the Props tab
 * - The props panel shows the expected volume controls
 * - extendedProperties are updated when controls are changed
 *
 * T609.1 — volume-control block is visible in the Blocks panel (Media category)
 * T609.2 — Adding widget auto-switches to Props tab
 * T609.3 — Props panel shows Volume Options section with defaultVolume and showMute controls
 * T609.4 — Changing defaultVolume updates extendedProperties
 * T609.5 — Toggling showMute updates extendedProperties
 */

test.describe('T609 — Global Volume Control widget', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T609.1 — Block visibility ─────────────────────────────────────────────

  test('T609.1 — Volume Control block is visible in the Blocks panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.page.waitForTimeout(500)
    const block = editorPage.blockItem('Volume Control')
    await expect(block).toBeVisible({ timeout: 10_000 })
  })

  // ─── T609.2 — Adding widget auto-switches to Props tab ─────────────────────

  test('T609.2 — Adding volume-control widget selects it and switches to Props tab', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('volume-control')
    await editorPage.page.waitForTimeout(500)

    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 })
  })

  // ─── T609.3 — Panel sections visible ──────────────────────────────────────

  test('T609.3 — Props panel shows Volume Options section with expected controls', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('volume-control')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="volume-control-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    await expect(panel.getByText('Volume Options')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Default Volume (0–100)')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('Show mute button')).toBeVisible({ timeout: 5_000 })
  })

  // ─── T609.4 — Changing defaultVolume updates extendedProperties ───────────

  test('T609.4 — Typing a volume value updates extendedProperties.defaultVolume', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('volume-control')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="volume-control-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // The number input (not the range slider)
    const numberInput = panel.locator('input[type="number"]').first()
    await expect(numberInput).toBeVisible({ timeout: 5_000 })
    await numberInput.fill('60')

    const extProps = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { get: (k: string) => unknown } | null
      } | undefined
      return ed?.getSelected()?.get('extendedProperties')
    })
    expect((extProps as { defaultVolume?: number })?.defaultVolume).toBe(60)
  })

  // ─── T609.5 — Toggling showMute updates extendedProperties ────────────────

  test('T609.5 — Unchecking showMute updates extendedProperties.showMute to false', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('volume-control')
    await editorPage.page.waitForTimeout(500)
    await editorPage.propsTab.click()

    const panel = editorPage.page.locator('[data-testid="volume-control-properties-panel"]')
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
    expect((extProps as { showMute?: boolean })?.showMute).toBe(false)
  })
})
