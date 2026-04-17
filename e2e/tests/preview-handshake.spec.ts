import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/**
 * TD-002 — E2E coverage for the T641 preview-popup postMessage handshake.
 *
 * The preview flow transports the live course JSON to the runtime player
 * without using localStorage (Critical Rule 5: runtime player must be
 * self-contained). Verified here:
 *
 *   opener (AppLayout.handlePreview)   popup (/preview.html)
 *   ─────────────────────────────────  ──────────────────────────────────
 *   addEventListener('message', ready) (registered BEFORE window.open)
 *   window.open('/preview.html')     → popup loads player.js
 *                                      window.opener.postMessage(
 *                                        'elearn-preview-ready', origin)
 *   onReady fires:
 *     postMessage(                     onData fires:
 *       { type:'elearn-preview-data',    removeEventListener
 *         course, slideIndex }, origin)  ELearnPlayer.init('player', course, …)
 *
 * Regression coverage:
 *   - Ready message must be sent by the popup to the correct origin (not '*').
 *   - Opener must receive the ready signal (listener registered before open).
 *   - Data message must carry a real `course` object with slides.
 *   - ELearnPlayer.init() must render at least one node into #player.
 *   - Preview popup must not touch localStorage (Critical Rule 5).
 */

type OpenerSpyState = {
  messages: Array<{ origin: string; data: unknown }>
}

type PopupSpyState = {
  messages: Array<{ origin: string; data: unknown }>
  signalsSent: Array<{ origin: string; data: unknown }>
}

/**
 * Install a `postMessage` spy in every page of the context BEFORE any scripts
 * run. Needed because preview.html's inline script executes immediately — we
 * must intercept `window.opener.postMessage` and the incoming 'message' event
 * before that script runs. `addInitScript` applies to the popup at creation.
 */
async function installPopupSpy(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    const w = window as unknown as { __previewSpy?: PopupSpyState }
    if (w.__previewSpy) return
    w.__previewSpy = { messages: [], signalsSent: [] }

    window.addEventListener('message', (e: MessageEvent) => {
      try {
        w.__previewSpy!.messages.push({
          origin: e.origin,
          data: JSON.parse(JSON.stringify(e.data)),
        })
      } catch {
        w.__previewSpy!.messages.push({ origin: e.origin, data: String(e.data) })
      }
    })

    // The popup calls `window.opener.postMessage('elearn-preview-ready', origin)`.
    // Wrap the opener getter so every call through `window.opener.postMessage`
    // is recorded. Safe for opener-less pages: the getter just returns null.
    const origDesc = Object.getOwnPropertyDescriptor(window, 'opener')
    Object.defineProperty(window, 'opener', {
      configurable: true,
      get() {
        const real = origDesc?.get?.call(window)
        if (!real) return real
        return new Proxy(real, {
          get(target, prop) {
            if (prop === 'postMessage') {
              return (data: unknown, targetOrigin: string) => {
                try {
                  w.__previewSpy!.signalsSent.push({
                    origin: targetOrigin,
                    data: JSON.parse(JSON.stringify(data)),
                  })
                } catch {
                  w.__previewSpy!.signalsSent.push({
                    origin: targetOrigin,
                    data: String(data),
                  })
                }
                return Reflect.get(target, prop).call(target, data, targetOrigin)
              }
            }
            return Reflect.get(target, prop)
          },
        })
      },
    })
  })
}

/** Install an opener-side 'message' listener that records every inbound event. */
async function installOpenerSpy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __openerSpy?: OpenerSpyState }
    if (w.__openerSpy) return
    w.__openerSpy = { messages: [] }
    window.addEventListener('message', (e: MessageEvent) => {
      try {
        w.__openerSpy!.messages.push({
          origin: e.origin,
          data: JSON.parse(JSON.stringify(e.data)),
        })
      } catch {
        w.__openerSpy!.messages.push({ origin: e.origin, data: String(e.data) })
      }
    })
  })
}

test.describe('T641 preview-popup postMessage handshake @integration', () => {
  test('TD-002 — full handshake: ready signal → data response → player renders', async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[BROWSER]', msg.text())
    })

    // 1. Add a slide + a rectangle so the preview has something to render.
    await editorPage.addSlide()
    await editorPage.waitForCanvas()
    await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
    await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]'))
      .toBeVisible({ timeout: 15_000 })

    // Wait for the 2s autosave debounce + safety buffer so the Zustand store is
    // consistent when handlePreview reads `course`. The opener actually injects
    // the live GrapesJS tree into the payload, but a consistent store guards
    // against regressions where the injection path is removed.
    await page.waitForTimeout(2500)

    // 2. Install spies BEFORE clicking Preview.
    //    - Opener spy: inline via page.evaluate.
    //    - Popup spy: addInitScript on the context so it lands in the popup
    //      before preview.html's inline handshake script runs.
    await installOpenerSpy(page)
    await installPopupSpy(page)

    // 3. Click Preview and capture the popup.
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 10_000 }),
      editorPage.previewButton.click(),
    ])

    // 4. Popup URL must be /preview.html.
    await popup.waitForLoadState('domcontentloaded')
    expect(popup.url()).toContain('/preview.html')

    // 5. Wait for the handshake to complete. preview.html retries the ready
    //    signal for ~1s, then onData must arrive, then init() must run.
    await popup.waitForFunction(
      () => {
        const w = window as unknown as { __previewSpy?: PopupSpyState }
        return (w.__previewSpy?.messages.length ?? 0) > 0
      },
      undefined,
      { timeout: 5_000 },
    )

    // 6. Popup must have received exactly one 'elearn-preview-data' message
    //    carrying a real course with slides.
    const popupState = await popup.evaluate(() => {
      const w = window as unknown as { __previewSpy?: PopupSpyState }
      return w.__previewSpy ?? { messages: [], signalsSent: [] }
    })

    const dataMessages = popupState.messages.filter(
      (m): m is { origin: string; data: { type: string; course: { slides: unknown[] }; slideIndex: number } } =>
        typeof m.data === 'object' &&
        m.data !== null &&
        (m.data as { type?: unknown }).type === 'elearn-preview-data',
    )
    expect(dataMessages, 'popup must receive elearn-preview-data').toHaveLength(1)

    const payload = dataMessages[0]!.data
    expect(payload.course).toBeTruthy()
    expect(Array.isArray(payload.course.slides)).toBe(true)
    expect(payload.course.slides.length).toBeGreaterThan(0)
    expect(typeof payload.slideIndex).toBe('number')

    // 7. Popup must have signalled ready with the correct origin (not '*').
    expect(popupState.signalsSent.length).toBeGreaterThanOrEqual(1)
    const readySignal = popupState.signalsSent.find(s => s.data === 'elearn-preview-ready')
    expect(readySignal, 'popup must send elearn-preview-ready').toBeTruthy()
    expect(readySignal!.origin).toBe(new URL(popup.url()).origin)
    expect(readySignal!.origin).not.toBe('*')

    // 8. Opener must have received the ready signal — guards against a
    //    regression where the listener is registered after window.open().
    const openerState = await page.evaluate(() => {
      const w = window as unknown as { __openerSpy?: OpenerSpyState }
      return w.__openerSpy ?? { messages: [] }
    })
    const readyReceived = openerState.messages.find(m => m.data === 'elearn-preview-ready')
    expect(readyReceived, 'opener must receive elearn-preview-ready').toBeTruthy()

    // 9. ELearnPlayer.init() must have rendered content into #player.
    //    If init() failed (runtime-player not built), preview.html shows the
    //    '.preview-error' fallback — that must not be present.
    const playerContent = popup.locator('#player')
    await expect(playerContent).toBeVisible({ timeout: 5_000 })
    await expect(popup.locator('.preview-error')).toHaveCount(0)
    await expect(playerContent.locator('*').first()).toBeVisible({ timeout: 5_000 })

    // 10. Critical Rule 5: preview.html must not touch localStorage.
    const popupLocalStorageKeys = await popup.evaluate(() => Object.keys(window.localStorage).length)
    expect(popupLocalStorageKeys, 'preview.html must not write to localStorage').toBe(0)

    // 11. Cleanup.
    await popup.close()
    expect(popup.isClosed()).toBe(true)
  })
})
