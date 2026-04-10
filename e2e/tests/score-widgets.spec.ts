import { test, expect } from '../fixtures'

/**
 * T638 — E2E Tests: Quiz Score and Score Field widgets
 *
 * Verifies that typography changes (font-size, color) made via the GrapesJS
 * Style Manager are reflected in the canvas render for both score widgets.
 * This is a regression guard against T638's root cause: onRender() injected
 * hardcoded inline styles that silently overrode Style Manager changes.
 *
 * T638.5a — score-quiz: font-size change reflects in canvas immediately
 * T638.5b — score-quiz: font-size persists after page reload
 * T638.5c — score-quiz: title trait changes reflect in canvas
 * T638.5d — score-field: font-size change reflects in canvas immediately
 * T638.5e — score-field: scorePrefix trait changes reflect in canvas
 */

test.describe('T638 — Score widgets: style and trait changes', () => {
  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`[BROWSER ERROR] ${msg.text()}`)
    })
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ─── T638.5a — score-quiz font-size change reflects in canvas ─────────────
  //
  // Regression guard: before T638, setStyle({ 'font-size': '40px' }) had no effect
  // because onRender() always injected `style="font-size:28px"` unconditionally.
  // After the fix, onRender() reads from model.getStyle() and re-renders on change:style.

  test('@regression T638.5a — score-quiz: font-size change reflects in canvas', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('score-quiz')
    await page.waitForTimeout(300)

    // Verify default render: the score value div should have 28px
    const widget = editorPage.canvasComponent('[data-gjs-type="score-quiz"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    const scoreDiv = widget.locator('div').nth(1)
    await expect(scoreDiv).toHaveCSS('font-size', '28px', { timeout: 5_000 })

    // Simulate Style Manager changing font-size (fires change:style → onRender)
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string>; setStyle: (s: Record<string, string>) => void } | null
      } | undefined
      const selected = ed?.getSelected()
      if (!selected) throw new Error('No component selected')
      selected.setStyle({ ...selected.getStyle(), 'font-size': '40px' })
    })
    await page.waitForTimeout(300)

    // Canvas must reflect the new size
    await expect(scoreDiv).toHaveCSS('font-size', '40px', { timeout: 5_000 })
  })

  // ─── T638.5b — score-quiz font-size persists after reload ─────────────────

  test('@regression T638.5b — score-quiz: font-size survives page reload', async ({ editorPage, page }) => {
    test.setTimeout(200_000)

    const slideItems = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slideItems.count()) - 1

    await editorPage.addComponentViaEditor('score-quiz')
    await page.waitForTimeout(300)

    // Arm PATCH listener before edits (T601.8 pattern)
    const patchPromise = page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    )

    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string>; setStyle: (s: Record<string, string>) => void } | null
      } | undefined
      const selected = ed?.getSelected()
      if (!selected) throw new Error('No component selected')
      selected.setStyle({ ...selected.getStyle(), 'font-size': '36px' })
    })

    const saveResp = await patchPromise.catch(() => page.waitForTimeout(3000).then(() => null))
    if (saveResp) expect((saveResp as Awaited<ReturnType<typeof page.waitForResponse>>).status()).toBeLessThan(400)
    await page.waitForTimeout(500)

    await page.reload()
    await editorPage.waitForReloadComplete()

    const countAfterReload = await slideItems.count()
    const targetIndex = Math.min(ourSlideIndex, countAfterReload - 1)
    if (targetIndex > 0) {
      await slideItems.nth(targetIndex).click()
      await editorPage.waitForCanvas()
    }

    const widget = editorPage.canvasComponent('[data-gjs-type="score-quiz"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    // Re-select via JS bridge (reliable in parallel mode)
    await page.evaluate(() => {
      const ed = (window as unknown as Record<string, unknown>).__elearn_editor as {
        getComponents: () => { first: () => unknown }
        select: (c: unknown) => void
      }
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(300)

    const scoreDiv = widget.locator('div').nth(1)
    await expect(scoreDiv).toHaveCSS('font-size', '36px', { timeout: 5_000 })
  })

  // ─── T638.5c — score-quiz title trait changes reflect in canvas ───────────

  test('@regression T638.5c — score-quiz: quizTitle trait change reflects in canvas', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('score-quiz')
    await page.waitForTimeout(300)

    const widget = editorPage.canvasComponent('[data-gjs-type="score-quiz"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    // Default title
    const titleDiv = widget.locator('div').first()
    await expect(titleDiv).toContainText('Quiz Score', { timeout: 5_000 })

    // Change quizTitle trait via model attributes (fires change:attributes → onRender)
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { addAttributes: (attrs: Record<string, string>) => void } | null
      } | undefined
      const selected = ed?.getSelected()
      if (!selected) throw new Error('No component selected')
      selected.addAttributes({ quizTitle: 'Puntaje del Quiz' })
    })
    await page.waitForTimeout(300)

    await expect(titleDiv).toContainText('Puntaje del Quiz', { timeout: 5_000 })
  })

  // ─── T638.5d — score-field font-size change reflects in canvas ────────────

  test('@regression T638.5d — score-field: font-size change reflects in canvas', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('score-field')
    await page.waitForTimeout(300)

    const widget = editorPage.canvasComponent('[data-gjs-type="score-field"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    const prefixSpan = widget.locator('span').first()
    await expect(prefixSpan).toHaveCSS('font-size', '13px', { timeout: 5_000 })

    // Simulate Style Manager change
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { getStyle: () => Record<string, string>; setStyle: (s: Record<string, string>) => void } | null
      } | undefined
      const selected = ed?.getSelected()
      if (!selected) throw new Error('No component selected')
      selected.setStyle({ ...selected.getStyle(), 'font-size': '18px' })
    })
    await page.waitForTimeout(300)

    await expect(prefixSpan).toHaveCSS('font-size', '18px', { timeout: 5_000 })
  })

  // ─── T638.5e — score-field scorePrefix trait changes reflect in canvas ─────

  test('@regression T638.5e — score-field: scorePrefix trait change reflects in canvas', async ({ editorPage, page }) => {
    await editorPage.addComponentViaEditor('score-field')
    await page.waitForTimeout(300)

    const widget = editorPage.canvasComponent('[data-gjs-type="score-field"]')
    await expect(widget).toBeVisible({ timeout: 15_000 })

    const prefixSpan = widget.locator('span').first()
    await expect(prefixSpan).toContainText('Score:', { timeout: 5_000 })

    // Change scorePrefix trait via model attributes
    await page.evaluate(() => {
      const ed = (window as Record<string, unknown>).__elearn_editor as {
        getSelected: () => { addAttributes: (attrs: Record<string, string>) => void } | null
      } | undefined
      const selected = ed?.getSelected()
      if (!selected) throw new Error('No component selected')
      selected.addAttributes({ scorePrefix: 'Resultado: ' })
    })
    await page.waitForTimeout(300)

    await expect(prefixSpan).toContainText('Resultado:', { timeout: 5_000 })
  })
})
