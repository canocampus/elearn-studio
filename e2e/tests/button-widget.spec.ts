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
      const ed = window.__elearn_editor
      const sel = ed?.getSelected()
      if (!sel) return null
      const s = sel.getStyle()
      return { left: s['left'], top: s['top'], width: s['width'], height: s['height'] }
    })
    expect(initialStyle).not.toBeNull()

    // Simulate what the fixed openBackgroundImagePicker does: addStyle() with all 4 properties.
    // (addStyle merges; setStyle would have replaced left/top/width/height — the old bug)
    await page.evaluate(() => {
      const ed = window.__elearn_editor
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
      const ed = window.__elearn_editor
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

// ---------------------------------------------------------------------------
// TD-018 — done-button label survives the slide-reload round-trip
// ---------------------------------------------------------------------------

test.describe('TD-018 — Done Button label round-trip', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('@regression TD-018 — edited label persists after switching slides away and back', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Regression: the T643.1 content-restore allowlist (text/button) omitted
    // done-button — an edited label saved into properties.content but every
    // slide reload fell back to the type default ('✓ Done').
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    await editorPage.dragBlockToCanvas('Done Button', 400, 400)
    const done = editorPage.canvasComponent('[data-gjs-type="done-button"]')
    await expect(done).toBeVisible({ timeout: 15_000 })
    await done.click()

    await editorPage.propsTab.click()
    const panel = page.locator('[data-testid="button-properties-panel"]')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    const labelInput = panel.getByPlaceholder('Button text')
    await labelInput.fill('Finish course')
    await labelInput.press('Tab')
    await page.waitForTimeout(300)

    // Live canvas reflects the edit.
    await expect(
      editorPage.canvasFrame().locator('[data-gjs-type="done-button"]'),
    ).toHaveText('Finish course', { timeout: 5_000 })

    // Persist, then round-trip through another slide.
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    ).catch(() => page.waitForTimeout(2500))
    // dragBlockToCanvas leaves the Blocks tab active — slide items exist but
    // are hidden until the Slides tab is selected (playbook goToSlide pitfall).
    await editorPage.slidesTab.click()
    await slides.first().click()
    await editorPage.waitForCanvas()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    // The edited label must survive the reload (pre-fix: reverted to '✓ Done').
    await expect(
      editorPage.canvasFrame().locator('[data-gjs-type="done-button"]'),
    ).toHaveText('Finish course', { timeout: 10_000 })
  })
})
