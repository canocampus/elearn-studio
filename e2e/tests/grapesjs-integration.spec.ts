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

// T630 Phase 2 — Multi-slide drop positioning regression guard
//
// Critical scenario that Phase 1 missed: on Slide 2+ users drag directly over
// the canvas without passing through main-window areas. The old mousemove-on-document
// fix never received events in this case (HTML5 DnD suppresses mousemove; dragover
// fires inside the iframe instead). Result: component landed at (0,0).
//
// These tests verify:
//   (a–c) Widgets dropped on Slide 1 land near the target (regression guard)
//   (d)   Widgets dropped on Slide 2 land near the target, NOT at (0,0)
//   (e)   Slide 1 components persist after switching to Slide 2 and back
test.describe('T630 — Multi-slide drop positions & persistence', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('T630.S2 — widget dropped on Slide 2 lands near target, NOT at (0,0)', async ({ editorPage, page }) => {
    const slides = page.locator('[data-testid="slide-item"]')
    const slide1Index = (await slides.count()) - 1

    // Drop a Button on Slide 1
    const s1TargetX = 350
    const s1TargetY = 250
    await editorPage.dragBlockToCanvas('Button', s1TargetX, s1TargetY)
    const s1btn = editorPage.canvasComponent('[data-gjs-type="button"]')
    await expect(s1btn).toBeVisible({ timeout: 15_000 })

    // Add Slide 2 and navigate to it
    await editorPage.addSlide()
    await slides.last().click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // Drop a Button on Slide 2
    const s2TargetX = 400
    const s2TargetY = 300
    await editorPage.dragBlockToCanvas('Button', s2TargetX, s2TargetY)
    const s2btn = editorPage.canvasComponent('[data-gjs-type="button"]')
    await expect(s2btn).toBeVisible({ timeout: 15_000 })

    const iframeBox = await editorPage.getCanvasIframeBox()
    const s2Box = await s2btn.boundingBox()
    expect(s2Box).not.toBeNull()
    expect(iframeBox).not.toBeNull()
    if (s2Box && iframeBox) {
      const relX = s2Box.x - iframeBox.x
      const relY = s2Box.y - iframeBox.y
      // Critical: must NOT be at (0,0) — the T630 regression
      expect(relX).toBeGreaterThan(50)
      expect(relY).toBeGreaterThan(50)
    }

    // Drop a Text in the bottom third of Slide 2
    await editorPage.dragBlockToCanvas('Text', 300, 550)
    const s2txt = editorPage.canvasComponent('[data-gjs-type="text"]')
    await expect(s2txt).toBeVisible({ timeout: 15_000 })
    const txtBox = await s2txt.boundingBox()
    if (txtBox && iframeBox) {
      // Must be in the lower half of the canvas (> 200px from top)
      expect(txtBox.y - iframeBox.y).toBeGreaterThan(200)
    }

    // Navigate back to Slide 1 — persistence check (item e)
    // dragBlockToCanvas() leaves the Blocks tab active; switch back to Slides tab first.
    await editorPage.slidesTab.click()
    await slides.nth(slide1Index).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    // Slide 1's button must still be there near the original target
    const s1btnBack = editorPage.canvasComponent('[data-gjs-type="button"]')
    await expect(s1btnBack).toBeVisible({ timeout: 15_000 })
    const s1BackBox = await s1btnBack.boundingBox()
    if (s1BackBox && iframeBox) {
      const relX = s1BackBox.x - iframeBox.x
      const relY = s1BackBox.y - iframeBox.y
      expect(Math.abs(relX - s1TargetX)).toBeLessThan(100)
      expect(Math.abs(relY - s1TargetY)).toBeLessThan(100)
    }
  })
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

// ---------------------------------------------------------------------------
// TD-016 — composite-widget children keep their type's layout in the editor
// ---------------------------------------------------------------------------

test.describe('TD-016 — nav-buttons editor render', () => {
  test('@regression TD-016 — both nav labels visible, children not absolutized, no stacking', async ({ editorPage, page }) => {
    // Root cause guarded here: the global component:add handler used to set
    // position:absolute + draggable:true on the widget's two child <button>
    // components (both on creation and on every slide load). With no left/top
    // both children anchored at the container origin — "Next →" painted over
    // "← Previous", which read as a missing label in the editor and in every
    // §05/§17 manual capture. The handler now skips non-top-level components.
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await editorPage.addComponentViaEditor('nav-buttons')
    await page.waitForTimeout(400)

    const nav = editorPage.canvasFrame().locator('[data-gjs-type="nav-buttons"]').first()
    await expect(nav).toBeVisible({ timeout: 15_000 })
    const prev = nav.locator('button').nth(0)
    const next = nav.locator('button').nth(1)
    await expect(prev).toHaveText('← Previous')
    await expect(next).toHaveText('Next →')

    // The children must keep the flex-flow layout their type declares.
    const childPositions = await nav.evaluate((el) =>
      Array.from(el.children).map((c) => window.getComputedStyle(c).position),
    )
    expect(childPositions).toEqual(['static', 'static'])

    // And must not overlap: Previous ends before Next begins (1px tolerance).
    const prevBox = await prev.boundingBox()
    const nextBox = await next.boundingBox()
    expect(prevBox).not.toBeNull()
    expect(nextBox).not.toBeNull()
    expect(prevBox!.x + prevBox!.width).toBeLessThanOrEqual(nextBox!.x + 1)

    // Survives the slide-switch round-trip (the handler also fires on load).
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1
    await page.waitForResponse(
      (resp) => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(2500))
    await slides.first().click()
    await editorPage.waitForCanvas()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForTimeout(500)

    const navReloaded = editorPage.canvasFrame().locator('[data-gjs-type="nav-buttons"]').first()
    await expect(navReloaded.locator('button').nth(0)).toHaveText('← Previous')
    await expect(navReloaded.locator('button').nth(1)).toHaveText('Next →')
    const reloadedPositions = await navReloaded.evaluate((el) =>
      Array.from(el.children).map((c) => window.getComputedStyle(c).position),
    )
    expect(reloadedPositions).toEqual(['static', 'static'])
  })
})
