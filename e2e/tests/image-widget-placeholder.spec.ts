import { test, expect } from '../fixtures'

/**
 * T605 — E2E Tests: Image Widget Placeholder Hint
 *
 * Verifies that an image widget with no src assigned shows a visual
 * placeholder and tooltip so authors know how to assign an image.
 *
 * T605.1 — Image widget block is visible in the Blocks panel
 * T605.2 — New image widget (no src) has the GrapesJS empty class (gjs-plh-image)
 *           which the canvas CSS styles as a camera-icon + "Click to choose image" placeholder
 * T605.3 — The image element carries title="Double-click to open image selector"
 * T605.4 — After src is assigned the gjs-plh-image class is removed
 */

test.describe('T605 — Image Widget Placeholder Hint', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T605.1 — Block visible ────────────────────────────────────────────────

  test('T605.1 — Image block is visible in the Blocks panel', async ({ editorPage }) => {
    await editorPage.blocksTab.click()
    await editorPage.page.waitForTimeout(500)
    const block = editorPage.blockItem('Image')
    await expect(block).toBeVisible({ timeout: 10_000 })
  })

  // ─── T605.2 — New image widget has gjs-plh-image class ────────────────────

  test('T605.2 — New image widget with no src has the gjs-plh-image placeholder class', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('image')
    await editorPage.page.waitForTimeout(500)

    // The canvas renders inside an iframe — use canvasComponent()
    const img = editorPage.canvasComponent('img[data-gjs-type="image"]')
    await expect(img).toBeVisible({ timeout: 10_000 })

    // GrapesJS parent view adds this class when src is empty
    await expect(img).toHaveClass(/gjs-plh-image/, { timeout: 5_000 })
  })

  // ─── T605.3 — Tooltip attribute present ───────────────────────────────────

  test('T605.3 — Image widget has tooltip "Double-click to open image selector"', async ({ editorPage }) => {
    await editorPage.addComponentViaEditor('image')
    await editorPage.page.waitForTimeout(500)

    const img = editorPage.canvasComponent('img[data-gjs-type="image"]')
    await expect(img).toBeVisible({ timeout: 10_000 })

    await expect(img).toHaveAttribute('title', 'Double-click to open image selector', { timeout: 5_000 })
  })

  // ─── T605.4 — Placeholder class removed after src assigned ────────────────

  test('T605.4 — gjs-plh-image class is removed after src is assigned', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('image')
    await editorPage.page.waitForTimeout(500)

    // Confirm placeholder class is present first
    const img = editorPage.canvasComponent('img[data-gjs-type="image"]')
    await expect(img).toHaveClass(/gjs-plh-image/, { timeout: 10_000 })

    // Set a src via the GrapesJS API (simulates user selecting from AM)
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      ed?.getSelected()?.set('src', 'https://example.com/test-image.png')
    })
    await editorPage.page.waitForTimeout(800)

    // Placeholder class should be removed now that src is set
    await expect(img).not.toHaveClass(/gjs-plh-image/, { timeout: 5_000 })
  })
})
