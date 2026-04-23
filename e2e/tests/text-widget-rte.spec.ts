import { test, expect } from '../fixtures'

/**
 * T637 — Text Widget Rich Text Editor
 *
 * Regression tests for the three bugs fixed in T637:
 *  T637.5a — Typing in text-edit mode does NOT lose the cursor (T637.1 fix)
 *  T637.5b — Ctrl+V while text-editing does NOT paste a new widget (T637.1 fix)
 *  T637.5c — RTE toolbar appears with all expected actions after double-click (T637.3 + T637.4 fix)
 *  T637.5d — Autosave does NOT close text-edit mode (T637.2 fix)
 *
 * NOTE: GrapesJS v0.21.13 does NOT expose a 'text-edit' command.
 * Commands.isActive('text-edit') always returns false — see initEditor.ts line ~368.
 * RTE active state is detected via .gjs-rte-toolbar visibility in the main document.
 */

// All tests share a longer timeout — autosave debounce is 2 s.
test.setTimeout(60_000)

/** Count top-level components in the current slide canvas. */
async function getComponentCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const ed = window.__elearn_editor
    return ed?.getComponents().length ?? 0
  })
}

test.describe('T637 — text widget RTE', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    // Each test gets a FRESH slide so text widgets never accumulate on slide 0.
    const slidesBefore = await page.locator('[data-testid="slide-item"]').count()
    await editorPage.addSlide()
    // Navigate to the newly created slide (at index slidesBefore).
    await editorPage.slideItemByIndex(slidesBefore).click()
    await editorPage.waitForCanvas()
    // Drop exactly one Text widget on this fresh slide.
    await editorPage.dragBlockToCanvas('Text', 200, 200)
    await page.waitForTimeout(300)
  })

  // ── T637.5a ─────────────────────────────────────────────────────────────────
  test(
    '@regression T637.5a typing in text-edit keeps contenteditable visible (no cursor loss)',
    async ({ editorPage, page }) => {
      const iframe = page.frameLocator('iframe.gjs-frame')
      const editable = iframe.locator('[contenteditable="true"]').first()
      const toolbar = page.locator('.gjs-rte-toolbar')

      // Enter text-edit mode.
      const textComponent = editorPage.canvasComponent('[data-gjs-type="text"]')
      await textComponent.dblclick()
      await page.waitForTimeout(400)

      // Toolbar visible = RTE is active.
      await expect(toolbar).toBeVisible()

      // The contenteditable element must be present and accessible.
      await expect(editable).toBeVisible()

      // Click inside the editable to position the cursor, then type.
      await editable.click()
      await page.keyboard.type('Hello RTE')
      await page.waitForTimeout(200)

      // After typing, RTE must still be active — toolbar must still be visible.
      await expect(toolbar).toBeVisible()

      // Contenteditable must still be accessible (cursor was not lost).
      await expect(editable).toBeVisible()
    },
  )

  // ── T637.5b ─────────────────────────────────────────────────────────────────
  test(
    '@regression T637.5b Ctrl+V during text-edit does NOT add a new widget to the canvas',
    async ({ editorPage, page }) => {
      const iframe = page.frameLocator('iframe.gjs-frame')
      const editable = iframe.locator('[contenteditable="true"]').first()
      const toolbar = page.locator('.gjs-rte-toolbar')

      // Enter text-edit mode.
      const textComponent = editorPage.canvasComponent('[data-gjs-type="text"]')
      await textComponent.dblclick()
      await page.waitForTimeout(400)
      await expect(toolbar).toBeVisible()
      await editable.click()

      // Capture component count BEFORE Ctrl+V.
      const countBefore = await getComponentCount(page)

      // Ctrl+V — elearn:paste must be suppressed while RTE is active.
      await page.keyboard.press('Control+v')
      await page.waitForTimeout(300)

      // Component count must be unchanged — no widget was pasted.
      const countAfter = await getComponentCount(page)
      expect(countAfter).toBe(countBefore)

      // RTE must still be active after Ctrl+V.
      await expect(toolbar).toBeVisible()
    },
  )

  // ── T637.5c ─────────────────────────────────────────────────────────────────
  test(
    '@regression T637.5c RTE toolbar is visible with Bold/Italic/Underline/Strikethrough/Link actions',
    async ({ editorPage, page }) => {
      const toolbar = page.locator('.gjs-rte-toolbar')

      // Enter text-edit mode.
      const textComponent = editorPage.canvasComponent('[data-gjs-type="text"]')
      await textComponent.dblclick()
      await page.waitForTimeout(400)

      // The RTE toolbar lives in the main document (not the iframe).
      await expect(toolbar).toBeVisible()

      // Select all text so formatting actions are fully active.
      await page.keyboard.press('Control+a')
      await page.waitForTimeout(200)

      // Verify expected action buttons are present (T637.4: bold, italic, underline,
      // strikethrough, link).
      await expect(toolbar.locator('[title="Bold"]')).toBeVisible()
      await expect(toolbar.locator('[title="Italic"]')).toBeVisible()
      await expect(toolbar.locator('[title="Underline"]')).toBeVisible()
      await expect(toolbar.locator('[title="Strike-through"]')).toBeVisible()
      await expect(toolbar.locator('[title="Link"]')).toBeVisible()
    },
  )

  // ── T637.5d ─────────────────────────────────────────────────────────────────
  test(
    '@regression T637.5d autosave debounce does NOT close text-edit mode (no cursor loss after 2s)',
    async ({ editorPage, page }) => {
      const iframe = page.frameLocator('iframe.gjs-frame')
      const editable = iframe.locator('[contenteditable="true"]').first()
      const toolbar = page.locator('.gjs-rte-toolbar')

      // Enter text-edit mode and type so a component:update fires, starting the debounce.
      const textComponent = editorPage.canvasComponent('[data-gjs-type="text"]')
      await textComponent.dblclick()
      await page.waitForTimeout(400)
      await expect(toolbar).toBeVisible()

      await editable.click()
      await page.keyboard.type('typing')
      await page.waitForTimeout(200)

      // Verify RTE is active before the debounce expires.
      await expect(toolbar).toBeVisible()

      // Wait longer than the 2 s autosave debounce.
      await page.waitForTimeout(2_500)

      // RTE MUST still be active — autosave must not have called rte:disable.
      await expect(toolbar).toBeVisible()

      // The contenteditable must still be accessible.
      await expect(editable).toBeVisible()
    },
  )
})
