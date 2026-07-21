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

// ---------------------------------------------------------------------------
// TD-019 — the author-assigned widget name survives slide switches
// ---------------------------------------------------------------------------

test.describe('TD-019 — widget name round-trip', () => {
  test('@regression TD-019 — NameField keeps the author name after switching slides away and back', async ({ editorPage, page }) => {
    test.setTimeout(60_000)

    // Regression: the loader restored the name only into attributes.name; the
    // component MODEL reverted to the type default ('Button'), which the
    // NameField displays AND which the next save preferred over the author's
    // attribute — silently overwriting widget.name in the course document.
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    const slides = page.locator('[data-testid="slide-item"]')
    const ourSlideIndex = (await slides.count()) - 1

    await editorPage.addComponentViaEditor('button')
    await page.waitForTimeout(300)
    await editorPage.propsTab.click()
    const nameInput = page.getByTestId('widget-name-input')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill('MyStartBtn')
    await page.waitForTimeout(300)
    await page.waitForResponse(
      resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    ).catch(() => page.waitForTimeout(2500))

    // Round-trip through another slide.
    await slides.first().click()
    await editorPage.waitForCanvas()
    await slides.nth(ourSlideIndex).click()
    await editorPage.waitForCanvas()

    // Re-select the button via the JS bridge and check the NameField value.
    await page.waitForFunction(() => !!window.__elearn_editor, { timeout: 15_000 })
    await page.evaluate(() => {
      const ed = window.__elearn_editor
      if (!ed) return
      const first = ed.getComponents().first()
      if (first) ed.select(first)
    })
    await page.waitForTimeout(400)
    await editorPage.propsTab.click()
    await expect(page.getByTestId('widget-name-input')).toHaveValue('MyStartBtn', { timeout: 5_000 })
  })
})

test('@regression TD-027 — duplicating a slide copies widgets (and their sequences) with no slide-level actions', async ({ editorPage, page }) => {
  test.setTimeout(60_000)

  // TD-027 retired the fossil Slide.actions: duplicateSlide now PATCHes only
  // widgets. This guards the author-visible contract — the copy carries the
  // source widgets — and pins that the duplicate payload does not resurrect
  // the fossil.
  await editorPage.addSlide()
  await editorPage.waitForCanvas()
  const slides = page.locator('[data-testid="slide-item"]')
  const sourceIndex = (await slides.count()) - 1

  await editorPage.addComponentViaEditor('button')
  await page.waitForTimeout(300)
  await editorPage.propsTab.click()
  const nameInput = page.getByTestId('widget-name-input')
  await expect(nameInput).toBeVisible({ timeout: 5_000 })
  await nameInput.fill('DupSourceBtn')
  await page.waitForTimeout(300)
  await page.waitForResponse(
    resp => resp.url().includes('/courses') && resp.request().method() === 'PATCH',
    { timeout: 15_000 },
  ).catch(() => page.waitForTimeout(2500))

  // TD-028 fixed the staleness this test originally had to dodge with a
  // page.reload(): duplicateSlide now flushes the pending autosave and reads
  // the fresh slide from the server, so duplicating IMMEDIATELY after an
  // edit — the organic author flow below, no reload — copies the new widget.

  // Duplicate via the real UI button and inspect the duplicate's PATCH body.
  const patchBodies: string[] = []
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('/slides/')) {
      patchBodies.push(req.postData() ?? '')
    }
  })
  await editorPage.slidesTab.click()
  const dupPatch = page.waitForResponse(
    resp => resp.url().includes('/slides/') && resp.request().method() === 'PATCH',
    { timeout: 15_000 },
  )
  await slides.nth(sourceIndex).locator('..').getByTitle('Duplicate slide').click()
  await expect(slides).toHaveCount(sourceIndex + 2, { timeout: 10_000 })
  // duplicateSlide is addSlide (POST) + updateSlide (PATCH with the widgets):
  // opening the copy before that PATCH lands shows a blank canvas.
  await dupPatch

  // The copy loads with the source widget intact.
  await slides.nth(sourceIndex + 1).click()
  await editorPage.waitForCanvas()
  const copiedName = await page.evaluate(() => {
    const ed = window.__elearn_editor
    return ed?.getWrapper().components().map(c => c.get('name') as string) ?? []
  })
  expect(copiedName).toContain('DupSourceBtn')

  // And the duplicate PATCH body never resurrected slide-level actions.
  const dupBody = patchBodies.find(b => b.includes('DupSourceBtn'))
  expect(dupBody).toBeTruthy()
  expect(JSON.parse(dupBody!)).not.toHaveProperty('actions')
})
