import { test, expect } from '../fixtures'

/**
 * T634 — E2E Tests: Nav Buttons child components
 *
 * Regression: nav-buttons was rendered via onRender() HTML injection, so
 * component.components().at(0/1) returned undefined, causing the Props panel
 * to show "Nav Buttons component is missing child buttons. This component may
 * be corrupted." instead of the label inputs.
 *
 * Fix: replaced onRender() with defaults.components containing proper GrapesJS
 * child component objects. Child labels are persisted as prevLabel/nextLabel
 * in widget properties on store and restored via def.components on load.
 */

test.describe('T634 — Nav Buttons child components', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('@regression T634 — Props panel shows label inputs, not "missing child" error', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Add a nav-buttons widget to the canvas.
    await editorPage.dragBlockToCanvas('Nav Buttons', 400, 400)
    const navWidget = editorPage.canvasComponent('[data-gjs-type="nav-buttons"]')
    await expect(navWidget).toBeVisible({ timeout: 15_000 })

    // Select the component.
    await navWidget.click()

    // Open the Props tab in the right sidebar.
    await editorPage.propsTab.click()
    await page.waitForTimeout(300)

    // The error message must NOT appear.
    await expect(page.getByText('Nav Buttons component is missing child buttons')).not.toBeVisible()

    // The label inputs must appear.
    await expect(page.getByText('Previous Button')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Next Button')).toBeVisible({ timeout: 5_000 })
  })

  test('@regression T634 — canvas renders two visible buttons with default labels', async ({ editorPage }) => {
    test.setTimeout(60_000)

    // Add a nav-buttons widget to the canvas.
    await editorPage.dragBlockToCanvas('Nav Buttons', 400, 400)
    const navWidget = editorPage.canvasComponent('[data-gjs-type="nav-buttons"]')
    await expect(navWidget).toBeVisible({ timeout: 15_000 })

    // Both child buttons must be visible in the canvas iframe.
    const prevBtn = editorPage.canvasFrame().locator('button').filter({ hasText: '← Previous' })
    const nextBtn = editorPage.canvasFrame().locator('button').filter({ hasText: 'Next →' })
    await expect(prevBtn).toBeVisible({ timeout: 10_000 })
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })
  })

  test('T634 — label edits in Props panel update canvas buttons', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Add and select the widget.
    await editorPage.dragBlockToCanvas('Nav Buttons', 400, 400)
    const navWidget = editorPage.canvasComponent('[data-gjs-type="nav-buttons"]')
    await expect(navWidget).toBeVisible({ timeout: 15_000 })
    await navWidget.click()

    // Open Props tab.
    await editorPage.propsTab.click()
    await page.waitForTimeout(300)

    // Edit the Previous Button label.
    const prevInput = page.getByPlaceholder('← Previous')
    await prevInput.fill('Back')
    await prevInput.press('Tab')
    await page.waitForTimeout(300)

    // The canvas must reflect the new label.
    const prevBtn = editorPage.canvasFrame().locator('button').filter({ hasText: 'Back' })
    await expect(prevBtn).toBeVisible({ timeout: 5_000 })
  })
})
