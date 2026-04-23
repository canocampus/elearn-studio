/**
 * widget-persistence-across-slides.spec.ts — TD-009 regression guard
 *
 * Root causes (confirmed 2026-04-18):
 *
 *   1. Autosave debounce timer firing mid-load (initEditor.ts).
 *      The event-handler side of triggerAutosave checked getEditorLoading(),
 *      but the setTimeout callback did not. A timer scheduled BEFORE a slide
 *      switch could fire WHILE editor.load(newSlide) was mid-flight, serialise
 *      the transient (empty) GrapesJS state, and PATCH it to the previous
 *      slideId — corrupting the just-saved slide.
 *      Fix: re-check getEditorLoading() inside the timer callback and bail out.
 *
 *   2. Stale data-editor-ready signal (EditorCanvas.tsx).
 *      setIsReady(false) at the top of Effect 2 only *schedules* a re-render
 *      — the DOM attribute does not flip from "true" to "false" in the same
 *      event-loop tick. An external observer (Playwright's waitFor, or any
 *      code polling the DOM) could see the stale "true" from the previous
 *      slide's load and race ahead before the new slide's load completed —
 *      which in turn meant the "flush save before switch" step serialised
 *      the still-stale content into the NEW slide.
 *      Fix: imperatively set data-editor-ready="false" on the container ref
 *      synchronously before the async saveAndLoad() begins, so every observer
 *      sees an accurate "load in progress" state.
 *
 * This spec guards against regression with two scenarios:
 *   1. single-hop — add → switch once → switch back (basic flush).
 *   2. multi-hop  — add across 5 slides → return to slide 1 (the flow
 *      that surfaced the bug in the docs-screenshots campaign).
 */

import { test, expect } from '../fixtures/auth'

test.describe.configure({ mode: 'serial', timeout: 60_000 })
test.use({ actionTimeout: 10_000 })

test('TD-009 reproducer: button survives rapid slide switch', async ({
  editorPage,
  page,
}) => {
  // Seed exactly 2 slides regardless of the course's initial state.
  const slideItems = page.locator('[data-testid="slide-item"]')
  let count = await slideItems.count()
  while (count < 2) {
    await editorPage.addSlide()
    count = await slideItems.count()
  }
  await expect(slideItems).toHaveCount(count)

  // Slide 1: add a button via the dev handle and capture its id.
  await editorPage.slidesTab.click()
  await page.locator('[data-testid="slide-item"]').first().click()
  await editorPage.readySignal().waitFor({ state: 'attached', timeout: 15_000 })

  const buttonId = await page.evaluate(() => {
    const ed = window.__elearn_editor
    if (!ed) throw new Error('__elearn_editor not exposed (need DEV build)')
    const added = ed.addComponents([
      { type: 'button', attributes: { name: 'PersistMe' } },
    ])
    const first = Array.isArray(added) ? added[0] : added
    if (!first) throw new Error('addComponents returned no component')
    return first.getId()
  })

  // Rapidly switch to slide 2 (no artificial wait — mimics a fast human).
  await page.locator('[data-testid="slide-item"]').nth(1).click()
  await editorPage.readySignal().waitFor({ state: 'attached', timeout: 15_000 })

  // Switch back to slide 1.
  await page.locator('[data-testid="slide-item"]').first().click()
  await editorPage.readySignal().waitFor({ state: 'attached', timeout: 15_000 })

  // Inspect the live GrapesJS components list and the find-by-id lookup.
  const diagnostics = await page.evaluate((id) => {
    const ed = window.__elearn_editor
    if (!ed) return { error: '__elearn_editor missing' }
    const all = ed.getComponents().toArray()
    const byFind = ed.getWrapper().find('#' + id).length
    const byTypeButton = all.filter((c) => c.get('type') === 'button').length
    const ids = all.map((c) => ({
      id: c.getId(),
      type: c.get('type'),
      name: c.get('name'),
    }))
    return { count: all.length, byFind, byTypeButton, ids }
  }, buttonId)

  // eslint-disable-next-line no-console
  console.log('[TD-009] diagnostics after round-trip:', JSON.stringify(diagnostics, null, 2))

  // Assertions — we EXPECT the button to be there. This is the regression
  // guard; the test should pass ONCE the bug is fixed (if a bug exists).
  expect(diagnostics).not.toHaveProperty('error')
  expect(diagnostics).toHaveProperty('count')
  // At minimum: the button type should still be present on slide 1.
  expect((diagnostics as { byTypeButton: number }).byTypeButton).toBeGreaterThanOrEqual(1)
  // Ideally: the exact id survives too. If this fails but byTypeButton >= 1,
  // we have an id-instability issue, not data loss.
  expect((diagnostics as { byFind: number }).byFind).toBe(1)
})

test('TD-009 multi-hop: widgets added on slide 1 survive round-trip through 5 slides', async ({
  editorPage,
  page,
}) => {
  // Reproduces the exact flow that surfaced TD-009 in the docs-screenshots
  // campaign: seed 5 slides, add a widget on slide 1, navigate 2→3→4→5,
  // return to slide 1 and assert the widget is still there.
  const slideItems = page.locator('[data-testid="slide-item"]')
  let count = await slideItems.count()
  while (count < 5) {
    await editorPage.addSlide()
    count = await slideItems.count()
  }
  await expect(slideItems).toHaveCount(count)

  await editorPage.slidesTab.click()
  await slideItems.first().click()
  await editorPage.readySignal().waitFor({ state: 'attached', timeout: 15_000 })

  // Add a named widget on slide 1 and capture its id.
  const widgetId = await page.evaluate(() => {
    const ed = window.__elearn_editor
    if (!ed) throw new Error('__elearn_editor not exposed (need DEV build)')
    const added = ed.addComponents([
      { type: 'button', attributes: { name: 'MultiHopSurvivor' } },
    ])
    const first = Array.isArray(added) ? added[0] : added
    if (!first) throw new Error('addComponents returned no component')
    return first.getId()
  })

  // Hop through slides 2, 3, 4, 5 with no artificial waits.
  for (let i = 1; i < 5; i += 1) {
    await slideItems.nth(i).click()
    await editorPage
      .readySignal()
      .waitFor({ state: 'attached', timeout: 15_000 })
  }

  // Return to slide 1 and check the widget survived.
  await slideItems.first().click()
  await editorPage
    .readySignal()
    .waitFor({ state: 'attached', timeout: 15_000 })

  const diagnostics = await page.evaluate((id) => {
    const ed = window.__elearn_editor
    if (!ed) return { error: '__elearn_editor missing' }
    return {
      count: ed.getComponents().toArray().length,
      byFind: ed.getWrapper().find('#' + id).length,
    }
  }, widgetId)

  expect(diagnostics).not.toHaveProperty('error')
  expect((diagnostics as { count: number }).count).toBeGreaterThanOrEqual(1)
  expect((diagnostics as { byFind: number }).byFind).toBe(1)
})
