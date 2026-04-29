/**
 * Sim Editor E2E helpers — single source of truth.
 *
 * Used by both `simulation-editor.spec.ts` (TD-014.22 / .35 — full happy-path
 * E2E) and `docs-screenshots.spec.ts` (TD-013.5 — §13 user-manual captures).
 *
 * Extracted from `simulation-editor.spec.ts` 2026-04-29 (TD-013.5) so the
 * docs campaign reuses the same real-UI flow the editor spec exercises —
 * keeping the contract tested by the spec the same one documented by the
 * captures. Do NOT duplicate this logic in tests; import from here.
 */

import path from 'path'
import { expect, type Page } from '@playwright/test'
import { addBlockById } from './screenshot'

/**
 * Canonical sim-test fixture image. Already shipped under
 * `e2e/fixtures/images/test.png`; resolved from this module's location so
 * any caller can use it without recomputing the path.
 */
export const SIM_FIXTURE_IMG = path.resolve(__dirname, '..', 'fixtures', 'images', 'test.png')

/**
 * Dispatch the GrapesJS view's `onDblClick` for the given component id.
 *
 * Programmatic dblclick on the rendered iframe is unreliable (Playwright
 * cannot directly target the GrapesJS-managed iframe DOM in a way that
 * survives event delegation), so we invoke the view handler the
 * registerSimBlock binding wires to `events.dblclick` (= `'onDblClick'`).
 * This is the same path GrapesJS would call — we just bypass the DOM event
 * dispatch.
 *
 * Requires DEV / `VITE_E2E_MODE=true` builds where `window.__elearn_editor`
 * is exposed.
 */
export async function triggerSimDblClick(page: Page, componentId: string): Promise<void> {
  await page.evaluate((compId: string) => {
    const ed = window.__elearn_editor
    if (!ed) throw new Error('__elearn_editor not exposed')
    const comp = ed.getWrapper()?.find(`#${compId}`)[0]
    if (!comp) throw new Error(`component ${compId} not found`)
    const view = (comp as unknown as { getView?: () => { onDblClick?: () => void } }).getView?.()
    view?.onDblClick?.()
  }, componentId)
}

/**
 * Place a screenshot-sim widget on the current slide and open the Sim Editor
 * overlay on it. Waits on the `+ Add step` button as the deterministic
 * "overlay mounted" signal.
 *
 * Returns the GrapesJS component id of the placed widget (callers that need
 * to re-locate it after a reload — e.g. persistence specs — can use this).
 */
export async function openSimEditor(page: Page, name = 'SimUnderTest'): Promise<string> {
  const simId = await addBlockById(page, 'screenshot-sim', name)
  await triggerSimDblClick(page, simId)
  await expect(page.getByTestId('sim-add-step-btn')).toBeVisible()
  return simId
}

/**
 * Add a step via real UI: click `+ Add step` → upload the canonical fixture
 * image into the StepForm `input[type=file]` → fill Description → fill
 * Instruction (first textarea in the form).
 *
 * Pure real-UI flow — no `simStore.addStep()` from the spec. After
 * `+ Add step`, `addStep` (in production) sets `selectedStepIndex` to the
 * new step, so the file input + description input + instruction textarea
 * all bind to the freshly-created step without an extra click.
 */
export async function addAndUploadStep(
  page: Page,
  description: string,
  instruction: string,
): Promise<void> {
  await page.getByTestId('sim-add-step-btn').click()
  // Exactly one `input[type=file]` is rendered per StepForm.
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(SIM_FIXTURE_IMG)
  await page.getByTestId('step-description-input').fill(description)
  // Instruction textarea — first textarea inside the form panel.
  const instructionEl = page.locator('textarea').first()
  await instructionEl.fill(instruction)
}

/**
 * Draw a hotspot rectangle on the currently-selected step via real
 * `page.mouse` events on the Konva stage.
 *
 * Konva renders no `data-testid` surface; the Konva-owned `.konvajs-content`
 * class is the only stable selector. The Sim Editor mounts exactly one Konva
 * stage, so `.first()` is unambiguous.
 *
 * The 0.15 / 0.85 inset keeps both corners away from `rectFromPoints`'s
 * `clampPoint` borders so neither axis gets squashed; with CANVAS_W/H =
 * 640×360 the committed rect is ~448×252 in canvas units — comfortably
 * above the > 100 / > 50 thresholds the persistence spec asserts.
 *
 * Polls on `__simStore.getState().config?.steps[stepIndex].hotspot.width > 100`
 * (read-only verification — NOT seeding) to absorb React-commit lag between
 * `mouseUp` and `updateStep` landing in the store.
 */
export async function drawHotspotOnSelectedStep(
  page: Page,
  stepIndex: number,
): Promise<void> {
  const stage = page.locator('.konvajs-content').first()
  await stage.waitFor({ state: 'visible' })
  const stageBox = await stage.boundingBox()
  if (!stageBox) throw new Error('Konva stage has no bounding box')

  const startX = stageBox.x + 0.15 * stageBox.width
  const startY = stageBox.y + 0.15 * stageBox.height
  const endX = stageBox.x + 0.85 * stageBox.width
  const endY = stageBox.y + 0.85 * stageBox.height
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY, { steps: 10 })
  await page.mouse.up()

  await expect.poll(
    () => page.evaluate(
      (i: number) => window.__simStore?.getState().config?.steps[i]?.hotspot.width ?? 0,
      stepIndex,
    ),
  ).toBeGreaterThan(100)
}
