import * as fs from 'fs'
import * as path from 'path'
import { test, expect } from '@playwright/test'

/**
 * C-01 — Runtime player actions engine E2E gate
 *
 * Verifies that the actions engine (EventDispatcher + ActionExecutor) is fully
 * wired into the runtime player and executes actions against the live DOM.
 *
 * Two critical flows are tested:
 *   C-01.1 — show / hide action triggered by a button click
 *   C-01.2 — call-sequence action that executes a sharedSequence
 *
 * These tests do NOT use the authoring-UI fixture.  They load player.js directly
 * into a bare HTML page via page.setContent(), inject a crafted course JSON, and
 * assert DOM mutations produced by the actions engine.
 *
 * Gate of closure (from audit-consolidado):
 *   "show/hide and call-sequence executed by the real runtime player,
 *    verified with an E2E test that checks the resulting DOM."
 */

// Resolve the built player.js once for all tests in this file.
const PLAYER_JS_PATH = path.resolve(
  __dirname,
  '../../packages/runtime-player/dist/player.js',
)

function readPlayerJs(): string {
  if (!fs.existsSync(PLAYER_JS_PATH)) {
    throw new Error(
      `player.js not found at ${PLAYER_JS_PATH}. ` +
      'Run: pnpm --filter runtime-player build',
    )
  }
  return fs.readFileSync(PLAYER_JS_PATH, 'utf-8')
}

/**
 * Minimal HTML wrapper: injects player.js inline and calls ELearnPlayer.init()
 * with the supplied course JSON.  No network requests — fully self-contained.
 */
function buildPlayerHtml(playerJs: string, courseJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="elearn-player"
       style="width:1024px;height:768px;position:relative;overflow:hidden;"></div>
  <script>${playerJs}</script>
  <script>
    try {
      ELearnPlayer.init('elearn-player', ${courseJson});
    } catch (err) {
      document.body.setAttribute('data-init-error', String(err));
    }
  </script>
</body>
</html>`
}

// ─── C-01.1  show / hide ──────────────────────────────────────────────────────

test.describe('C-01 — Runtime player actions engine', () => {
  let playerJs: string

  test.beforeAll(() => {
    playerJs = readPlayerJs()
  })

  test('C-01.1 — hide action hides target widget on button click (regression gate)', async ({ page }) => {
    /**
     * Slide contains:
     *   • A button ("Hide Target") with onClick → hide('target-text')
     *   • A text widget with id 'target-text' — starts visible
     *
     * After clicking the button, executeHide() must:
     *   1. Set el.style.display = 'none' on #w-target-text
     *   2. Set el.getAttribute('data-hidden') === 'true'
     */
    const course = {
      _id: 'c01-hide-test',
      title: 'C-01 Hide Test',
      slides: [
        {
          id: 'slide-1',
          title: 'Slide 1',
          widgets: [
            {
              id: 'hide-btn',
              type: 'button',
              bounds: { x: 10, y: 10, width: 140, height: 40 },
              properties: { content: 'Hide Target' },
              actions: [
                {
                  event: 'click',
                  actions: [{ type: 'hide', params: { widgetId: 'target-text' } }],
                },
              ],
              visible: true,
              layer: 1,
            },
            {
              id: 'target-text',
              type: 'text',
              bounds: { x: 10, y: 60, width: 200, height: 40 },
              properties: { content: '<p>I am the target</p>' },
              actions: [],
              visible: true,
              layer: 2,
            },
          ],
        },
      ],
      sharedSequences: [],
      settings: { width: 1024, height: 768 },
    }

    await page.setContent(buildPlayerHtml(playerJs, JSON.stringify(course)))

    // Confirm player initialised without error
    await expect(page.locator('body')).not.toHaveAttribute('data-init-error')

    // Both widgets must be rendered and initially visible
    const btn    = page.locator('#w-hide-btn')
    const target = page.locator('#w-target-text')
    await expect(btn).toBeVisible({ timeout: 5_000 })
    await expect(target).toBeVisible({ timeout: 5_000 })

    // Trigger the click → hide action sequence
    await btn.click()

    // executeHide() must have set display:none and data-hidden="true"
    // Playwright `not.toBeVisible()` checks display:none / visibility:hidden / opacity:0
    await expect(target).not.toBeVisible({ timeout: 3_000 })
    await expect(target).toHaveAttribute('data-hidden', 'true')
  })

  test('C-01.2 — show action restores a hidden widget (regression gate)', async ({ page }) => {
    /**
     * Slide contains:
     *   • A text widget ('hidden-target') that starts HIDDEN (visible: false)
     *   • A button ("Show Target") with onClick → show('hidden-target')
     *
     * After clicking, executeShow() must remove display:none / data-hidden.
     */
    const course = {
      _id: 'c01-show-test',
      title: 'C-01 Show Test',
      slides: [
        {
          id: 'slide-1',
          title: 'Slide 1',
          widgets: [
            {
              id: 'show-btn',
              type: 'button',
              bounds: { x: 10, y: 10, width: 140, height: 40 },
              properties: { content: 'Show Target' },
              actions: [
                {
                  event: 'click',
                  actions: [{ type: 'show', params: { widgetId: 'hidden-target' } }],
                },
              ],
              visible: true,
              layer: 1,
            },
            {
              id: 'hidden-target',
              type: 'text',
              bounds: { x: 10, y: 60, width: 200, height: 40 },
              properties: { content: '<p>Now you see me</p>' },
              actions: [],
              visible: false,  // starts hidden
              layer: 2,
            },
          ],
        },
      ],
      sharedSequences: [],
      settings: { width: 1024, height: 768 },
    }

    await page.setContent(buildPlayerHtml(playerJs, JSON.stringify(course)))
    await expect(page.locator('body')).not.toHaveAttribute('data-init-error')

    const btn    = page.locator('#w-show-btn')
    const target = page.locator('#w-hidden-target')

    await expect(btn).toBeVisible({ timeout: 5_000 })
    // Hidden widget is in the DOM but not visible
    await expect(target).not.toBeVisible({ timeout: 5_000 })

    await btn.click()

    // executeShow() removes display:none — widget must now be visible
    await expect(target).toBeVisible({ timeout: 3_000 })
    await expect(target).not.toHaveAttribute('data-hidden')
  })

  test('C-01.3 — call-sequence action executes a sharedSequence (regression gate)', async ({ page }) => {
    /**
     * Course has sharedSequences = [{ name: 'hide-target', actions: [hide('seq-target')] }]
     *
     * Slide contains:
     *   • A button ("Call Seq") with onClick → call-sequence('hide-target')
     *   • A text widget 'seq-target' — starts visible
     *
     * executeCallSequence() looks up 'hide-target' in ctx.sharedSequences and
     * delegates to executor.run(), which calls executeHide.
     * The widget must be hidden after the button click.
     */
    const course = {
      _id: 'c01-callseq-test',
      title: 'C-01 Call Sequence Test',
      slides: [
        {
          id: 'slide-1',
          title: 'Slide 1',
          widgets: [
            {
              id: 'callseq-btn',
              type: 'button',
              bounds: { x: 10, y: 10, width: 150, height: 40 },
              properties: { content: 'Call Seq' },
              actions: [
                {
                  event: 'click',
                  actions: [{ type: 'call-sequence', params: { sequenceName: 'hide-target' } }],
                },
              ],
              visible: true,
              layer: 1,
            },
            {
              id: 'seq-target',
              type: 'text',
              bounds: { x: 10, y: 60, width: 200, height: 40 },
              properties: { content: '<p>Sequence target</p>' },
              actions: [],
              visible: true,
              layer: 2,
            },
          ],
        },
      ],
      sharedSequences: [
        {
          name: 'hide-target',
          actions: [{ type: 'hide', params: { widgetId: 'seq-target' } }],
        },
      ],
      settings: { width: 1024, height: 768 },
    }

    await page.setContent(buildPlayerHtml(playerJs, JSON.stringify(course)))
    await expect(page.locator('body')).not.toHaveAttribute('data-init-error')

    const btn    = page.locator('#w-callseq-btn')
    const target = page.locator('#w-seq-target')

    await expect(btn).toBeVisible({ timeout: 5_000 })
    await expect(target).toBeVisible({ timeout: 5_000 })

    await btn.click()

    // call-sequence → run('hide-target') → executeHide → display:none
    await expect(target).not.toBeVisible({ timeout: 3_000 })
    await expect(target).toHaveAttribute('data-hidden', 'true')
  })
})
