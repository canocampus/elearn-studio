/**
 * capture-screenshots.ts
 *
 * Standalone Playwright script (NOT a @playwright/test suite) that navigates the
 * live eLearn Studio application and captures 19 PNG screenshots to
 * docs/assets/screenshots/.
 *
 * Strategy: pre-populate slides with widget data via the REST API before opening
 * the editor. This avoids relying on GrapesJS drag-and-drop in headless Playwright,
 * which silently fails when the drop target is inside a cross-origin iframe.
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

import { chromium, Browser, BrowserContext, Page, request as pwRequest, APIRequestContext } from '@playwright/test'
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

// Canvas size (fixed 1024×768 ToolBook layout)
const CANVAS_W = 1024
const CANVAS_H = 768

// ── Widget factory helpers ─────────────────────────────────────────────────────
function textWidget(id: string, x: number, y: number, w: number, h: number, html: string) {
  return {
    id, type: 'text', layer: 1, visible: true, actions: [], extendedProperties: {},
    bounds: { x, y, width: w, height: h },
    properties: { content: html },
  }
}

function buttonWidget(id: string, x: number, y: number, label: string) {
  return {
    id, type: 'button', layer: 2, visible: true, actions: [], extendedProperties: {},
    bounds: { x, y, width: 160, height: 48 },
    properties: { label },
  }
}

function navButtonsWidget(id: string) {
  return {
    id, type: 'nav-buttons', layer: 2, visible: true, actions: [], extendedProperties: {},
    bounds: { x: 50, y: CANVAS_H - 80, width: 400, height: 48 },
    properties: {},
  }
}

function mcQuestionWidget(id: string) {
  return {
    id,
    type: 'question-mc',
    layer: 1,
    visible: true,
    actions: [],
    bounds: { x: 50, y: 60, width: CANVAS_W - 100, height: 260 },
    properties: {},
    // extendedProperties must match MCExtendedProps (registerQuestionBlocks.ts)
    // so that buildMCPreviewHTML() can render the question in the GrapesJS canvas
    extendedProperties: {
      questionText: 'Which SCORM standard provides the most comprehensive sequencing support?',
      options: [
        { id: '1', text: 'SCORM 1.2',         isCorrect: false },
        { id: '2', text: 'SCORM 2004',         isCorrect: true  },
        { id: '3', text: 'AICC',               isCorrect: false },
        { id: '4', text: 'xAPI / Tin Can',     isCorrect: false },
      ],
      feedbackCorrect:   'Correct! SCORM 2004 includes advanced sequencing and navigation rules.',
      feedbackIncorrect: 'Not quite — SCORM 2004 is the answer.',
      scoring: { weight: 100, attempts: 2 },
    },
  }
}

function screenshotSimWidget(id: string) {
  return {
    id,
    type: 'screenshot-sim',
    layer: 1,
    visible: true,
    actions: [],
    bounds: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H },
    properties: { sessionId: null, mode: 'practice', demoDelay: 2000, maxAttempts: 3 },
    extendedProperties: {},
  }
}

function phaserSimWidget(id: string) {
  return {
    id,
    type: 'phaser-sim',
    layer: 1,
    visible: true,
    actions: [],
    bounds: { x: 112, y: 134, width: 800, height: 500 },
    properties: {},
    extendedProperties: {
      simType: 'process-flow',
      mode: 'demo',
      passingScore: 70,
      sceneDef: {
        simType: 'process-flow',
        nodes: [
          { id: 'start',   x: 80,  y: 250, label: 'Ticket Created', type: 'start' },
          { id: 'triage',  x: 280, y: 250, label: 'L1 Triage',      type: 'step' },
          { id: 'resolve', x: 480, y: 250, label: 'Resolve Issue',   type: 'decision' },
          { id: 'close',   x: 680, y: 250, label: 'Close Ticket',   type: 'end' },
        ],
        edges: [
          { from: 'start',   to: 'triage' },
          { from: 'triage',  to: 'resolve', label: 'urgent' },
          { from: 'resolve', to: 'close' },
        ],
        interactionMode: 'demo',
      },
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg: string)  { console.log(`[capture] ${msg}`) }
function warn(msg: string) { console.warn(`[capture] WARN: ${msg}`) }

/** Wipe and recreate the screenshots folder before every run. */
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
 * Wait for network to go idle, then wait an extra stabilisation tick.
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
 * Wait for the GrapesJS iframe body to be visible before capturing.
 * Falls back gracefully after timeout.
 */
async function waitForGjsIframe(page: Page, timeoutMs = 20_000): Promise<void> {
  try {
    await page.locator('iframe.gjs-frame').waitFor({ state: 'attached', timeout: timeoutMs })
    await page.frameLocator('iframe.gjs-frame').locator('body').waitFor({ state: 'visible', timeout: timeoutMs })
  } catch {
    // iframe not present or too slow — proceed with whatever is rendered
  }
}

/**
 * Wait for a widget type to be visible inside the GrapesJS iframe.
 * Used to confirm pre-populated widgets rendered correctly.
 */
async function waitForWidgetInCanvas(page: Page, selector: string, timeoutMs = 10_000): Promise<void> {
  try {
    await page.frameLocator('iframe.gjs-frame').locator(selector).first()
      .waitFor({ state: 'visible', timeout: timeoutMs })
  } catch {
    // Widget selector may differ — fall back to short networkidle wait
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

  // Disable CSS transitions and animations in ALL frames (including GrapesJS iframe)
  // so panels never appear mid-open or widgets mid-fade-in.
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

interface SlideIds {
  empty:         string
  withWidgets:   string
  withQuestion:  string
  withSim:       string
  withPhaser:    string
}

/**
 * Always delete any existing "Docs Screenshots" course and create a fresh one.
 * Pre-populate slides with realistic widget data via PATCH so the editor opens
 * with content already rendered — no drag-and-drop needed.
 *
 * Returns an object mapping slide purpose to slide id.
 */
async function setupDocsCourse(accessToken: string): Promise<{ courseId: string; slides: SlideIds }> {
  const apiCtx = await pwRequest.newContext({ baseURL: API_URL })
  const headers = { Authorization: `Bearer ${accessToken}` }

  // 1. Delete any existing "Docs Screenshots" course (avoid state pollution)
  const listRes  = await apiCtx.get('/courses', { headers })
  const listBody = await listRes.json() as { data: Array<{ _id: string; title: string }> }
  for (const c of listBody.data.filter(c => c.title === 'Docs Screenshots')) {
    await apiCtx.delete(`/courses/${c._id}`, { headers })
    log(`Deleted stale course: ${c._id}`)
  }

  // 2. Create fresh course
  const createRes  = await apiCtx.post('/courses', { data: { title: 'Docs Screenshots' }, headers })
  if (!createRes.ok()) throw new Error(`Create course failed: ${await createRes.text()}`)
  const createBody = await createRes.json() as { data: { _id: string; slides: Array<{ id: string }> } }
  const courseId   = createBody.data._id
  log(`Created fresh docs course: ${courseId}`)

  // 3. Add all five slides explicitly (do not rely on a default slide from course creation)
  const slideIds: string[] = []

  for (const title of ['Empty Slide', 'Widgets Slide', 'Question Slide', 'Simulation Slide', 'Phaser Slide']) {
    const r    = await apiCtx.post(`/courses/${courseId}/slides`, { data: { title }, headers })
    if (!r.ok()) throw new Error(`Add slide "${title}" failed: ${await r.text()}`)
    const body = await r.json() as { data: { slides: Array<{ id: string }> } }
    const last  = body.data.slides.at(-1)
    if (!last?.id) throw new Error(`No slide id returned for "${title}"`)
    slideIds.push(last.id)
  }

  const [emptyId, widgetsId, questionId, simId, phaserId] = slideIds

  // 4. Patch each slide with pre-built widget data
  await patchSlide(apiCtx, courseId, widgetsId, headers, [
    textWidget('w-heading', 50, 60, CANVAS_W - 100, 80,
      '<h2 style="font-family:sans-serif;font-size:28px;font-weight:700;color:#1e293b;margin:0">Welcome to eLearn Studio</h2>'),
    textWidget('w-body', 50, 160, CANVAS_W - 100, 140,
      '<p style="font-family:sans-serif;font-size:16px;color:#334155;line-height:1.6">Build interactive courses with the visual slide editor. Drag widgets from the Blocks panel onto the canvas, configure properties in the right panel, and publish to any LMS via SCORM.</p>'),
    buttonWidget('w-btn-next', CANVAS_W - 220, CANVAS_H - 80, 'Next →'),
    navButtonsWidget('w-nav'),
  ])
  log(`Patched widgets slide: ${widgetsId}`)

  await patchSlide(apiCtx, courseId, questionId, headers, [
    mcQuestionWidget('w-mc-1'),
    navButtonsWidget('w-nav-q'),
  ])
  log(`Patched question slide: ${questionId}`)

  await patchSlide(apiCtx, courseId, simId, headers, [
    screenshotSimWidget('w-sim-1'),
  ])
  log(`Patched simulation slide: ${simId}`)

  await patchSlide(apiCtx, courseId, phaserId, headers, [
    phaserSimWidget('w-phaser-1'),
  ])
  log(`Patched phaser slide: ${phaserId}`)

  // emptyId slide is left with no widgets — used for the "empty editor" screenshot

  await apiCtx.dispose()

  return {
    courseId,
    slides: {
      empty:        emptyId,
      withWidgets:  widgetsId,
      withQuestion: questionId,
      withSim:      simId,
      withPhaser:   phaserId,
    },
  }
}

async function patchSlide(
  apiCtx: APIRequestContext,
  courseId: string,
  slideId: string,
  headers: Record<string, string>,
  widgets: object[],
): Promise<void> {
  const r = await apiCtx.patch(`/courses/${courseId}/slides/${slideId}`, {
    data: { widgets },
    headers,
  })
  if (!r.ok()) throw new Error(`PATCH slide ${slideId} failed: ${await r.text()}`)
}

/**
 * Navigate to a specific slide by clicking it in the slide list panel.
 * Switches to the "Slides" tab first (the Blocks tab may be active from a prior step).
 * Uses the slide title via aria-label (SlideItem renders aria-label="Slide N: {title}").
 * Waits for the GrapesJS iframe to reload before returning.
 */
async function navigateToSlide(page: Page, slideTitle: string): Promise<void> {
  // Ensure the Slides panel is visible (not obscured by the Blocks or Layers tab)
  try {
    const slidesTab = page.getByRole('tab', { name: 'Slides', exact: true })
    if (await slidesTab.count() > 0) {
      await slidesTab.click()
      await page.locator('[data-testid="slide-item"]').first()
        .waitFor({ state: 'visible', timeout: 8_000 })
    }
  } catch {
    // tab not found or slides already visible — continue
  }

  // SlideItem: <div data-testid="slide-item" aria-label="Slide N: {title}" ...>
  const slideBtn = page.locator(`[data-testid="slide-item"][aria-label*="${slideTitle}"]`).first()

  try {
    await slideBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await slideBtn.click()
  } catch {
    warn(`navigateToSlide: could not find slide with title "${slideTitle}"`)
  }

  // Wait for GrapesJS to reload the new slide content
  await waitForGjsIframe(page, 15_000)
  await waitNetworkIdle(page, 4_000)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Clean + recreate screenshots folder
  cleanScreenshotsDir()

  const browser = await chromium.launch({ headless: true })
  let captured = 0
  let skipped  = 0

  try {
    const accessToken = await authenticate()
    const { courseId, slides } = await setupDocsCourse(accessToken)
    const ctx  = await ensureAuthState(browser)
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })

    // ── 01: Dashboard / Course list ───────────────────────────────────────────
    log('Navigating to dashboard...')
    await page.goto('/')
    try {
      await page.waitForSelector(
        '[data-testid="course-list"], [data-testid="course-item"], .course-card',
        { timeout: 8_000 },
      )
    } catch {
      await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 25_000 })
    }
    await waitNetworkIdle(page)
    if (await screenshot(page, '01-dashboard.png', 'Dashboard / Course list')) captured++

    // ── 02: New course dialog ─────────────────────────────────────────────────
    try {
      const newCourseBtn = page.locator('[title="New course"], button').filter({ hasText: /New Course/i }).first()
      await newCourseBtn.waitFor({ timeout: 5_000 })
      await newCourseBtn.click()
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

    // ── Open the docs course — starts on first (empty) slide ──────────────────
    log(`Opening docs course editor: ${courseId}`)
    await page.goto(`/?courseId=${courseId}`)
    await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 30_000 })
    await waitForGjsIframe(page)
    await waitNetworkIdle(page)

    // ── 03: Editor — empty slide ──────────────────────────────────────────────
    // The first slide has no widgets — shows clean empty canvas
    if (await screenshot(page, '03-editor-empty.png', 'GrapesJS editor — empty slide')) captured++

    // ── 04: Block Manager panel ───────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
      await page.locator('.gjs-block').first().waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '04-block-manager.png', 'Block Manager panel open')) captured++
    } catch (err) {
      warn(`04-block-manager: ${err}`)
      skipped++
    }

    // ── Navigate to the widgets slide ─────────────────────────────────────────
    log('Navigating to widgets slide...')
    await navigateToSlide(page, 'Widgets Slide')

    // ── 05: Editor with Text + Button widgets ─────────────────────────────────
    // Wait for the heading text widget to appear in the canvas
    await waitForWidgetInCanvas(page, 'h2, [data-gjs-type="text"]')
    if (await screenshot(page, '05-editor-widgets.png', 'Editor with pre-populated widgets')) captured++

    // ── 06: Layer Manager ─────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Layers', exact: true }).click()
      await page.locator('.gjs-layer, [data-gjs-layer], [class*="layer-item"]').first()
        .waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '06-layer-manager.png', 'Layer Manager panel')) captured++
    } catch (err) {
      warn(`06-layer-manager: ${err}`)
      skipped++
    }

    // ── 07: Style Manager / Properties ────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Styles', exact: true }).click()
      await page.locator('.gjs-sm-sector, .gjs-field, [data-gjs-style], [class*="sm-sector"]').first()
        .waitFor({ state: 'visible', timeout: 8_000 })
      if (await screenshot(page, '07-properties-panel.png', 'Style Manager panel')) captured++
    } catch (err) {
      warn(`07-properties-panel: ${err}`)
      skipped++
    }

    // ── Navigate to the question slide ────────────────────────────────────────
    log('Navigating to question slide...')
    await navigateToSlide(page, 'Question Slide')

    // ── 08: Multiple Choice question widget ───────────────────────────────────
    // The MC question is pre-populated — wait for it to render
    await waitForWidgetInCanvas(page, '[data-gjs-type="question-mc"], .question-widget, [data-widget]', 12_000)
    if (await screenshot(page, '08-question-mc-authoring.png', 'Multiple Choice widget in canvas')) captured++

    // ── 09: Question Extended Properties ─────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      await page.locator('[data-testid="question-props-panel"], .question-props, .extended-props, [class*="props"]')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => {})
      await waitNetworkIdle(page, 3_000)
      if (await screenshot(page, '09-question-properties.png', 'Question Extended Properties panel')) captured++
    } catch (err) {
      warn(`09-question-properties: ${err}`)
      skipped++
    }

    // ── 10: Actions Editor ─────────────────────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Actions', exact: true }).click()
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

    // ── 11: Actions Editor — event row ────────────────────────────────────────
    try {
      const addEventBtn = page
        .locator('[data-testid="add-event-btn"], button')
        .filter({ hasText: /Add Event/i })
        .first()
      if (await addEventBtn.count() > 0) {
        await addEventBtn.click()
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

    // ── Navigate to the simulation slide ──────────────────────────────────────
    log('Navigating to simulation slide...')
    await navigateToSlide(page, 'Simulation Slide')

    // ── 12: Simulation widget in canvas ───────────────────────────────────────
    // The screenshot-sim widget is pre-populated — wait for the placeholder to render
    await waitForWidgetInCanvas(
      page,
      '[data-gjs-type="screenshot-sim"], .screenshot-sim-widget, [data-widget="screenshot-sim"], div',
      12_000,
    )
    if (await screenshot(page, '12-sim-recorder.png', 'Screenshot Simulation widget in canvas')) captured++

    // ── 13: Simulation Editor (double-click to open) ──────────────────────────
    try {
      const gjsFrame       = page.frameLocator('iframe.gjs-frame')
      const simPlaceholder = gjsFrame
        .locator('[data-gjs-type="screenshot-sim"], div:has-text("Double-click"), div:first-child')
        .first()
      if (await simPlaceholder.count() > 0) {
        await simPlaceholder.dblclick({ timeout: 8_000 })
        await page.locator('[data-testid="sim-editor"], .sim-editor-panel, canvas')
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {})
        await waitNetworkIdle(page, 3_000)
      }
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Simulation Editor hotspot view')) captured++

      // Close the sim editor — the toolbar shows "Save & Close" and "Cancel"
      const cancelBtn = page.getByRole('button', { name: 'Cancel' })
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click({ timeout: 8_000 })
      } else {
        const saveCloseBtn = page.getByRole('button', { name: /Save & Close/i })
        if (await saveCloseBtn.count() > 0) await saveCloseBtn.click({ timeout: 8_000 })
      }
      // Wait until the toolbar heading "Simulation Editor" is gone
      await page.locator('text=Simulation Editor').waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {})
      await waitNetworkIdle(page, 2_000)
    } catch (err) {
      warn(`13-sim-editor-hotspot: ${err}`)
      if (await screenshot(page, '13-sim-editor-hotspot.png', 'Sim slide (fallback)')) captured++
      // Still try to dismiss any open sim editor before continuing
      await page.getByRole('button', { name: 'Cancel' }).click({ timeout: 5_000 }).catch(() => {})
      await page.locator('text=Simulation Editor').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
    }

    // ── 14: Preview (Runtime Player) ─────────────────────────────────────────
    try {
      const previewBtn = page
        .locator('button[title="Preview"], button')
        .filter({ hasText: /Preview/i })
        .first()
      if (await previewBtn.count() > 0) {
        await previewBtn.click()
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

    // ── Navigate to the Phaser slide ──────────────────────────────────────────
    log('Navigating to Phaser slide...')
    await navigateToSlide(page, 'Phaser Slide')

    // ── 15: Phaser sim in canvas ──────────────────────────────────────────────
    await waitForWidgetInCanvas(
      page,
      '[data-gjs-type="phaser-sim"], .phaser-sim-widget, [data-widget="phaser-sim"], div',
      12_000,
    )
    if (await screenshot(page, '15-phaser-processflow.png', 'Phaser Process Flow simulation in canvas')) captured++

    // ── 16: Phaser sim Properties panel ──────────────────────────────────────
    try {
      await page.getByRole('tab', { name: 'Props', exact: true }).click()
      await page.locator('[data-testid="phaser-props-panel"], [data-testid="extended-props"], select, [class*="props"]')
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

    // ── 18: Moodle — SKIP (service not running in dev) ────────────────────────
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
