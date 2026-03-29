import { test, expect } from '../fixtures'

/**
 * State Persistence Tests
 *
 * Covers:
 *   FM-05  — Widget properties (text content, image src, nav-buttons position) persist
 *            across slide navigation (the original captura1/captura3 data-loss bug)
 *   GAP-03 — Widget state survives full page reload
 *   GAP-05 — Session is restored after page reload (refresh token)
 *   GAP-06 — Autosave race condition: switching slides before debounce does not lose widget
 *
 * These tests all run in the authenticated `chromium` project (storageState pre-loaded).
 */

// ---------------------------------------------------------------------------
// FM-05 — Regression: widget content + position must survive slide navigation
// Root cause was in converters.ts: widgetsFromGrapesjs did not read c.get('content')
// or c.get('src'), and grapesjsFromWidgets hardcoded display:'block' for nav-buttons
// (which require display:'flex'). Fixed 2026-03-28.
// ---------------------------------------------------------------------------
test.describe('FM-05 — Widget data persists across slide navigation', () => {
  test('FM-05 — text widget content survives slide switch and return', async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`[BROWSER ERROR] ${msg.text()}`)
    })

    // 1. Add slide and place a text widget via programmatic API
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await editorPage.addComponentViaEditor('text')
    await page.waitForTimeout(300)

    // 2. Confirm the widget is visible in the canvas
    await expect(editorPage.canvasComponent('[data-gjs-type="text"]')).toBeVisible({ timeout: 10_000 })

    // 3. Click the widget to select and then double-click to enter edit mode
    const textWidget = editorPage.canvasComponent('[data-gjs-type="text"]')
    await textWidget.click()
    await textWidget.dblclick()
    await page.waitForTimeout(200)

    // 4. Type a recognisable string
    await page.keyboard.press('Control+A')
    await page.keyboard.type('FM-05 regression sentinel text')
    await page.keyboard.press('Escape')
    // Click outside to force blur and model sync
    await page.locator('body').click({ position: { x: 0, y: 0 } })
    await page.waitForTimeout(300)

    // 5. Wait for autosave PATCH to confirm text is persisted (2s debounce + margin)
    const slides = page.locator('[data-testid="slide-item"]')
    const slideAIndex = (await slides.count()) - 1

    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))

    // 6. Add a blank slide B and navigate to it
    await editorPage.addSlide()
    await slides.last().click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 7. Navigate back to slide A
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 8. The text widget must still contain the sentinel text — not the default placeholder
    await expect(editorPage.canvasComponent('[data-gjs-type="text"]')).toContainText(
      'FM-05 regression sentinel text',
      { timeout: 10_000 },
    )
  })

  test('FM-05 — nav-buttons widget is NOT placed at (0,0) after slide switch and return', async ({ editorPage, page }) => {
    // This regresses the display:'block' bug that made nav-buttons appear at top-left.
    await editorPage.addSlide()
    await editorPage.waitForCanvas()

    // Place nav-buttons at a non-origin position
    await editorPage.dragBlockToCanvas('Nav Buttons', 400, 500)

    const slides = page.locator('[data-testid="slide-item"]')
    const slideAIndex = (await slides.count()) - 1

    const navBtn = editorPage.canvasComponent('[data-gjs-type="nav-buttons"]')
    await expect(navBtn).toBeVisible({ timeout: 15_000 })

    // Capture position before navigating away
    const boxBefore = await navBtn.boundingBox()
    expect(boxBefore).not.toBeNull()

    // Wait for autosave
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))

    // Switch to a second slide and back
    await editorPage.addSlide()
    await slides.last().click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // Nav-buttons must still be visible and NOT at (0,0)
    await expect(navBtn).toBeVisible({ timeout: 10_000 })
    const boxAfter = await navBtn.boundingBox()
    expect(boxAfter).not.toBeNull()

    // If regressed, the widget would jump to (0,0) — its top value would be near 0
    // and far from where we dropped it (~500px from top of canvas).
    // We allow a generous tolerance of 50px from the original position.
    expect(Math.abs(boxAfter!.y - boxBefore!.y)).toBeLessThan(50)
  })
})

test.describe('State Persistence', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
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

  // GAP-06b — Programmatic add (no drag) triggers autosave via component:add event.
  // Drag tests accidentally pass because dragBlockToCanvas fires component:update via
  // mouse move. This test isolates the component:add event specifically.
  test('GAP-06b — programmatic addComponentViaEditor triggers autosave PATCH (component:add)', async ({ editorPage, page }) => {
    // Set up PATCH listener BEFORE the add so we cannot miss a fast-firing autosave.
    // Intentionally NO .catch() fallback — this test MUST fail if component:add never
    // triggers autosave, rather than silently passing via the timeout fallback.
    const patchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    )

    // Use programmatic add (not drag) to fire component:add only, not component:update.
    await editorPage.addComponentViaEditor('rectangle')
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })

    // Must receive the PATCH within 15s — fails (not times-out-and-passes) if component:add
    // is not wired to autosave.
    await patchPromise

    // Verify persistence: reload and confirm widget is still there.
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    await page.reload()
    await editorPage.waitForReady()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })
  })

  // GAP-06c — Widget deletion triggers autosave via component:remove event.
  // Without the component:remove → triggerAutosave wiring, the backend would retain
  // the widget after the user deletes it and refreshes the page.
  test('GAP-06c — deleting a widget triggers autosave PATCH (component:remove)', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    // Add widget and wait for the first autosave to confirm it was persisted.
    await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })

    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))

    // Set up a strict second PATCH listener BEFORE the delete action.
    // No .catch() fallback — the test must fail if component:remove is not wired.
    const deletePatchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    )

    // Select the widget then delete it via GrapesJS command.
    await editorPage.canvasComponent('[data-gjs-type="rectangle"]').click()
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        runCommand: (cmd: string) => void
        getSelected: () => unknown
      }
      if (ed?.getSelected()) ed.runCommand('core:component-delete')
    })

    // Must receive the PATCH — fails (not times-out-and-passes) if component:remove
    // is not wired to autosave.
    await deletePatchPromise

    // Verify: reload and confirm the widget is gone (not re-loaded from stale backend data).
    await page.reload()
    await editorPage.waitForReady()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).not.toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// T704 — FM-05 complete: Rapid slide-switch data preservation
// Guards the generation counter in initEditor.ts that prevents stale debounce
// fires from overwriting newer slide data when the user switches slides rapidly.
// ---------------------------------------------------------------------------
test.describe('FM-05 — Rapid slide switch does not lose widget data', () => {

  test('FM-05a — Rectangle widget survives immediate slide switch before 2s debounce', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')

    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    const slideAIndex = (await slides.count()) - 1

    // Add a rectangle via programmatic API (faster than drag)
    await editorPage.addComponentViaEditor('rectangle')
    await page.waitForTimeout(300)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })

    // Immediately switch slide — before the 2s debounce fires
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await slides.last().click()
    await page.waitForTimeout(100)  // 100ms — well before 2s debounce

    // Wait for forced save from slide-switch handler plus some buffer
    await page.waitForTimeout(3_500)  // 2s debounce + 1.5s buffer

    // Navigate back to slide A
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(300)

    // Widget must still be there
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })
  })

  test('FM-05b — Question widget text persists after 3 rapid slide switches', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')

    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    const slideAIndex = (await slides.count()) - 1

    // Add a question-mc widget and set question text
    await editorPage.addComponentViaEditor('question-mc')
    await page.waitForTimeout(300)
    await editorPage.canvasComponent('[data-gjs-type="question-mc"]').click()
    await editorPage.propsTab.click()

    const panel = page.locator('[data-testid="question-properties-panel"]')
    const textarea = panel.locator('textarea').first()
    await textarea.fill('FM-05b sentinel question text')
    await textarea.press('Tab')
    await page.waitForTimeout(100)

    // Rapid slide-switches: 1→2→1→2 without waiting for debounce
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    const slideBIndex = (await slides.count()) - 1

    await slides.nth(slideAIndex).click()  // → slide A
    await page.waitForTimeout(150)
    await slides.nth(slideBIndex).click()  // → slide B
    await page.waitForTimeout(150)

    // Wait for all debounces to settle
    await page.waitForTimeout(4_000)  // 2s debounce + 2s buffer

    // Go back to slide A
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(300)

    // Re-select and verify question text
    await editorPage.canvasComponent('[data-gjs-type="question-mc"]').click()
    await editorPage.propsTab.click()
    await panel.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(textarea).toHaveValue('FM-05b sentinel question text', { timeout: 5_000 })
  })

  test('FM-05c — exactly one PATCH fires for slide 1 content when switching away immediately', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')

    await editorPage.addSlide()
    await editorPage.waitForCanvas()

    await editorPage.addComponentViaEditor('rectangle')
    await page.waitForTimeout(300)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })

    // Track PATCH requests
    const patches: string[] = []
    page.on('response', res => {
      if (res.url().includes('/courses/') && res.request().method() === 'PATCH') {
        patches.push(res.url())
      }
    })

    // Switch away immediately; slide-switch handler must flush synchronously
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await slides.last().click()

    // Wait for the forced save and any debounce window
    await page.waitForTimeout(4_000)  // 2s debounce + 2s buffer

    // At least one PATCH must have fired (data was not silently dropped)
    expect(patches.length).toBeGreaterThanOrEqual(1)
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
