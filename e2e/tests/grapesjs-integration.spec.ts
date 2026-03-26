import { test, expect } from '../fixtures'

/**
 * GrapesJS Integration Tests — DEFENSIVE VERSION
 * 
 * Verifies that the absolute positioning engine (dragMode: 'absolute') 
 * and resize handlers are working correctly (external_issues-T500).
 */

test.describe('GrapesJS Integration: Positioning & Resizing', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    // 1. Diagnostics: Log any browser errors
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })

    // 2. Navigate and wait for toolbar only (canvas may not exist yet)
    await editorPage.goto()

    // 3. Always add a fresh slide so each test starts with an empty canvas.
    // This gives test isolation — no leftover widgets from previous tests.
    await editorPage.addSlide()

    // 4. Wait for the GrapesJS canvas iframe — guaranteed after addSlide()
    await editorPage.waitForCanvas()
  })

  test('dropped widgets land at the correct coordinates (X, Y)', async ({ editorPage, page: _page }) => {
    const targetX = 350
    const targetY = 250

    // 1. Drag a Rectangle block onto the canvas
    await editorPage.dragBlockToCanvas('Rectangle', targetX, targetY)

    // 2. Locate the new rectangle inside the iframe
    const rect = editorPage.canvasComponent('[data-gjs-type="rectangle"]')
    await expect(rect).toBeVisible({ timeout: 15_000 })

    // 3. Verify its position relative to the iframe origin.
    // boundingBox() on frameLocator content returns viewport coords, so we must
    // subtract the iframe's own x/y to get canvas-relative coordinates.
    const box = await rect.boundingBox()
    const iframeBox = await editorPage.getCanvasIframeBox()
    expect(box).not.toBeNull()
    expect(iframeBox).not.toBeNull()
    if (box && iframeBox) {
      const relX = box.x - iframeBox.x
      const relY = box.y - iframeBox.y
      // Allow for a 50px margin of error for GrapesJS drop coordinate rounding
      expect(Math.abs(relX - targetX)).toBeLessThan(50)
      expect(Math.abs(relY - targetY)).toBeLessThan(50)
    }
  })

  test('widgets do not jump to (20, 20) on drop', async ({ editorPage, page: _page }) => {
    const targetX = 400
    const targetY = 300

    await editorPage.dragBlockToCanvas('Button', targetX, targetY)

    const btn = editorPage.canvasComponent('[data-gjs-type="button"]')
    const box = await btn.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      // Definitely away from top-left (20, 20)
      expect(box.x).toBeGreaterThan(150)
      expect(box.y).toBeGreaterThan(150)
    }
  })

  test('widgets are resizable via GrapesJS anchors', async ({ editorPage, page }) => {
    // Drop a rectangle
    await editorPage.dragBlockToCanvas('Rectangle', 100, 100)
    // Use .last() to select the most recently dropped rectangle in case
    // the canvas has leftover widgets from a previous run
    const rect = editorPage.canvasComponent('[data-gjs-type="rectangle"]').last()

    // Select it
    await rect.click()
    await page.waitForTimeout(500)
    
    // GrapesJS renders resize anchors in the HOST page DOM (overlaying the iframe),
    // not inside the iframe itself. Do NOT use canvasComponent() here.
    const resizer = page.locator('.gjs-resizer-h-br')
    await resizer.waitFor({ state: 'visible', timeout: 10_000 })

    const initialBox = await rect.boundingBox()
    if (!initialBox) throw new Error('Initial bounding box null')

    const resizerBox = await resizer.boundingBox()
    if (!resizerBox) throw new Error('Resizer bounding box null')

    // Drag the resizer
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(resizerBox.x + 100, resizerBox.y + 100, { steps: 5 })
    await page.mouse.up()

    // Verify resize
    const finalBox = await rect.boundingBox()
    if (!finalBox) throw new Error('Final bounding box null')

    expect(finalBox.width).toBeGreaterThan(initialBox.width + 20)
    expect(finalBox.height).toBeGreaterThan(initialBox.height + 20)
  })

})
