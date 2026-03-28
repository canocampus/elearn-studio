import { test, expect } from '../fixtures'

/**
 * State Persistence Tests
 *
 * Covers:
 *   GAP-03 — Widget state survives full page reload
 *   GAP-05 — Session is restored after page reload (refresh token)
 *   GAP-06 — Autosave race condition: switching slides before debounce does not lose widget
 *
 * These tests all run in the authenticated `chromium` project (storageState pre-loaded).
 */

test.describe('State Persistence', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.goto()
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // GAP-03 — Widget state survives full page reload
  test('GAP-03 — widgets on a slide survive page reload', async ({ editorPage, page }) => {
    // Capture our slide's index at the very START of the test body.
    // beforeEach just added this slide as the last one; slides are append-only so any
    // slides other workers add later will be at HIGHER indices. This index stays stable
    // across reload.
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })

    // Wait for autosave PATCH to confirm the widget was persisted to the backend.
    // 2s debounce + up to 8s for the request to complete.
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))  // fallback if PATCH already fired

    await page.reload()
    await editorPage.waitForReady()

    // Navigate back to our slide using the stable index captured before drag.
    // Slides are append-only; other workers' slides land at higher indices,
    // so ourSlideIndex remains valid after reload.
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })
  })

  // GAP-06 — Autosave race condition
  test('GAP-06 — switching slides before autosave debounce does not lose widget', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')
    // Capture the index of slide-A (the slide from beforeEach) before adding slide-B.
    // Course accumulates slides across test runs, so we cannot assume slide-A is index 0.
    const slideAIndex = (await slides.count()) - 1

    await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })

    // Immediately add a second slide and switch to it — well before the 2s debounce fires.
    // The slide-switch handler must call editor.store() synchronously before switching.
    await editorPage.addSlide()
    await slides.last().click()  // switch away immediately
    await page.waitForTimeout(100)  // 100ms — much less than the 2s debounce

    // Wait for the forced save triggered by the slide-switch handler (or the debounce to fire)
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))  // fallback if PATCH already fired

    // Navigate back to slide-A (not slides.first() — slides can accumulate across test runs)
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()

    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })
  })
})

// GAP-05 — Session restoration after page reload
// Runs in the chromium project (pre-authenticated via storageState).
// The access token is in memory only; the httpOnly refresh token cookie restores the session.
test.describe('Session Persistence', () => {
  test('GAP-05 — session is restored after page reload (F5)', async ({ editorPage, page }) => {
    await page.goto('/')
    await editorPage.waitForReady()

    // Reload — access token in memory is lost; refresh token in httpOnly cookie restores it
    await page.reload()

    // Must NOT redirect to login
    await expect(editorPage.publishScormButton).toBeVisible({ timeout: 20_000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
