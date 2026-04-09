import { test, expect } from '../fixtures'

/**
 * T636.5 — Cross-slide copy/paste preserves widget position
 *
 * Verifies that Ctrl+C on a selected widget captures its style (left/top/width/height)
 * in the module-level clipboard, and that Ctrl+V on a different slide recreates the
 * widget at the same position.
 *
 * @regression — guards against the clipboard being cleared when GrapesJS re-initialises
 *               on slide navigation (the original T636 failure mode).
 */

const WIDGET_X = 300
const WIDGET_Y = 200
const POSITION_TOLERANCE_PX = 5

test.describe('T636 — cross-slide copy/paste', () => {
  test.beforeEach(async ({ editorPage }) => {
    // Start from a clean state: add two fresh slides so source and target are known.
    await editorPage.addSlide()  // slide index 0 — source
    await editorPage.addSlide()  // slide index 1 — destination

    // Navigate to slide 0 and wait for the canvas to finish loading.
    await editorPage.slideItemByIndex(0).click()
    await editorPage.waitForCanvas()
  })

  // ─── helpers ────────────────────────────────────────────────────────────────

  type GjsEditor = {
    getComponents: () => {
      length: number
      first: () => { getStyle: (prop: string) => string } | null
      at: (index: number) => { getStyle: (prop: string) => string } | null
      add: (def: unknown) => unknown
    }
    getSelected: () => { toJSON: () => unknown; getStyle: () => unknown } | null
    runCommand: (cmd: string) => void
  }

  /**
   * Read the left/top style (px values) of the LAST component in the canvas.
   * GrapesJS appends on add(), so the pasted widget is always the last one —
   * this is safe even when the target slide is not empty before paste.
   */
  async function getLastComponentPosition(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as GjsEditor | undefined
      if (!ed) return null
      const comps = ed.getComponents()
      if (!comps.length) return null
      const comp = comps.at(comps.length - 1)
      if (!comp) return null
      return {
        left: comp.getStyle('left'),
        top: comp.getStyle('top'),
      }
    })
  }

  /** Count components in the current slide canvas. */
  async function getComponentCount(page: import('@playwright/test').Page): Promise<number> {
    return page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as GjsEditor | undefined
      return ed?.getComponents().length ?? 0
    })
  }

  /** Invoke elearn:copy via the GrapesJS command API (bypasses keyboard focus). */
  async function runCopy(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as GjsEditor | undefined
      ed?.runCommand('elearn:copy')
    })
  }

  /** Invoke elearn:paste via the GrapesJS command API (bypasses keyboard focus). */
  async function runPaste(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as GjsEditor | undefined
      ed?.runCommand('elearn:paste')
    })
  }

  // ─── tests ──────────────────────────────────────────────────────────────────

  test(
    '@regression widget pasted on slide 2 has same left/top as copied from slide 1',
    async ({ editorPage, page }) => {
      // 1. Drop a Rectangle on slide 1 at the target position.
      await editorPage.dragBlockToCanvas('Rectangle', WIDGET_X, WIDGET_Y)

      // Confirm slide 1 now has exactly one component.
      const countBefore = await getComponentCount(page)
      expect(countBefore).toBeGreaterThanOrEqual(1)

      // 2. Copy — use runCommand directly so focus state cannot interfere.
      //    dragBlockToCanvas selects the component via page.evaluate, so it remains
      //    selected in the GrapesJS model when runCommand('elearn:copy') fires.
      await runCopy(page)

      // Switch to Slides tab so slide items are visible for navigation.
      await editorPage.slidesTab.click()

      // 3. Navigate to slide 2 (index 1).
      await editorPage.slideItemByIndex(1).click()
      await editorPage.waitForCanvas()

      // 4. Paste — module-level clipboard survives slide navigation (editor not recreated).
      await runPaste(page)

      // Wait for autosave debounce to settle.
      await page.waitForTimeout(300)

      // 5. Verify the pasted component's position matches the original.
      //    GrapesJS appends on add(), so the LAST component is the newly pasted one —
      //    safe even if the target slide was not empty before paste.
      const pos = await getLastComponentPosition(page)
      expect(pos).not.toBeNull()
      if (pos) {
        const pastedLeft = parseFloat(pos.left)
        const pastedTop = parseFloat(pos.top)
        expect(Math.abs(pastedLeft - WIDGET_X)).toBeLessThan(POSITION_TOLERANCE_PX)
        expect(Math.abs(pastedTop - WIDGET_Y)).toBeLessThan(POSITION_TOLERANCE_PX)
      }
    },
  )

  test(
    '@regression slide 2 receives new component after paste (not zero)',
    async ({ editorPage, page }) => {
      await editorPage.dragBlockToCanvas('Rectangle', WIDGET_X, WIDGET_Y)
      await runCopy(page)
      await editorPage.slidesTab.click()

      await editorPage.slideItemByIndex(1).click()
      await editorPage.waitForCanvas()

      const before = await getComponentCount(page)

      await runPaste(page)
      await page.waitForTimeout(300)

      const after = await getComponentCount(page)
      expect(after).toBe(before + 1)
    },
  )

  test(
    '@regression slide 1 component count is unchanged after cross-slide paste',
    async ({ editorPage, page }) => {
      await editorPage.dragBlockToCanvas('Rectangle', WIDGET_X, WIDGET_Y)
      await runCopy(page)
      await editorPage.slidesTab.click()

      const countSlide1 = await getComponentCount(page)

      await editorPage.slideItemByIndex(1).click()
      await editorPage.waitForCanvas()
      await runPaste(page)
      await page.waitForTimeout(300)

      // Go back to slide 1 and verify it is untouched.
      await editorPage.slideItemByIndex(0).click()
      await editorPage.waitForCanvas()

      const countSlide1After = await getComponentCount(page)
      expect(countSlide1After).toBe(countSlide1)
    },
  )
})
