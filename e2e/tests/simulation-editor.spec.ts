/**
 * TD-014.22 — Screenshot Simulation editor — happy path E2E.
 *
 * Pure real-UI flow exercised end-to-end:
 *   login → add `screenshot-sim` widget → open the overlay → + Add step (×2)
 *   → upload screenshots → draw hotspots → fill Instruction → drag-reorder →
 *   Save & Close → reload → re-open → steps + order + content persisted.
 *
 * Fixture image: `e2e/fixtures/images/test.png` (already shipped).
 *
 * Scope boundary (TD-014.22 vs .23): this spec does NOT touch the recorder —
 * it covers the *manual* authoring path only. The recorder variant lives in
 * `simulation-recorder.spec.ts` and is gated on SIMULATION_ENGINE_URL.
 */

import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'
import { addBlockById } from '../utils/screenshot'
import path from 'path'

const FIXTURE_IMG = path.resolve(__dirname, '..', 'fixtures', 'images', 'test.png')

async function triggerDblClick(page: Page, id: string): Promise<void> {
  await page.evaluate((compId: string) => {
    const ed = window.__elearn_editor
    if (!ed) throw new Error('__elearn_editor not exposed')
    const comp = ed.getWrapper()?.find(`#${compId}`)[0]
    if (!comp) throw new Error(`component ${compId} not found`)
    const view = (comp as unknown as { getView?: () => { onDblClick?: () => void } }).getView?.()
    view?.onDblClick?.()
  }, id)
}

async function openSimEditor(page: Page): Promise<string> {
  const simId = await addBlockById(page, 'screenshot-sim', 'SimUnderTest')
  await triggerDblClick(page, simId)
  await expect(page.getByTestId('sim-add-step-btn')).toBeVisible()
  return simId
}

async function addAndUploadStep(page: Page, description: string, instruction: string): Promise<void> {
  await page.getByTestId('sim-add-step-btn').click()
  // The hidden <input type=file> lives inside StepForm — there is exactly
  // one of them per rendered StepForm.
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(FIXTURE_IMG)
  // Description input — renders inside the step list row, so filling it gives
  // the step a stable DOM identity for the TD-014.30 reorder assertion.
  await page.getByTestId('step-description-input').fill(description)
  // Instruction textarea — first textarea in the form; verified via simStore
  // + post-reload read in TD-014.31 (F6).
  const instructionEl = page.locator('textarea').first()
  await instructionEl.fill(instruction)
}

test.describe('Screenshot Simulation editor — TD-014.22', () => {
  test('create → upload → reorder → save → reload → persistence', async ({ editorPage, page }) => {
    await editorPage.addSlide()

    // ── Open the Sim editor overlay on a freshly placed widget ────────────
    await openSimEditor(page)

    // ── Add step #1 ───────────────────────────────────────────────────────
    await addAndUploadStep(page, 'Step 1', 'Step one: click login')
    await expect(page.getByTestId('sim-step-item-0')).toBeVisible()

    // ── Add step #2 ───────────────────────────────────────────────────────
    await addAndUploadStep(page, 'Step 2', 'Step two: enter password')
    await expect(page.getByTestId('sim-step-item-1')).toBeVisible()

    // ── TD-014.35 (F10): draw-mode hotspot gesture on step 0 ──────────────
    // `addStep` sets `selectedStepIndex` to the new step (= 1 after Step 2),
    // so click step-item-0 to bring Step 1 into focus — HotspotCanvas mounts
    // in draw-mode because the seeded hotspot is the zero-size sentinel.
    await page.getByTestId('sim-step-item-0').click()

    // Konva renders its Stage inside a `.konvajs-content` div — no testid
    // surface; the Konva-owned class is the only stable selector. The sim
    // editor mounts exactly one Konva stage, so `.first()` is unambiguous.
    const stage = page.locator('.konvajs-content').first()
    await stage.waitFor({ state: 'visible' })
    const stageBox = await stage.boundingBox()
    if (!stageBox) throw new Error('Konva stage has no bounding box')

    // Drag a rectangle across ~70% × 70% of the stage. HotspotCanvas's
    // CANVAS_W/H are 640×360 → committed rect is ~448×252 in canvas units,
    // comfortably above the > 100 / > 50 thresholds; the inset keeps both
    // corners away from `rectFromPoints`'s clampPoint borders so neither
    // axis gets squashed.
    const startX = stageBox.x + 0.15 * stageBox.width
    const startY = stageBox.y + 0.15 * stageBox.height
    const endX = stageBox.x + 0.85 * stageBox.width
    const endY = stageBox.y + 0.85 * stageBox.height
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    // Immediate assertion — the gesture committed onto step 0. Use ranges,
    // not exact equality: `rectFromPoints` clamps + rounds, and device
    // pixel ratio can shift integer values across runners. Poll on width
    // to absorb any React-commit lag between mouseUp and `updateStep`
    // landing in the store.
    await expect.poll(
      () => page.evaluate(
        () => window.__simStore?.getState().config?.steps[0].hotspot.width ?? 0,
      ),
    ).toBeGreaterThan(100)

    const drawnHotspot = await page.evaluate(
      () => window.__simStore?.getState().config?.steps[0].hotspot ?? null,
    )
    expect(drawnHotspot).not.toBeNull()
    expect(drawnHotspot!.width).toBeGreaterThan(100)
    expect(drawnHotspot!.height).toBeGreaterThan(50)
    expect(drawnHotspot!.x).toBeGreaterThanOrEqual(0)
    expect(drawnHotspot!.y).toBeGreaterThanOrEqual(0)

    // ── Drag step 1 onto step 0 (TD-014.7b reorder) ───────────────────────
    const first = page.getByTestId('sim-step-item-0')
    const second = page.getByTestId('sim-step-item-1')
    const firstBox = await first.boundingBox()
    const secondBox = await second.boundingBox()
    if (!firstBox || !secondBox) throw new Error('step items have no bounding boxes')
    await page.mouse.move(secondBox.x + 10, secondBox.y + 10)
    await page.mouse.down()
    await page.mouse.move(firstBox.x + 10, firstBox.y + 10, { steps: 10 })
    await page.mouse.up()

    // TD-014.30 (F5): real reorder assertion — step 2 now at index 0, step 1 at index 1.
    // DOM-level: step list renders descriptions in the swapped order.
    await expect.poll(async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="sim-step-item-"]'))
          .map(el => el.querySelector('[data-field="description"]')?.textContent ?? ''),
      ),
    ).toEqual(['Step 2', 'Step 1'])

    // Store-level: belt-and-braces — config.steps array has the same order.
    // Guards against a DOM render that happens to match the old order by
    // coincidence (e.g. if keys were reused incorrectly).
    await expect.poll(async () =>
      page.evaluate(() => window.__simStore?.getState().config?.steps.map(s => s.description) ?? []),
    ).toEqual(['Step 2', 'Step 1'])

    // ── Save & Close ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: /save.*close/i }).click()
    await expect(page.getByTestId('sim-add-step-btn')).toBeHidden()

    // ── Reload + re-open ──────────────────────────────────────────────────
    await page.reload()
    await editorPage.waitForCanvas()
    const reloadedSimId = await page.evaluate(() => {
      // GrapesJS does NOT auto-attach `data-widget` to component model attributes
      // (only `type` on the model + `data-gjs-type` on the rendered DOM). The
      // `find('[data-widget=...]')` selector runs against the model's attributes
      // hash and returns empty for screenshot-sim because registerSimBlock never
      // sets that attribute. Walk top-level components and filter by `c.get('type')`
      // — same pattern used in `docs-screenshots.spec.ts:798-802` for the same reason.
      const ed = window.__elearn_editor
      const comps = ed?.getWrapper()?.components() ?? []
      for (const c of comps) {
        if (c.get('type') === 'screenshot-sim') return c.getId()
      }
      return null
    })
    expect(reloadedSimId).toBeTruthy()
    await triggerDblClick(page, reloadedSimId!)

    await expect(page.getByTestId('sim-add-step-btn')).toBeVisible()
    await expect(page.getByTestId('sim-step-item-0')).toBeVisible()
    await expect(page.getByTestId('sim-step-item-1')).toBeVisible()

    // TD-014.31 (F6): content persistence — not just presence.
    //
    // Guards against the class of `handleSave` bugs where the overlay closes
    // cleanly, 2 steps survive, but their fields are wiped. The triad below
    // reads three independent surfaces of truth — step list DOM, StepForm
    // inputs, simStore — so a regression in any of them fails the spec.

    // (a) DOM order of descriptions unchanged after reload (reorder persisted).
    await expect.poll(async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="sim-step-item-"]'))
          .map(el => el.querySelector('[data-field="description"]')?.textContent ?? ''),
      ),
    ).toEqual(['Step 2', 'Step 1'])

    // (b) StepForm inputs bind to the selected step — click step 0 and
    // verify the Description + Instruction values survived the round trip.
    await page.getByTestId('sim-step-item-0').click()
    await expect(page.getByTestId('step-description-input')).toHaveValue('Step 2')
    await expect(page.locator('textarea').first()).toHaveValue('Step two: enter password')

    // (c) Store-level: full shape of each step survives. Checks both that
    // content is preserved AND that no required fields were silently dropped.
    // Screenshot URLs come back as presigned URLs from the backend — asserting
    // non-empty + containing a path segment is enough (exact URL is
    // signature-dependent and not a stable comparison target).
    const persisted = await page.evaluate(() =>
      window.__simStore?.getState().config?.steps.map(s => ({
        description: s.description,
        instruction: s.instruction,
        hasScreenshot: Boolean(s.screenshotUrl && s.screenshotUrl.length > 0),
        hasScreenshotKey: Boolean(s.screenshotKey && s.screenshotKey.length > 0),
        interactionType: s.interactionType ?? 'click',
      })) ?? [],
    )
    expect(persisted).toEqual([
      {
        description: 'Step 2',
        instruction: 'Step two: enter password',
        hasScreenshot: true,
        hasScreenshotKey: true,
        interactionType: 'click',
      },
      {
        description: 'Step 1',
        instruction: 'Step one: click login',
        hasScreenshot: true,
        hasScreenshotKey: true,
        interactionType: 'click',
      },
    ])

    // (d) TD-014.35 (F10) — hotspot persistence (closes TD-014.31's deferred
    // scope). Step 1 was drawn pre-reorder, so after the swap it lives at
    // index 1; Step 2 was never drawn and keeps the zero-size sentinel at
    // index 0. The drawn rectangle must survive `Save & Close → reload →
    // re-open` — guards against `handleSave` regressions that would silently
    // drop hotspot fields, and against backend round-trip drift on
    // `SimHotspot` shape (covered upstream by the contract test added in
    // TD-014.33 / F1, but pinned end-to-end here).
    const persistedHotspots = await page.evaluate(
      () => window.__simStore?.getState().config?.steps.map(s => s.hotspot) ?? [],
    )
    expect(persistedHotspots).toHaveLength(2)
    // Step 2 (index 0) — never drawn, zero-size sentinel preserved.
    expect(persistedHotspots[0]).toMatchObject({ width: 0, height: 0 })
    // Step 1 (index 1) — drawn rectangle survived the round trip. Bounds
    // asserted as ranges (see immediate-assertion comment above for why
    // exact equality is not stable across runners).
    expect(persistedHotspots[1].width).toBeGreaterThan(100)
    expect(persistedHotspots[1].height).toBeGreaterThan(50)
    expect(persistedHotspots[1].x).toBeGreaterThanOrEqual(0)
    expect(persistedHotspots[1].y).toBeGreaterThanOrEqual(0)
  })
})
