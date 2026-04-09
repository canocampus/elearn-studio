/**
 * T637.1 — Diagnostic script
 *
 * Reproduces the cursor-loss bug: double-click a Text widget, type several
 * words, and capture every [T637.1] console.debug message that fires during
 * typing.  Also captures any component:selected / component:toggled events.
 *
 * Run with:
 *   pnpm --filter e2e playwright test t637-diagnostic --headed --reporter=line
 *
 * This file will be DELETED in T637.7 together with the diagnostic listeners.
 */

import { test, expect } from '../fixtures'

// Increase timeout — we need time for autosave debounce (2 s) to fire.
test.setTimeout(60_000)

test('T637.1 — capture console events during text-edit', async ({ editorPage, page }) => {
  const events: string[] = []

  // Capture every console message from the page (main frame + all workers).
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[T637.1]') || text.includes('text-edit')) {
      events.push(`[${msg.type()}] ${text}`)
    }
  })

  // Add a fresh slide so we start clean.
  await editorPage.addSlide()
  await editorPage.slideItemByIndex(0).click()
  await editorPage.waitForCanvas()

  // Drop a Text widget on the canvas.
  await editorPage.dragBlockToCanvas('Text', 200, 200)
  await page.waitForTimeout(300)

  // ── INSPECT: what's in the iframe? ──────────────────────────────────────
  const iframeBodyHTML: string = await page.evaluate(() => {
    const iframe = document.querySelector('iframe.gjs-frame') as HTMLIFrameElement | null
    return iframe?.contentDocument?.body?.innerHTML?.substring(0, 2000) ?? 'NO IFRAME'
  })
  events.push(`--- IFRAME BODY (first 2000 chars): ${iframeBodyHTML} ---`)

  const gjsCommands: string = await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { Commands: { getAll: () => Record<string, unknown> } } | undefined
    return ed ? Object.keys(ed.Commands.getAll()).join(', ') : 'NO EDITOR'
  })
  events.push(`--- GJS COMMANDS: ${gjsCommands} ---`)

  // ── SCENARIO A: plain typing ────────────────────────────────────────────
  // Double-click to enter text-edit, then type. Record whether text-edit is
  // actually active after the dblclick, and whether any events fire during typing.

  const textComponent = editorPage.canvasComponent('[data-gjs-type="text"]')
  await textComponent.dblclick()
  await page.waitForTimeout(300)

  const isTextEditActiveA: boolean = await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { Commands: { isActive: (c: string) => boolean } } | undefined
    return ed?.Commands.isActive('text-edit') ?? false
  })
  events.push(`--- SCENARIO A: dblclick done — text-edit active: ${isTextEditActiveA} ---`)

  const iframe = page.frameLocator('iframe.gjs-frame')
  const editableEl = iframe.locator('[contenteditable="true"]').first()
  await editableEl.click()

  events.push('--- A: START TYPING ---')
  for (const char of 'Hello world this is a test') {
    await page.keyboard.type(char)
    await page.waitForTimeout(80)
  }
  events.push('--- A: TYPING DONE ---')

  // Wait for autosave debounce (2 s) to fire, if it does.
  await page.waitForTimeout(2_500)
  events.push('--- A: AFTER DEBOUNCE ---')

  // Check text-edit still active after debounce (should be — T637.2 must not close it).
  const isTextEditAfterDebounceA: boolean = await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { Commands: { isActive: (c: string) => boolean } } | undefined
    return ed?.Commands.isActive('text-edit') ?? false
  })
  events.push(`--- A: text-edit still active after debounce: ${isTextEditAfterDebounceA} ---`)

  // ── SCENARIO B: race condition ───────────────────────────────────────────
  // Trigger the autosave timer FIRST (via a fake component:update event),
  // THEN enter text-edit within the 2 s window.
  // Old code would call stopCommand('text-edit') and close the editor.
  // T637.2 should defer instead.

  // Exit text-edit first.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  events.push('--- SCENARIO B: trigger autosave timer then enter text-edit ---')

  // Fire component:update event to start the 2 s timer.
  await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { trigger: (event: string, data: unknown) => void } | undefined
    ed?.trigger('component:update', {})
  })

  // Immediately enter text-edit (within the 2 s window).
  await textComponent.dblclick()
  await page.waitForTimeout(300)

  const isTextEditActiveB: boolean = await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { Commands: { isActive: (c: string) => boolean } } | undefined
    return ed?.Commands.isActive('text-edit') ?? false
  })
  events.push(`--- B: text-edit active before debounce fires: ${isTextEditActiveB} ---`)

  // Wait for the autosave debounce to fire (2 s from trigger above).
  await page.waitForTimeout(2_500)

  const isTextEditAfterB: boolean = await page.evaluate(() => {
    const ed = (window as Record<string, unknown>).__elearn_editor as { Commands: { isActive: (c: string) => boolean } } | undefined
    return ed?.Commands.isActive('text-edit') ?? false
  })
  events.push(`--- B: text-edit still active after debounce fires: ${isTextEditAfterB} (should be TRUE if T637.2 works) ---`)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // Print all captured events to the test output.
  console.log('\n=== T637.1 DIAGNOSTIC EVENTS ===')
  for (const e of events) {
    console.log(e)
  }
  console.log('=== END ===\n')

  // The test itself just needs to run — no assertion needed for a diagnostic.
  expect(events.length).toBeGreaterThan(0)
})
