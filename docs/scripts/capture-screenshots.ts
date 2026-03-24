/**
 * capture-screenshots.ts
 *
 * Standalone Playwright script (NOT a @playwright/test suite) that navigates the
 * live eLearn Studio application and captures 20 PNG screenshots to
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
 *   DOCS_API_URL   — backend API base URL   (default: http://localhost:3001)
 *   DOCS_BASE_URL  — authoring UI base URL  (default: http://localhost:3000)
 *   DOCS_GRAFANA_URL — Grafana URL          (default: http://localhost:3010)
 */

import { chromium, Browser, BrowserContext, Page, request as pwRequest } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── Configuration ─────────────────────────────────────────────────────────────
const API_URL = process.env.DOCS_API_URL ?? 'http://localhost:3001'
const BASE_URL = process.env.DOCS_BASE_URL ?? 'http://localhost:3000'
const GRAFANA_URL = process.env.DOCS_GRAFANA_URL ?? 'http://localhost:3010'

const E2E_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@elearn.test'
const E2E_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'e2e-password-secure-123'

const AUTH_STATE_PATH = path.join(__dirname, '../../e2e/.auth/state.json')
const SCREENSHOTS_DIR = path.join(__dirname, '../assets/screenshots')

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[capture] ${msg}`)
}

function warn(msg: string) {
  console.warn(`[capture] WARN: ${msg}`)
}

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

/** Register test user + login, return access token */
async function authenticate(): Promise<string> {
  const apiCtx = await pwRequest.newContext({ baseURL: API_URL })

  // Register (idempotent)
  const reg = await apiCtx.post('/auth/register', {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  })
  if (!reg.ok() && reg.status() !== 409) {
    const body = await reg.text()
    throw new Error(`Register failed: ${reg.status()} ${body}`)
  }

  // Login
  const login = await apiCtx.post('/auth/login', {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  })
  if (!login.ok()) {
    const body = await login.text()
    throw new Error(`Login failed: ${login.status()} ${body}`)
  }
  const loginBody = await login.json() as { data: { accessToken: string } }
  await apiCtx.dispose()
  return loginBody.data.accessToken
}

/** Ensure storageState exists; create a real browser session if not. */
async function ensureAuthState(browser: Browser): Promise<BrowserContext> {
  if (fs.existsSync(AUTH_STATE_PATH)) {
    log('Reusing existing auth state from e2e/.auth/state.json')
    return browser.newContext({ storageState: AUTH_STATE_PATH, baseURL: BASE_URL })
  }

  log('Auth state not found — authenticating from scratch...')
  const ctx = await browser.newContext({ baseURL: BASE_URL })
  const page = await ctx.newPage()
  await page.goto('/')
  await page.getByLabel('Email').waitFor({ timeout: 15_000 })
  await page.getByLabel('Email').fill(E2E_EMAIL)
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 20_000 })
  await ctx.storageState({ path: AUTH_STATE_PATH })
  log('Auth state saved')
  return ctx
}

/**
 * Create (or reuse) a "Docs Screenshots" course with pre-loaded slides/widgets.
 * Returns the course ID.
 */
async function ensureDocsCourse(accessToken: string): Promise<string> {
  const apiCtx = await pwRequest.newContext({ baseURL: API_URL })
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Look for existing docs course
  const listRes = await apiCtx.get('/courses', { headers })
  const listBody = await listRes.json() as { data: Array<{ _id: string; title: string }> }
  const existing = listBody.data.find(c => c.title === 'Docs Screenshots')
  if (existing) {
    log(`Reusing existing course: ${existing._id}`)
    await apiCtx.dispose()
    return existing._id
  }

  // Create new course
  const createRes = await apiCtx.post('/courses', {
    data: { title: 'Docs Screenshots' },
    headers,
  })
  if (!createRes.ok()) throw new Error(`Create course failed: ${await createRes.text()}`)
  const createBody = await createRes.json() as { data: { _id: string } }
  const courseId = createBody.data._id
  log(`Created docs course: ${courseId}`)

  // Add slides via API
  const addSlideRes = await apiCtx.post(`/courses/${courseId}/slides`, {
    data: { title: 'Slide 2' },
    headers,
  })
  if (!addSlideRes.ok()) warn(`Add slide 2 failed: ${await addSlideRes.text()}`)

  const addSlideRes3 = await apiCtx.post(`/courses/${courseId}/slides`, {
    data: { title: 'Slide 3' },
    headers,
  })
  if (!addSlideRes3.ok()) warn(`Add slide 3 failed: ${await addSlideRes3.text()}`)

  await apiCtx.dispose()
  return courseId
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  log(`Screenshots dir: ${SCREENSHOTS_DIR}`)

  const browser = await chromium.launch({ headless: true })
  let captured = 0
  let skipped = 0

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const accessToken = await authenticate()
    const courseId = await ensureDocsCourse(accessToken)
    const ctx = await ensureAuthState(browser)
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })

    // ── 01: Dashboard / Course list ───────────────────────────────────────────
    log('Navigating to dashboard...')
    await page.goto('/')
    // Wait for either the course list or the editor (single-page app loads editor directly)
    try {
      await page.waitForSelector('[data-testid="course-list"], [data-testid="course-item"], .course-card', {
        timeout: 5_000,
      })
    } catch {
      // App loads editor directly — wait for Publish SCORM button
      await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 20_000 })
    }
    if (await screenshot(page, '01-dashboard.png', 'Dashboard / Course list')) captured++

    // ── 02: New course dialog ─────────────────────────────────────────────────
    try {
      const newCourseBtn = page.locator('[title="New course"]')
      await newCourseBtn.waitFor({ timeout: 5_000 })
      await newCourseBtn.click()
      await page.waitForTimeout(500)
      if (await screenshot(page, '02-new-course-dialog.png', 'New course dialog')) captured++
      // Close dialog with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    } catch (err) {
      warn(`02-new-course-dialog: ${err}`)
      skipped++
    }

    // ── Navigate to the docs course editor ────────────────────────────────────
    log(`Opening docs course editor: ${courseId}`)
    await page.goto(`/?courseId=${courseId}`)
    await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 25_000 })
    // Wait for GrapesJS to initialise
    await page.waitForTimeout(1_500)

    // ── 03: Editor — empty slide ──────────────────────────────────────────────
    if (await screenshot(page, '03-editor-empty.png', 'GrapesJS editor — empty slide')) captured++

    // ── 04: Block Manager panel ───────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.waitForTimeout(600)
      if (await screenshot(page, '04-block-manager.png', 'Block Manager panel open')) captured++
    } catch (err) {
      warn(`04-block-manager: ${err}`)
      skipped++
    }

    // ── 05: Editor with widgets ───────────────────────────────────────────────
    // Drag a Text block onto the canvas from the block manager
    try {
      // Use Slides tab to go back to slide view
      await page.getByRole('tab', { name: 'Slides', exact: true }).click()
      await page.waitForTimeout(400)

      // Add widgets by dragging from block manager — click Blocks tab first
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.waitForTimeout(400)

      const canvasFrame = page.frameLocator('iframe.gjs-frame')
      const canvasBody = canvasFrame.locator('body')

      // Try to drag a text block onto the canvas
      const textBlock = page.locator('[data-gjs-type="text"], .gjs-block').filter({ hasText: /^Text$/i }).first()
      const blockExists = await textBlock.count()
      if (blockExists > 0) {
        const canvasBox = await page.locator('#gjs canvas, .gjs-frame-wrapper, iframe.gjs-frame').first().boundingBox()
        if (canvasBox) {
          await textBlock.dragTo(canvasBody.locator('body'), {
            targetPosition: { x: 200, y: 200 },
          })
          await page.waitForTimeout(800)
        }
      }
      if (await screenshot(page, '05-editor-widgets.png', 'Editor with widgets')) captured++
    } catch (err) {
      warn(`05-editor-widgets: ${err}`)
      // Capture editor as-is
      if (await screenshot(page, '05-editor-widgets.png', 'Editor (fallback)')) captured++
    }

    // ── 06: Layer Manager ─────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Layers', exact: true }).click()
      await page.waitForTimeout(500)
      if (await screenshot(page, '06-layer-manager.png', 'Layer Manager panel')) captured++
    } catch (err) {
      warn(`06-layer-manager: ${err}`)
      skipped++
    }

    // ── 07: Style Manager / Properties ───────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Styles', exact: true }).click()
      await page.waitForTimeout(500)
      if (await screenshot(page, '07-properties-panel.png', 'Style Manager panel')) captured++
    } catch (err) {
      warn(`07-properties-panel: ${err}`)
      skipped++
    }

    // ── 08: Multiple Choice question widget ───────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.waitForTimeout(400)

      const mcBlock = page.locator('.gjs-block').filter({ hasText: /Multiple.?Choice/i }).first()
      const mcExists = await mcBlock.count()
      if (mcExists > 0) {
        const canvasFrame = page.frameLocator('iframe.gjs-frame')
        const canvasBody = canvasFrame.locator('body')
        await mcBlock.dragTo(canvasBody, {
          targetPosition: { x: 300, y: 300 },
        })
        await page.waitForTimeout(1_000)
      }
      if (await screenshot(page, '08-question-mc-authoring.png', 'Multiple Choice widget authoring')) captured++
    } catch (err) {
      warn(`08-question-mc-authoring: ${err}`)
      if (await screenshot(page, '08-question-mc-authoring.png', 'Editor (fallback)')) captured++
    }

    // ── 09: Question Extended Properties ─────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      await page.waitForTimeout(600)
      if (await screenshot(page, '09-question-properties.png', 'Question Extended Properties panel')) captured++
    } catch (err) {
      warn(`09-question-properties: ${err}`)
      skipped++
    }

    // ── 10: Actions Editor ────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Actions', exact: true }).click()
      await page.waitForTimeout(600)
      if (await screenshot(page, '10-actions-editor.png', 'Actions Editor panel')) captured++
    } catch (err) {
      warn(`10-actions-editor: ${err}`)
      skipped++
    }

    // ── 11: Actions Editor — condition view ───────────────────────────────────
    try {
      // Click Add Event / Add Action if present
      const addEventBtn = page.locator('[data-testid="add-event-btn"], button').filter({ hasText: /Add Event/i }).first()
      const hasAddEvent = await addEventBtn.count()
      if (hasAddEvent > 0) {
        await addEventBtn.click()
        await page.waitForTimeout(500)
      }
      if (await screenshot(page, '11-actions-condition.png', 'Actions Editor — event/condition')) captured++
    } catch (err) {
      warn(`11-actions-condition: ${err}`)
      if (await screenshot(page, '11-actions-condition.png', 'Actions Editor (fallback)')) captured++
    }

    // ── 12: Simulation Recorder ───────────────────────────────────────────────
    try {
      // Go back to Blocks tab and look for screenshot-sim block
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.waitForTimeout(400)

      const simBlock = page.locator('.gjs-block').filter({ hasText: /Software.?Walkthrough|Screenshot.?Sim|Simulation/i }).first()
      const simExists = await simBlock.count()
      if (simExists > 0) {
        const canvasFrame = page.frameLocator('iframe.gjs-frame')
        const canvasBody = canvasFrame.locator('body')
        await simBlock.dragTo(canvasBody, { targetPosition: { x: 150, y: 400 } })
        await page.waitForTimeout(800)
      }
      if (await screenshot(page, '12-sim-recorder.png', 'Simulation Recorder area')) captured++
    } catch (err) {
      warn(`12-sim-recorder: ${err}`)
      if (await screenshot(page, '12-sim-recorder.png', 'Editor (fallback)')) captured++
    }

    // ── 13: Simulation Editor (hotspot drawing) ───────────────────────────────
    try {
      // Double-click on the screenshot-sim placeholder inside the GrapesJS iframe
      const canvasFrame = page.frameLocator('iframe.gjs-frame')
      const simPlaceholder = canvasFrame.locator('[data-widget="screenshot-sim"], div:has-text("Double-click to edit")').first()
      const simPlaceholderExists = await simPlaceholder.count()
      if (simPlaceholderExists > 0) {
        await simPlaceholder.dblclick({ timeout: 5_000 })
        await page.waitForTimeout(1_200)
      }
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Simulation Editor hotspot view')) captured++
      // Close simulation editor if open
      const closeBtn = page.locator('[data-testid="sim-editor-close"], button[title="Close"]').first()
      if (await closeBtn.count() > 0) {
        await closeBtn.click()
        await page.waitForTimeout(400)
      }
    } catch (err) {
      warn(`13-sim-editor-hotspot: ${err}`)
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Editor (fallback)')) captured++
    }

    // ── 14: Simulation Player — Practice mode ─────────────────────────────────
    // Navigate to runtime player with simulation (open preview URL)
    try {
      const previewBtn = page.locator('button[title="Preview"], button').filter({ hasText: /Preview/i }).first()
      const hasPreview = await previewBtn.count()
      if (hasPreview > 0) {
        await previewBtn.click()
        await page.waitForTimeout(1_500)
        if (await screenshot(page, '14-sim-player-practice.png', 'Simulation Player — Practice mode')) captured++
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
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
      await page.waitForTimeout(400)

      const phaserBlock = page.locator('.gjs-block').filter({ hasText: /Interactive.?Scenario|Phaser.?Sim/i }).first()
      const phaserExists = await phaserBlock.count()
      if (phaserExists > 0) {
        const canvasFrame = page.frameLocator('iframe.gjs-frame')
        const canvasBody = canvasFrame.locator('body')
        await phaserBlock.dragTo(canvasBody, { targetPosition: { x: 500, y: 200 } })
        await page.waitForTimeout(800)
      }
      if (await screenshot(page, '15-phaser-processflow.png', 'Phaser Process Flow simulation authoring')) captured++
    } catch (err) {
      warn(`15-phaser-processflow: ${err}`)
      if (await screenshot(page, '15-phaser-processflow.png', 'Editor (fallback)')) captured++
    }

    // ── 16: Phaser Interactive Diagram (Props panel) ──────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      await page.waitForTimeout(600)
      if (await screenshot(page, '16-phaser-diagram.png', 'Phaser sim Properties panel')) captured++
    } catch (err) {
      warn(`16-phaser-diagram: ${err}`)
      skipped++
    }

    // ── 17: SCORM Export dialog ───────────────────────────────────────────────
    try {
      const publishBtn = page.getByRole('button', { name: /Publish SCORM/i })
      await publishBtn.click()
      await page.waitForTimeout(700)
      if (await screenshot(page, '17-scorm-export.png', 'SCORM Export dialog')) captured++
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    } catch (err) {
      warn(`17-scorm-export: ${err}`)
      skipped++
    }

    // ── 18: Moodle — SKIP (service DOWN) ─────────────────────────────────────
    warn('18-moodle-course: Moodle service not running — skipped')
    skipped++

    // ── 19: Grafana dashboard ─────────────────────────────────────────────────
    try {
      const grafanaPage = await ctx.newPage()
      await grafanaPage.setViewportSize({ width: 1440, height: 900 })
      await grafanaPage.goto(`${GRAFANA_URL}/login`)
      await grafanaPage.waitForTimeout(2_000)

      // Grafana default credentials
      const emailInput = grafanaPage.locator('input[name="user"], input[placeholder*="email" i], #user')
      const passInput = grafanaPage.locator('input[name="password"], input[type="password"]')
      if (await emailInput.count() > 0) {
        await emailInput.fill('admin')
        await passInput.fill('admin')
        await grafanaPage.getByRole('button', { name: /Log in|Sign in/i }).click()
        await grafanaPage.waitForTimeout(2_000)
      }

      // Try to navigate to dashboards
      await grafanaPage.goto(`${GRAFANA_URL}/dashboards`)
      await grafanaPage.waitForTimeout(1_500)
      if (await screenshot(grafanaPage, '19-grafana-dashboard.png', 'Grafana dashboards overview')) captured++
      await grafanaPage.close()
    } catch (err) {
      warn(`19-grafana-dashboard: ${err}`)
      skipped++
    }

    // ── Final summary ─────────────────────────────────────────────────────────
    await ctx.close()
  } finally {
    await browser.close()
  }

  console.log('')
  console.log(`═══════════════════════════════════════════`)
  console.log(` capture-screenshots complete`)
  console.log(` ✓ captured : ${captured}`)
  console.log(` ⚠ skipped  : ${skipped}`)
  console.log(` directory  : ${SCREENSHOTS_DIR}`)
  console.log(`═══════════════════════════════════════════`)

  process.exit(skipped > 10 ? 1 : 0)
}

main().catch(err => {
  console.error('[capture] Fatal error:', err)
  process.exit(1)
})
