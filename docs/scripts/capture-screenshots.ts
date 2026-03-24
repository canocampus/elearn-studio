/**
 * capture-screenshots.ts
 *
 * Standalone Playwright script (NOT a @playwright/test suite) that navigates the
 * live eLearn Studio application and captures 19 PNG screenshots to
 * docs/assets/screenshots/.
 *
 * Usage:
 *   pnpm --filter docs run capture
 *
 * Prerequisites:
 *   - docker compose up (authoring-ui + backend/api + MongoDB + Garage)
 *   - e2e/.auth/state.json present (run pnpm --filter e2e run test:setup, or
 *     the script will authenticate from scratch)
 *
 * Environment variables:
 *   DOCS_API_URL     — backend API base URL   (default: http://localhost:3001)
 *   DOCS_BASE_URL    — authoring UI base URL  (default: http://localhost:3000)
 *   DOCS_GRAFANA_URL — Grafana URL            (default: http://localhost:3010)
 *   DOCS_NETWORK_IDLE_TIMEOUT — ms to wait for networkidle (default: 8000)
 */

import { chromium, Browser, BrowserContext, Page, request as pwRequest } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── Configuration ─────────────────────────────────────────────────────────────
const API_URL      = process.env.DOCS_API_URL      ?? 'http://localhost:3001'
const BASE_URL     = process.env.DOCS_BASE_URL     ?? 'http://localhost:3000'
const GRAFANA_URL  = process.env.DOCS_GRAFANA_URL  ?? 'http://localhost:3010'
const NET_IDLE_MS  = Number(process.env.DOCS_NETWORK_IDLE_TIMEOUT ?? '8000')

const E2E_EMAIL    = process.env.E2E_TEST_USER_EMAIL    ?? 'e2e-test@elearn.test'
const E2E_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'e2e-password-secure-123'

const AUTH_STATE_PATH  = path.join(__dirname, '../../e2e/.auth/state.json')
const SCREENSHOTS_DIR  = path.join(__dirname, '../assets/screenshots')

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg: string)  { console.log(`[capture] ${msg}`) }
function warn(msg: string) { console.warn(`[capture] WARN: ${msg}`) }

/** [R5] Wipe and recreate the screenshots folder before every run. */
function cleanScreenshotsDir() {
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true })
    log(`Cleaned screenshots dir: ${SCREENSHOTS_DIR}`)
  }
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  log(`Created screenshots dir: ${SCREENSHOTS_DIR}`)
}

/** Take a screenshot; returns true on success. */
async function screenshot(page: Page, name: string, description: string): Promise<boolean> {
  const filePath = path.join(SCREENSHOTS_DIR, name)
  try {
    await page.screenshot({ path: filePath, fullPage: false })
    log(`✓ ${name} — ${description}`)
    return true
  } catch (err) {
    warn(`✗ ${name} — ${description}: ${err}`)
    return false
  }
}

/**
 * [R2] Wait for network to go idle, then wait an extra stabilisation tick.
 * Swallows timeout errors so a slow network does not abort the whole run.
 */
async function waitNetworkIdle(page: Page, timeoutMs = NET_IDLE_MS): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs })
  } catch {
    // Network did not fully idle — continue; content is probably rendered enough.
  }
}

/**
 * [R1] Wait for the GrapesJS iframe body to contain at least one rendered
 * element before taking a capture.  Falls back gracefully after timeout.
 */
async function waitForGjsIframeContent(page: Page, timeoutMs = 15_000): Promise<void> {
  try {
    const gjsFrame = page.frameLocator('iframe.gjs-frame')
    await gjsFrame.locator('body').waitFor({ state: 'visible', timeout: timeoutMs })
  } catch {
    // iframe not present or took too long — proceed with whatever is rendered
  }
}

/**
 * [R3] After a dragTo operation, wait for a CSS selector inside the GrapesJS
 * iframe that confirms the widget has been injected.
 *
 * @param selector  Any CSS selector that should become visible inside the iframe
 *                  once the widget has been mounted (e.g. '[data-widget="text"]').
 * @param timeoutMs How long to wait before giving up and continuing.
 */
async function waitForWidgetInCanvas(
  page: Page,
  selector: string,
  timeoutMs = 10_000,
): Promise<void> {
  try {
    await page
      .frameLocator('iframe.gjs-frame')
      .locator(selector)
      .first()
      .waitFor({ state: 'visible', timeout: timeoutMs })
  } catch {
    // Widget may have a different selector — fall through to networkidle
    await waitNetworkIdle(page, 3_000)
  }
}

/** Register test user + login; return access token. */
async function authenticate(): Promise<string> {
  const apiCtx = await pwRequest.newContext({ baseURL: API_URL })

  const reg = await apiCtx.post('/auth/register', {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  })
  if (!reg.ok() && reg.status() !== 409) {
    throw new Error(`Register failed: ${reg.status()} ${await reg.text()}`)
  }

  const login = await apiCtx.post('/auth/login', {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  })
  if (!login.ok()) {
    throw new Error(`Login failed: ${login.status()} ${await login.text()}`)
  }
  const loginBody = await login.json() as { data: { accessToken: string } }
  await apiCtx.dispose()
  return loginBody.data.accessToken
}

/** Ensure storageState exists; create a real browser session if not. */
async function ensureAuthState(browser: Browser): Promise<BrowserContext> {
  let ctx: BrowserContext

  if (fs.existsSync(AUTH_STATE_PATH)) {
    log('Reusing existing auth state from e2e/.auth/state.json')
    ctx = await browser.newContext({ storageState: AUTH_STATE_PATH, baseURL: BASE_URL })
  } else {
    log('Auth state not found — authenticating from scratch...')
    ctx = await browser.newContext({ baseURL: BASE_URL })
    const page = await ctx.newPage()
    await page.goto('/')
    await page.getByLabel('Email').waitFor({ timeout: 15_000 })
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByLabel('Password').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 20_000 })
    await ctx.storageState({ path: AUTH_STATE_PATH })
    log('Auth state saved')
    await page.close()
  }

  // [R4] Disable CSS transitions and animations in ALL frames (including GrapesJS iframe)
  // so that we never capture a panel mid-open or a widget mid-fade-in.
  await ctx.addInitScript(() => {
    const inject = () => {
      if (document.getElementById('__no-anim__')) return
      const style = document.createElement('style')
      style.id = '__no-anim__'
      style.textContent =
        '*, *::before, *::after { ' +
        'transition: none !important; ' +
        'animation: none !important; ' +
        'animation-duration: 0ms !important; ' +
        'animation-delay: 0ms !important; ' +
        '}'
      document.head?.appendChild(style)
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject)
    } else {
      inject()
    }
  })

  return ctx
}

/** Create (or reuse) a "Docs Screenshots" course with pre-loaded slides. */
async function ensureDocsCourse(accessToken: string): Promise<string> {
  const apiCtx = await pwRequest.newContext({ baseURL: API_URL })
  const headers = { Authorization: `Bearer ${accessToken}` }

  const listRes  = await apiCtx.get('/courses', { headers })
  const listBody = await listRes.json() as { data: Array<{ _id: string; title: string }> }
  const existing = listBody.data.find(c => c.title === 'Docs Screenshots')
  if (existing) {
    log(`Reusing existing course: ${existing._id}`)
    await apiCtx.dispose()
    return existing._id
  }

  const createRes  = await apiCtx.post('/courses', { data: { title: 'Docs Screenshots' }, headers })
  if (!createRes.ok()) throw new Error(`Create course failed: ${await createRes.text()}`)
  const createBody = await createRes.json() as { data: { _id: string } }
  const courseId   = createBody.data._id
  log(`Created docs course: ${courseId}`)

  for (const title of ['Slide 2', 'Slide 3']) {
    const r = await apiCtx.post(`/courses/${courseId}/slides`, { data: { title }, headers })
    if (!r.ok()) warn(`Add slide "${title}" failed: ${await r.text()}`)
  }

  await apiCtx.dispose()
  return courseId
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // [R5] Clean + recreate screenshots folder
  cleanScreenshotsDir()

  const browser = await chromium.launch({ headless: true })
  let captured = 0
  let skipped  = 0

  try {
    const accessToken = await authenticate()
    const courseId    = await ensureDocsCourse(accessToken)
    const ctx         = await ensureAuthState(browser)
    const page        = await ctx.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })

    // ── 01: Dashboard / Course list ───────────────────────────────────────────
    log('Navigating to dashboard...')
    await page.goto('/')
    try {
      // Try the course-list view first
      await page.waitForSelector(
        '[data-testid="course-list"], [data-testid="course-item"], .course-card',
        { timeout: 8_000 },
      )
    } catch {
      // App opens directly in editor — wait for the editor toolbar
      await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 25_000 })
    }
    await waitNetworkIdle(page)
    if (await screenshot(page, '01-dashboard.png', 'Dashboard / Course list')) captured++

    // ── 02: New course dialog ─────────────────────────────────────────────────
    try {
      const newCourseBtn = page.locator('[title="New course"]')
      await newCourseBtn.waitFor({ timeout: 5_000 })
      await newCourseBtn.click()
      // Wait for the dialog to be fully visible (no animation blur thanks to R4)
      await page.locator('[role="dialog"], .modal, [data-testid="new-course-dialog"]')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '02-new-course-dialog.png', 'New course dialog')) captured++
      await page.keyboard.press('Escape')
      await page.locator('[role="dialog"]').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
    } catch (err) {
      warn(`02-new-course-dialog: ${err}`)
      skipped++
    }

    // ── Navigate to the docs course editor ────────────────────────────────────
    log(`Opening docs course editor: ${courseId}`)
    await page.goto(`/?courseId=${courseId}`)
    await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 30_000 })

    // [R1] Wait for the GrapesJS iframe to load its content before proceeding
    await page.locator('iframe.gjs-frame').waitFor({ state: 'attached', timeout: 20_000 })
    await waitForGjsIframeContent(page)
    await waitNetworkIdle(page)

    // ── 03: Editor — empty slide ──────────────────────────────────────────────
    if (await screenshot(page, '03-editor-empty.png', 'GrapesJS editor — empty slide')) captured++

    // ── 04: Block Manager panel ───────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      // Wait for the block list to render; at least one block item must be visible
      await page.locator('.gjs-block').first().waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '04-block-manager.png', 'Block Manager panel open')) captured++
    } catch (err) {
      warn(`04-block-manager: ${err}`)
      skipped++
    }

    // ── 05: Editor with a Text widget ─────────────────────────────────────────
    try {
      const gjsFrame   = page.frameLocator('iframe.gjs-frame')
      const gjsBody    = gjsFrame.locator('body')
      const textBlock  = page.locator('.gjs-block').filter({ hasText: /^Text$/i }).first()

      if (await textBlock.count() > 0) {
        await textBlock.dragTo(gjsBody, { targetPosition: { x: 200, y: 200 } })
        // [R3] Confirm the widget landed in the canvas
        await waitForWidgetInCanvas(page, '[data-gjs-type="text"], p, [contenteditable]')
      }
      await waitNetworkIdle(page, 4_000)
      if (await screenshot(page, '05-editor-widgets.png', 'Editor with Text widget')) captured++
    } catch (err) {
      warn(`05-editor-widgets: ${err}`)
      if (await screenshot(page, '05-editor-widgets.png', 'Editor (fallback)')) captured++
    }

    // ── 06: Layer Manager ─────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Layers', exact: true }).click()
      await page.locator('.gjs-layer, [data-gjs-layer]').first().waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '06-layer-manager.png', 'Layer Manager panel')) captured++
    } catch (err) {
      warn(`06-layer-manager: ${err}`)
      skipped++
    }

    // ── 07: Style Manager / Properties ───────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Styles', exact: true }).click()
      // Wait for at least one style property to appear
      await page.locator('.gjs-sm-sector, .gjs-field, [data-gjs-style]').first()
        .waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '07-properties-panel.png', 'Style Manager panel')) captured++
    } catch (err) {
      warn(`07-properties-panel: ${err}`)
      skipped++
    }

    // ── 08: Multiple Choice question widget ───────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.locator('.gjs-block').first().waitFor({ state: 'visible', timeout: 6_000 })

      const mcBlock = page.locator('.gjs-block').filter({ hasText: /Multiple.?Choice/i }).first()
      if (await mcBlock.count() > 0) {
        const gjsFrame = page.frameLocator('iframe.gjs-frame')
        await mcBlock.dragTo(gjsFrame.locator('body'), { targetPosition: { x: 300, y: 300 } })
        // [R3] Wait for the MC question widget to appear in the canvas
        await waitForWidgetInCanvas(page, '[data-widget="question-mc"], .question-mc, .question-widget')
        await waitNetworkIdle(page, 4_000)
      }
      if (await screenshot(page, '08-question-mc-authoring.png', 'Multiple Choice widget authoring')) captured++
    } catch (err) {
      warn(`08-question-mc-authoring: ${err}`)
      if (await screenshot(page, '08-question-mc-authoring.png', 'Editor (fallback)')) captured++
    }

    // ── 09: Question Extended Properties ─────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      // Wait for the properties panel to populate
      await page.locator('[data-testid="question-props-panel"], .question-props, .extended-props')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => {
          // Acceptable — panel may not exist if no widget is selected; capture as-is
        })
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '09-question-properties.png', 'Question Extended Properties panel')) captured++
    } catch (err) {
      warn(`09-question-properties: ${err}`)
      skipped++
    }

    // ── 10: Actions Editor ────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Actions', exact: true }).click()
      // Wait for the actions editor root container
      await page.locator('[data-testid="actions-editor"], .actions-editor, [class*="actions"]')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => {})
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '10-actions-editor.png', 'Actions Editor panel')) captured++
    } catch (err) {
      warn(`10-actions-editor: ${err}`)
      skipped++
    }

    // ── 11: Actions Editor — event row / condition view ───────────────────────
    try {
      const addEventBtn = page
        .locator('[data-testid="add-event-btn"], button')
        .filter({ hasText: /Add Event/i })
        .first()
      if (await addEventBtn.count() > 0) {
        await addEventBtn.click()
        // Wait for the event row to appear
        await page.locator('[data-testid="event-row"], .event-row, .action-event')
          .first()
          .waitFor({ state: 'visible', timeout: 6_000 })
          .catch(() => {})
      }
      if (await screenshot(page, '11-actions-condition.png', 'Actions Editor — event/condition')) captured++
    } catch (err) {
      warn(`11-actions-condition: ${err}`)
      if (await screenshot(page, '11-actions-condition.png', 'Actions Editor (fallback)')) captured++
    }

    // ── 12: Simulation Recorder ───────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.locator('.gjs-block').first().waitFor({ state: 'visible', timeout: 6_000 })

      const simBlock = page.locator('.gjs-block')
        .filter({ hasText: /Software.?Walkthrough|Screenshot.?Sim|Simulation/i })
        .first()
      if (await simBlock.count() > 0) {
        const gjsFrame = page.frameLocator('iframe.gjs-frame')
        await simBlock.dragTo(gjsFrame.locator('body'), { targetPosition: { x: 150, y: 400 } })
        // [R3] Confirm screenshot-sim widget injected
        await waitForWidgetInCanvas(page, '[data-widget="screenshot-sim"], .screenshot-sim-widget')
        await waitNetworkIdle(page, 4_000)
      }
      if (await screenshot(page, '12-sim-recorder.png', 'Simulation Recorder widget')) captured++
    } catch (err) {
      warn(`12-sim-recorder: ${err}`)
      if (await screenshot(page, '12-sim-recorder.png', 'Editor (fallback)')) captured++
    }

    // ── 13: Simulation Editor (hotspot drawing) ───────────────────────────────
    try {
      const gjsFrame = page.frameLocator('iframe.gjs-frame')
      const simPlaceholder = gjsFrame
        .locator('[data-widget="screenshot-sim"], div:has-text("Double-click to edit")')
        .first()
      if (await simPlaceholder.count() > 0) {
        await simPlaceholder.dblclick({ timeout: 8_000 })
        // Wait for the simulation editor overlay/modal to open
        await page.locator('[data-testid="sim-editor"], .sim-editor-panel, canvas')
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {})
        await waitNetworkIdle(page, 3_000)
      }
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Simulation Editor hotspot view')) captured++

      // Close the simulation editor if it opened
      const closeBtn = page
        .locator('[data-testid="sim-editor-close"], button[title="Close"], [aria-label="Close"]')
        .first()
      if (await closeBtn.count() > 0) {
        await closeBtn.click()
        await page.locator('[data-testid="sim-editor"]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
      }
    } catch (err) {
      warn(`13-sim-editor-hotspot: ${err}`)
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Editor (fallback)')) captured++
    }

    // ── 14: Preview (Runtime Player) ──────────────────────────────────────────
    try {
      const previewBtn = page
        .locator('button[title="Preview"], button')
        .filter({ hasText: /Preview/i })
        .first()
      if (await previewBtn.count() > 0) {
        await previewBtn.click()
        // Wait for the preview iframe/overlay to appear
        await page.locator('[data-testid="preview-player"], iframe[title*="preview" i], .preview-overlay')
          .first()
          .waitFor({ state: 'visible', timeout: 12_000 })
          .catch(() => {})
        await waitNetworkIdle(page, 4_000)
        if (await screenshot(page, '14-sim-player-practice.png', 'Runtime Player — Practice mode')) captured++
        await page.keyboard.press('Escape')
        await page.locator('[data-testid="preview-player"], .preview-overlay')
          .first()
          .waitFor({ state: 'hidden', timeout: 5_000 })
          .catch(() => {})
      } else {
        warn('14-sim-player-practice: no Preview button found')
        if (await screenshot(page, '14-sim-player-practice.png', 'Editor (fallback)')) captured++
      }
    } catch (err) {
      warn(`14-sim-player-practice: ${err}`)
      if (await screenshot(page, '14-sim-player-practice.png', 'Editor (fallback)')) captured++
    }

    // ── 15: Phaser Process Flow simulation ────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.locator('.gjs-block').first().waitFor({ state: 'visible', timeout: 6_000 })

      const phaserBlock = page.locator('.gjs-block')
        .filter({ hasText: /Interactive.?Scenario|Phaser.?Sim/i })
        .first()
      if (await phaserBlock.count() > 0) {
        const gjsFrame = page.frameLocator('iframe.gjs-frame')
        await phaserBlock.dragTo(gjsFrame.locator('body'), { targetPosition: { x: 500, y: 200 } })
        // [R3] Confirm Phaser widget injected
        await waitForWidgetInCanvas(page, '[data-widget="phaser-sim"], .phaser-sim-widget')
        await waitNetworkIdle(page, 5_000)
      }
      if (await screenshot(page, '15-phaser-processflow.png', 'Phaser Process Flow simulation authoring')) captured++
    } catch (err) {
      warn(`15-phaser-processflow: ${err}`)
      if (await screenshot(page, '15-phaser-processflow.png', 'Editor (fallback)')) captured++
    }

    // ── 16: Phaser sim — Properties panel ────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      // Wait for the extended-properties panel; Phaser props include a simType selector
      await page.locator('[data-testid="phaser-props-panel"], [data-testid="extended-props"], select')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => {})
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '16-phaser-diagram.png', 'Phaser sim Properties panel')) captured++
    } catch (err) {
      warn(`16-phaser-diagram: ${err}`)
      skipped++
    }

    // ── 17: SCORM Export dialog ───────────────────────────────────────────────
    try {
      const publishBtn = page.getByRole('button', { name: /Publish SCORM/i })
      await publishBtn.click()
      // Wait for the modal to appear fully
      await page.locator('[role="dialog"], .modal, [data-testid="export-dialog"]')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '17-scorm-export.png', 'SCORM Export dialog')) captured++
      await page.keyboard.press('Escape')
      await page.locator('[role="dialog"]').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
    } catch (err) {
      warn(`17-scorm-export: ${err}`)
      skipped++
    }

    // ── 18: Moodle — SKIP (service DOWN in dev) ───────────────────────────────
    warn('18-moodle-course: Moodle service not running — skipped')
    skipped++

    // ── 19: Grafana dashboard ─────────────────────────────────────────────────
    try {
      const grafanaPage = await ctx.newPage()
      await grafanaPage.setViewportSize({ width: 1440, height: 900 })
      await grafanaPage.goto(`${GRAFANA_URL}/login`)
      await waitNetworkIdle(grafanaPage, 6_000)

      const emailInput = grafanaPage.locator('input[name="user"], input[placeholder*="email" i], #user')
      if (await emailInput.count() > 0) {
        await emailInput.fill('admin')
        await grafanaPage.locator('input[name="password"], input[type="password"]').fill('admin')
        await grafanaPage.getByRole('button', { name: /Log in|Sign in/i }).click()
        // Wait for dashboard home to load
        await grafanaPage.waitForURL(/\/(\?|dashboard|home)/i, { timeout: 15_000 }).catch(() => {})
        await waitNetworkIdle(grafanaPage, 6_000)
      }

      await grafanaPage.goto(`${GRAFANA_URL}/dashboards`)
      await waitNetworkIdle(grafanaPage, 6_000)
      if (await screenshot(grafanaPage, '19-grafana-dashboard.png', 'Grafana dashboards overview')) captured++
      await grafanaPage.close()
    } catch (err) {
      warn(`19-grafana-dashboard: ${err}`)
      skipped++
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    await ctx.close()
  } finally {
    await browser.close()
  }

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log(' capture-screenshots complete')
  console.log(` ✓ captured : ${captured}`)
  console.log(` ⚠ skipped  : ${skipped}`)
  console.log(` directory  : ${SCREENSHOTS_DIR}`)
  console.log('═══════════════════════════════════════════')

  process.exit(skipped > 10 ? 1 : 0)
}

main().catch(err => {
  console.error('[capture] Fatal error:', err)
  process.exit(1)
})
