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

    // 2. Always add a fresh slide so each test starts with an empty canvas.
    // This gives test isolation — no leftover widgets from previous tests.
    // (The editorPage fixture already navigated to / and waited for the toolbar.)
    await editorPage.addSlide()

    // 3. Wait for the GrapesJS canvas iframe — guaranteed after addSlide()
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
    await expect(btn).toBeVisible({ timeout: 15_000 })
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

// GAP-01 (FM-05) — Widget properties persist across slide navigation
// This is the most critical gap: if editor.store() is not called synchronously
// before the slide-switch handler runs, properties edited via the Props panel are lost.
test.describe('GrapesJS Integration: Property Persistence (FM-05)', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('FM-05 — widget properties persist across slide navigation', async ({ editorPage, page }) => {
    // 1. Add a question-mc widget to the slide
    await editorPage.addComponentViaEditor('question-mc')
    await page.waitForTimeout(300)

    // 2. Open the Props panel and edit the question text
    await editorPage.propsTab.click()
    const panel = page.locator('[data-testid="question-properties-panel"]')
    await panel.waitFor({ state: 'visible', timeout: 10_000 })
    const textarea = panel.locator('textarea').first()
    await textarea.fill('FM-05 regression test question')
    await textarea.press('Tab')  // trigger onChange

    // 3. Wait for autosave (2s debounce + 1s buffer)
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))

    // 4. Navigate to a second slide
    // Capture slide-A's index before adding slide-B — slides accumulate across tests.
    const slides = page.locator('[data-testid="slide-item"]')
    const slideAIndex = (await slides.count()) - 1
    await editorPage.addSlide()
    await slides.last().click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 5. Navigate back to slide A (where the widget lives)
    await slides.nth(slideAIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // 6. Re-select the widget and verify the property is preserved
    const mc = editorPage.canvasComponent('[data-gjs-type="question-mc"]')
    await expect(mc).toBeVisible({ timeout: 10_000 })
    await mc.click()
    await page.waitForTimeout(300)

    await editorPage.propsTab.click()
    const restoredPanel = page.locator('[data-testid="question-properties-panel"]')
    await restoredPanel.waitFor({ state: 'visible', timeout: 10_000 })
    const restoredTextarea = restoredPanel.locator('textarea').first()
    await expect(restoredTextarea).toHaveValue('FM-05 regression test question', { timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// T703 — AnimationPropertiesPanel FM-06 regression guard
// Guards against reintroduction of the bug where AnimationPropertiesPanel.save()
// did not call editor.store(), causing animations edited within the 2s debounce
// window to be silently lost on slide switch.
// ---------------------------------------------------------------------------
test.describe('AnimationPropertiesPanel — FM-06 regression', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    // Place a widget so animations panel is activatable
    await editorPage.addComponentViaEditor('text')
    await page.waitForTimeout(300)
    // Select the widget by clicking it
    await editorPage.canvasComponent('[data-gjs-type="text"]').click()
    await page.waitForTimeout(200)
  })

  test('T703.1 — adding an animation via "+" button shows it in the list', async ({ editorPage, page }) => {
    await editorPage.animTab.click()

    // The panel should show the "no animations" placeholder initially
    const panel = page.locator('text=No animations. Click + to add one.')
    // Click + to add
    await page.getByTitle('Add animation').click()
    await page.waitForTimeout(200)

    // New animation should appear in the list
    await expect(page.locator('text=New Animation')).toBeVisible({ timeout: 5_000 })
    // The placeholder must be gone
    await expect(panel).not.toBeVisible()
  })

  test('T703.2 — renamed animation persists after rapid slide switch (FM-06 regression guard)', async ({ editorPage, page }) => {
    // This test MUST FAIL if editor.store() is removed from AnimationPropertiesPanel.save()
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = await slides.count() - 1

    await editorPage.animTab.click()

    // Add an animation
    await page.getByTitle('Add animation').click()
    await page.waitForTimeout(200)

    // Rename it
    // NOTE: input[value="..."] is a CSS attribute selector. After fill() fires React's
    // onChange which re-renders the controlled input, the DOM attribute updates to the
    // new value — making the original locator stale. Use page.keyboard.press() which
    // doesn't need to re-locate the element, to press Tab after filling.
    const nameInput = page.locator('input[value="New Animation"]')
    await nameInput.click({ clickCount: 3 })
    await nameInput.fill('FM-06 sentinel name')
    await page.keyboard.press('Tab')
    // Immediately switch slides — well within the 2s debounce window
    // The animation is persisted via onChange → updateAnimation → setEp → comp.set()
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await slides.last().click()
    await page.waitForTimeout(500)

    // Navigate back to our slide
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(300)

    // Re-select the widget and switch to Anim tab
    await editorPage.canvasComponent('[data-gjs-type="text"]').click()
    await editorPage.animTab.click()
    await page.waitForTimeout(200)

    // The renamed animation must be present
    await expect(page.locator('text=FM-06 sentinel name')).toBeVisible({ timeout: 8_000 })
  })

  test('T703.3 — changing animation duration fires a PATCH request', async ({ editorPage, page }) => {
    await editorPage.animTab.click()

    // Add animation
    await page.getByTitle('Add animation').click()
    await page.waitForTimeout(200)

    // Set up PATCH listener BEFORE the change that triggers it
    const patchPromise = page.waitForResponse(
      res => res.url().includes('/courses/') && res.request().method() === 'PATCH',
      { timeout: 8_000 },
    )

    // Change duration
    const durationInput = page.locator('input[type="number"]').first()
    await durationInput.click({ clickCount: 3 })
    await durationInput.fill('2500')
    await durationInput.press('Tab')

    // The PATCH must fire (duration change calls save() → editor.store() → backend)
    await patchPromise
  })

  test('T703.4 — deleted animation is absent after slide switch and return', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = await slides.count() - 1

    await editorPage.animTab.click()

    // Add animation
    await page.getByTitle('Add animation').click()
    await page.waitForTimeout(200)
    await expect(page.locator('text=New Animation')).toBeVisible({ timeout: 5_000 })

    // Delete it
    await page.getByTitle('Delete animation').click()
    await page.waitForTimeout(200)

    // Switch slide and back
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await slides.last().click()
    await page.waitForTimeout(500)

    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(300)

    // Re-select widget and check animations panel
    await editorPage.canvasComponent('[data-gjs-type="text"]').click()
    await editorPage.animTab.click()
    await page.waitForTimeout(200)

    // Animation list must be empty — delete path also calls save() → editor.store()
    await expect(page.locator('text=No animations. Click + to add one.')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=New Animation')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// T600 — BETA-06 regression guard: initial drag positioning
// Guards against reintroduction of the bug where done-button, question-tf,
// question-fill, and media-player were missing position/size in their block
// content definitions, causing them to land at canvas origin (0,0) on drop.
// ---------------------------------------------------------------------------
test.describe('T600 — Initial drag positioning (BETA-06 regression)', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  const WIDGETS: Array<{ label: string; type: string }> = [
    { label: 'Done Button',      type: 'done-button'    },
    { label: 'True / False',     type: 'question-tf'    },
    { label: 'Fill in the Blank',type: 'question-fill'  },
    { label: 'Media Player',     type: 'media-player'   },
  ]

  for (const { label, type } of WIDGETS) {
    test(`${label} does NOT land at canvas origin (0,0) on drop (BETA-06 regression)`, async ({ editorPage, page: _page }) => {
      await editorPage.dragBlockToCanvas(label, 300, 200)

      const widget = editorPage.canvasComponent(`[data-gjs-type="${type}"]`).first()
      await expect(widget).toBeVisible({ timeout: 15_000 })

      const box = await widget.boundingBox()
      const iframeBox = await editorPage.getCanvasIframeBox()
      expect(box).not.toBeNull()
      expect(iframeBox).not.toBeNull()
      if (box && iframeBox) {
        const relX = box.x - iframeBox.x
        const relY = box.y - iframeBox.y
        // Must NOT be at canvas origin — a 50px threshold rules out a stuck-at-0,0 drop
        expect(relX).toBeGreaterThan(50)
        expect(relY).toBeGreaterThan(50)
      }
    })
  }
})

// GAP-08 (FM-02) — Widget can be dragged to a new position within the canvas
// Verifies that widgets are not frozen after being placed; they must remain draggable.
test.describe('GrapesJS Integration: Widget Repositioning (FM-02)', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('FM-02 — widgets can be dragged to a new position within the canvas', async ({ editorPage, page }) => {
    // Drop a rectangle at a known position
    await editorPage.dragBlockToCanvas('Rectangle', 100, 100)
    const rect = editorPage.canvasComponent('[data-gjs-type="rectangle"]').first()
    await expect(rect).toBeVisible({ timeout: 15_000 })

    // Select the widget first
    await rect.click()
    await page.waitForTimeout(300)

    const initialBox = await rect.boundingBox()
    if (!initialBox) throw new Error('Initial bounding box null')

    // initialBox from canvasComponent() (via frameLocator) is already in viewport coordinates
    const startX = initialBox.x + initialBox.width / 2
    const startY = initialBox.y + initialBox.height / 2

    // Drag to a significantly different position
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 200, startY + 150, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)

    const finalBox = await rect.boundingBox()
    if (!finalBox) throw new Error('Final bounding box null')

    // The widget must have moved by more than 50px — ruling out a no-op
    expect(Math.abs(finalBox.x - initialBox.x) + Math.abs(finalBox.y - initialBox.y)).toBeGreaterThan(50)
  })
})

// ---------------------------------------------------------------------------
// T603 — Button caption and Props tab (BETA-04/05/11 regression)
// ---------------------------------------------------------------------------

test.describe('T603 — Button properties panel (BETA-04 regression)', () => {
  test.beforeEach(async ({ editorPage }) => {
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('T603.1 — dragging Button auto-opens Props tab and shows caption field', async ({ editorPage, page }) => {
    // Drop a Button widget
    await editorPage.dragBlockToCanvas('Button', 200, 200)

    // Wait for the button in the canvas
    const btn = editorPage.canvasComponent('[data-gjs-type="button"]').first()
    await expect(btn).toBeVisible({ timeout: 15_000 })

    // Click the canvas button to select it (triggers Props tab auto-switch)
    await btn.click()
    await page.waitForTimeout(400)

    // Props tab must be active (auto-switched by EditorCanvas component:selected handler)
    await expect(editorPage.propsTab).toHaveAttribute('aria-selected', 'true')

    // Button properties panel must be visible
    const panel = page.getByTestId('button-properties-panel')
    await expect(panel).toBeVisible()

    // Caption input must be present
    const captionInput = panel.getByRole('textbox')
    await expect(captionInput).toBeVisible()
  })

  test('T603.2 — changing button caption updates the canvas label (BETA-04 regression)', async ({ editorPage, page }) => {
    // Drop a Button widget
    await editorPage.dragBlockToCanvas('Button', 200, 200)

    const btn = editorPage.canvasComponent('[data-gjs-type="button"]').first()
    await expect(btn).toBeVisible({ timeout: 15_000 })

    // Select the button (auto-shows Props tab)
    await btn.click()
    await page.waitForTimeout(400)

    // Change caption via the properties panel
    const panel = page.getByTestId('button-properties-panel')
    const captionInput = panel.getByRole('textbox')
    await captionInput.fill('Start Quiz')
    await page.waitForTimeout(300)

    // The canvas button must show the new text
    await expect(btn).toHaveText('Start Quiz')
  })
})
