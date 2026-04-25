/**
 * TD-014.23 — Simulation Recorder E2E (gated on SIMULATION_ENGINE_URL).
 *
 * Skips automatically if the env var is not set or the service is not
 * reachable — the CI minimal matrix may not start `simulation-engine`, and we
 * do not want this spec to flake the main run.
 *
 * Flow:
 *   login → add screenshot-sim → open overlay → Record… dialog →
 *   enter fixture URL → Start → live view mounts → Capture ×2 →
 *   Stop & import → simStore has N steps → overlay shows them → cleanup
 *   via DELETE /recorder/sessions/:id (TD-014.8b endpoint).
 */

import { test, expect } from '../fixtures'
import { addBlockById } from '../utils/screenshot'

const SIM_ENGINE = process.env.SIMULATION_ENGINE_URL ?? ''

// Fixture URL — a stable public page the Playwright browser inside the
// recorder can reach. Using example.com because it is the HTTP equivalent of
// /dev/null: stable, no auth, no SPA state.
const FIXTURE_URL = process.env.RECORDER_FIXTURE_URL ?? 'https://example.com'

test.describe('Simulation Recorder — TD-014.23', () => {
  test.skip(
    !SIM_ENGINE,
    'SIMULATION_ENGINE_URL not set — recorder service unreachable; gated spec',
  )

  test.beforeAll(async ({}, testInfo) => {
    // Opportunistic health check; mark spec as skipped if the service is down.
    try {
      const res = await fetch(`${SIM_ENGINE}/health`, { method: 'GET' })
      if (!res.ok) testInfo.skip(true, `recorder /health returned ${res.status}`)
    } catch (e) {
      testInfo.skip(true, `recorder unreachable at ${SIM_ENGINE}: ${(e as Error).message}`)
    }
  })

  test('launcher → live view → capture → stop & import', async ({ editorPage, page, request }) => {
    await editorPage.addSlide()

    // Open the Sim editor overlay.
    const simId = await addBlockById(page, 'screenshot-sim', 'RecorderSmoke')
    await page.evaluate((id: string) => {
      const ed = window.__elearn_editor
      const comp = ed?.getWrapper()?.find(`#${id}`)[0]
      const view = (comp as unknown as { getView?: () => { onDblClick?: () => void } } | undefined)?.getView?.()
      view?.onDblClick?.()
    }, simId)
    await expect(page.getByTestId('sim-add-step-btn')).toBeVisible()

    // Click Record… → dialog appears.
    await page.getByTestId('sim-record-btn').click()
    await expect(page.getByTestId('recorder-url-input')).toBeVisible()

    // Fill URL + start.
    await page.getByTestId('recorder-url-input').fill(FIXTURE_URL)
    await page.getByTestId('recorder-dialog-start').click()

    // Live view should mount when recorderStore.recording becomes true.
    await expect(page.getByTestId('recorder-live-preview')).toBeVisible({ timeout: 10_000 })

    // Capture step twice.
    await page.getByTestId('recorder-live-capture').click()
    await page.getByTestId('recorder-live-capture').click()

    // ── Capture activeSessionId BEFORE Stop & import ───────────────────────
    // `handleStopAndImport` calls `reset()` after a successful import (see
    // RecorderLiveView.tsx — the contract documented in `recorderStore.ts`
    // header: "reset() returns the store to its initial 'no active session'
    // shape"). Reading the id post-click would always return null; the
    // value must be snapshotted while `recording === true`.
    const sessionId = await page.evaluate(() => window.__recorderStore?.getState().activeSessionId ?? null)
    expect(sessionId, 'recorderStore must expose activeSessionId during recording').not.toBeNull()

    // Stop & import — triggers courseApi.importSimulation + simStore.setConfig + reset().
    await page.getByTestId('recorder-live-stop').click()

    // Live view unmounts; overlay now shows at least 1 step imported.
    await expect(page.getByTestId('recorder-live-preview')).toBeHidden({ timeout: 15_000 })
    await expect(page.getByTestId('sim-step-item-0')).toBeVisible({ timeout: 10_000 })

    // ── Cleanup: remove the session from Garage ───────────────────────────
    // TD-014.29 (F7): the earlier `window.__recorderSessionId` read referenced
    // an API that never existed; every CI run before this fix was accumulating
    // orphan sessions in Garage because the if-guard always fell through.
    if (sessionId) {
      const delRes = await request.delete(`${SIM_ENGINE}/recorder/sessions/${sessionId}`)
      // 204 = deleted; 404 = already gone (e.g. stop+import already cleaned up).
      expect([204, 404]).toContain(delRes.status())
    }
  })
})
