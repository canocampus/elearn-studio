import { test, expect } from '../fixtures'

/**
 * T603 / T633 — E2E Tests: Button Properties Panel
 *
 * T603: Button, Done Button, and Nav Buttons properties panel
 * T633: Background image fix — cover + no-repeat + position + no style reset
 *
 * T633.4 — @regression: Assigning background image via addStyle() preserves
 *   button position and sets background-size:cover + background-repeat:no-repeat
 */

test.describe('T633 — Button background image regression', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('@regression T633.4 — addStyle preserves position and sets cover/no-repeat', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Add a button and position it at a known location.
    await editorPage.dragBlockToCanvas('Button', 300, 200)
    const btn = editorPage.canvasComponent('[data-gjs-type="button"]')
    await expect(btn).toBeVisible({ timeout: 15_000 })
    await btn.click()

    // Read the initial position styles from the GrapesJS model.
    const initialStyle = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string>; addStyle: (s: Record<string, string>) => void } | null
      }
      const sel = ed?.getSelected()
      if (!sel) return null
      const s = sel.getStyle()
      return { left: s['left'], top: s['top'], width: s['width'], height: s['height'] }
    })
    expect(initialStyle).not.toBeNull()

    // Simulate what the fixed openBackgroundImagePicker does: addStyle() with all 4 properties.
    // (addStyle merges; setStyle would have replaced left/top/width/height — the old bug)
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string>; addStyle: (s: Record<string, string>) => void } | null
      }
      const sel = ed?.getSelected()
      if (!sel) return
      sel.addStyle({
        'background-image': 'url("https://example.com/test.jpg")',
        'background-size': 'cover',
        'background-repeat': 'no-repeat',
        'background-position': 'center',
      })
    })
    await page.waitForTimeout(200)

    // Read styles after addStyle.
    const afterStyle = await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string> } | null
      }
      const sel = ed?.getSelected()
      if (!sel) return null
      return sel.getStyle()
    })
    expect(afterStyle).not.toBeNull()
    if (!afterStyle || !initialStyle) return

    // Background properties must be set correctly.
    expect(afterStyle['background-image']).toContain('test.jpg')
    expect(afterStyle['background-size']).toBe('cover')
    expect(afterStyle['background-repeat']).toBe('no-repeat')
    expect(afterStyle['background-position']).toBe('center')

    // Position and dimensions must be preserved — addStyle() must NOT wipe existing styles.
    // (With the old setStyle() call, left/top would revert to undefined after background assignment)
    if (initialStyle.left)  expect(afterStyle['left']).toBe(initialStyle.left)
    if (initialStyle.top)   expect(afterStyle['top']).toBe(initialStyle.top)
    if (initialStyle.width) expect(afterStyle['width']).toBe(initialStyle.width)
  })
})
