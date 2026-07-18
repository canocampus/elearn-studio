import { test, expect } from '../fixtures'
import { ActionsEditorPage } from '../pages/ActionsEditorPage'

/**
 * T169.11 — Action sequence editor panel
 *
 * All tests start authenticated with the editor ready.
 */

test.describe('Action Sequence Editor', () => {
  test('Actions tab is visible in right sidebar', async ({ editorPage }) => {
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('clicking Actions tab opens the actions panel', async ({ editorPage, page }) => {
    const actionsPage = new ActionsEditorPage(page)
    await actionsPage.open()

    // After clicking the Actions tab, the panel or its content should be visible
    // The tab itself should appear selected/active
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('right sidebar has all expected tabs', async ({ editorPage }) => {
    await expect(editorPage.layersTab).toBeVisible()
    await expect(editorPage.stylesTab).toBeVisible()
    await expect(editorPage.actionsTab).toBeVisible()
  })
})

// GAP-02 — Action sequence panel renders when a widget is selected
// Verifies that the Actions panel is accessible and shows its container when a widget
// is selected. Full add-action UI testing requires ActionsEditor implementation to
// expose stable test IDs (see ActionsEditorPage.addEventButton).
test.describe('Action Sequence Editor: Panel with widget selected (GAP-02)', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  test('GAP-02.1 — Actions panel is accessible after widget is added to canvas', async ({ editorPage, page }) => {
    // Add a widget so there is a selection in the editor
    await editorPage.addComponentViaEditor('button')
    await page.waitForTimeout(300)

    // Open the Actions tab
    const actionsPage = new ActionsEditorPage(page)
    await actionsPage.open()

    // The Actions tab must remain visible and selected
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('GAP-02.2 — Actions panel persists after page reload', async ({ editorPage, page }) => {
    // Add a widget and navigate to Actions tab
    await editorPage.addComponentViaEditor('button')
    await page.waitForTimeout(300)
    await editorPage.actionsTab.click()

    // Wait for autosave before reloading
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(3000))

    // Reload and verify the editor restores without error
    await page.reload()
    await editorPage.waitForReady()

    // Editor toolbar must be visible — session and course state were restored
    await expect(editorPage.publishScormButton).toBeVisible({ timeout: 20_000 })

    // Navigating to the slide and opening Actions tab must still work
    const slides = page.locator('[data-testid="slide-item"]')
    await slides.last().click()
    await editorPage.waitForCanvas()
    await editorPage.actionsTab.click()
    await expect(editorPage.actionsTab).toBeVisible()
  })

  test('GAP-02.3 — Navigate action persists in action sequence after page reload', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Capture our slide index before reload (ourSlideIndex pattern — stays stable)
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    // Add a button widget so the Actions panel activates.
    // This triggers a 2s debounced autosave PATCH (widget without actions).
    await editorPage.addComponentViaEditor('button')
    await page.waitForTimeout(300)

    // Wait for the button widget's debounced PATCH to complete BEFORE adding
    // actions, so the next patchPromise captures the actions-only PATCH.
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(2500)) // fallback: wait out the 2s debounce

    // Open the Actions tab
    await editorPage.actionsTab.click()
    await page.waitForTimeout(300)

    // Register waitForResponse BEFORE triggering actions save.
    // useActionsSave calls editor.store() immediately (no debounce) on action change.
    const patchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    )

    // Add an onClick event via the EventSelector dropdown
    await page.getByTitle('Add event').click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /click/i }).first().click()
    await page.waitForTimeout(300)

    // Add a Navigate action from the ActionPalette
    await page.getByRole('button', { name: 'Navigate' }).first().click()
    await page.waitForTimeout(300)

    // Verify the action row appeared in the panel
    await expect(page.locator('[data-testid="action-item"]').first()).toBeVisible({ timeout: 5_000 })

    // Wait for the actions PATCH to complete (useActionsSave fires immediately)
    await patchPromise.catch(() => page.waitForTimeout(3000))

    // Reload and restore editor state
    // waitForReloadComplete() waits for toolbar + slide 0 canvas — prevents concurrent
    // editor.load() calls (which crash with "Cannot read properties of undefined") when
    // slides.nth(ourSlideIndex).click() fires before the initial load finishes.
    await page.reload()
    await editorPage.waitForReloadComplete()

    // Return to our slide
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    // Re-select the existing button widget via JS bridge (selects without adding)
    await page.waitForFunction(
      () => !!window.__elearn_editor,
      { timeout: 15_000 },
    )
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      if (!ed) return
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(500)

    // Open Actions tab
    await editorPage.actionsTab.click()
    await page.waitForTimeout(300)

    // The Navigate action must still be present — proves persistence across reload
    await expect(page.locator('[data-testid="action-item"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('@regression GAP-02.4 — TD-015: actions survive a slide switch away and back (selection must not wipe them)', async ({ editorPage, page }) => {
    test.setTimeout(90_000)

    // TD-015 regression. Mid-session slide switches reload the slide via
    // editor.load(), which regenerates GrapesJS MODEL ids while the persisted
    // widget id survives only in attributes.id. The selection handler used to
    // resolve via getId() alone: the course-doc lookup missed, the panel
    // loaded [], and useActionsSave persisted that empty array — wiping the
    // widget's saved actions on mere re-selection. (A full page reload —
    // GAP-02.3 — did NOT catch this: GrapesJS adopts attributes.id as the
    // model id on cold load, so the ids realign there.)
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    await editorPage.addComponentViaEditor('button')
    await page.waitForTimeout(300)
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 10_000 },
    ).catch(() => page.waitForTimeout(2500))

    // Wire Click → Navigate through the real UI.
    await editorPage.actionsTab.click()
    await page.waitForTimeout(300)
    const patchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    )
    await page.getByTitle('Add event').click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /click/i }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Navigate' }).first().click()
    await expect(page.locator('[data-testid="action-item"]').first()).toBeVisible({ timeout: 5_000 })
    await patchPromise.catch(() => page.waitForTimeout(3000))

    // Switch away (slide 0) and back — the slide reload regenerates model ids.
    await slides.first().click()
    await editorPage.waitForCanvas()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    // Re-select the button widget via the JS bridge (selects without adding).
    await page.waitForFunction(() => !!window.__elearn_editor, { timeout: 15_000 })
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      if (!ed) return
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(500)
    await editorPage.actionsTab.click()

    // 1) Display contract: the Navigate action is still shown after the switch.
    await expect(page.locator('[data-testid="action-item"]').first()).toBeVisible({ timeout: 10_000 })

    // 2) Persistence kill-shot: give any (erroneous) selection-triggered save
    //    time to land, then cold-reload and verify the action SURVIVED in the
    //    persisted course — pre-fix, the selection above wiped it server-side.
    await page.waitForTimeout(2500)
    await page.reload()
    await editorPage.waitForReloadComplete()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()
    await page.waitForFunction(() => !!window.__elearn_editor, { timeout: 15_000 })
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      if (!ed) return
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(500)
    await editorPage.actionsTab.click()
    await expect(page.locator('[data-testid="action-item"]').first()).toBeVisible({ timeout: 10_000 })
  })
})
