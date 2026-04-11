import { chromium, request } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * global-setup — runs once before all tests.
 *
 * 1. Creates a test user via POST /auth/register (only works when NODE_ENV=test)
 * 2. Logs in to obtain a refresh cookie
 * 3. Injects the refresh cookie into a browser context (avoids UI login flow)
 * 4. Saves the browser auth state (cookies) to .auth/state.json for reuse
 *
 * T642.2: Seed course creation removed — each test creates its own isolated
 * course via the `editorPage` fixture (fixtures/auth.ts) and deletes it in
 * teardown. This eliminates the shared-state root cause of FLAKE-03.
 *
 * E2E_API_URL  — backend API URL  (default: http://localhost:3001)
 * E2E_BASE_URL — authoring-ui URL (default: http://localhost:3000)
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export const E2E_USER_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@elearn.test'
export const E2E_USER_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'e2e-password-secure-123'

export default async function globalSetup() {
  // Ensure auth state directory exists
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // ── 1. Register test user (idempotent — 409 means already exists) ──────────
  const apiCtx = await request.newContext({ baseURL: API_URL })
  const registerRes = await apiCtx.post('/auth/register', {
    data: { email: E2E_USER_EMAIL, password: E2E_USER_PASSWORD },
  })
  if (!registerRes.ok() && registerRes.status() !== 409) {
    const body = await registerRes.text()
    throw new Error(`Failed to register test user: ${registerRes.status()} ${body}`)
  }

  // ── 2. Login to get refresh token cookie ───────────────────────────────────
  const loginRes = await apiCtx.post('/auth/login', {
    data: { email: E2E_USER_EMAIL, password: E2E_USER_PASSWORD },
  })
  if (!loginRes.ok()) {
    const body = await loginRes.text()
    throw new Error(`Failed to login test user: ${loginRes.status()} ${body}`)
  }
  // Access token obtained from login is not used in global-setup after T642.2
  // (seed course creation removed). The refresh cookie is what matters here — it's
  // injected into the browser context so tests start authenticated.
  await loginRes.json()

  // ── 3. Inject refresh cookie into browser context ──────────────────────────
  //
  // Problem: in CI the app is served via `vite preview` (no dev-server proxy),
  // so React fetches `http://localhost:3001/auth/refresh` cross-origin. If that
  // fetch hangs — e.g. due to Chromium resolving `localhost` to ::1 while the
  // server only bound IPv4, or a brief startup race — the app stays in
  // 'initialising' forever and the login form never renders, causing the old
  // `getByLabel('Email').waitFor({ timeout: 15_000 })` to time out.
  //
  // Fix: get the httpOnly refresh cookie from the API request context (already
  // obtained in step 2) and inject it into the browser context BEFORE navigation.
  // With the cookie present the app calls /auth/refresh, gets 200, and loads the
  // editor directly — no login form needed, no UI auth race.
  //
  // Fallback: if the cookie injection somehow fails (e.g. cross-origin cookie
  // policy blocks it), the login form will appear instead. We detect this and
  // complete the UI login flow before saving storageState.
  const apiState = await apiCtx.storageState()
  await apiCtx.dispose()

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL: BASE_URL })

  // Normalise cookie domain to bare 'localhost' (no port).
  // HTTP cookies are port-agnostic; the browser will send the cookie to both
  // localhost:3000 (UI) and localhost:3001 (API) so /auth/refresh succeeds.
  // SameSite=Strict is satisfied: localhost:3000 → localhost:3001 is same-site.
  if (apiState.cookies.length > 0) {
    await context.addCookies(
      apiState.cookies.map(cookie => ({ ...cookie, domain: 'localhost' }))
    )
  }

  const page = await context.newPage()

  // ── Diagnostics: capture JS errors and failed network requests ─────────────
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  page.on('pageerror', (err) => {
    pageErrors.push(`[JS Error] ${err.message}\n${err.stack ?? ''}`)
  })
  page.on('requestfailed', (req) => {
    failedRequests.push(`[Request Failed] ${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`)
    }
  })

  await page.goto('/')

  // Wait for EITHER the editor (cookie worked → session restored instantly) OR
  // the login form (cookie injection was blocked → fall back to UI login).
  // Using Playwright's .or() locator avoids Promise.race unhandled-rejection issues.
  const publishButton = page.getByRole('button', { name: /Publish SCORM/i })
  const emailInput = page.getByLabel('Email')
  const firstVisible = publishButton.or(emailInput).first()

  try {
    await firstVisible.waitFor({ timeout: 45_000 })
  } catch (err) {
    // Neither editor nor login form appeared — capture diagnostics and fail.
    await page.screenshot({ path: 'e2e-setup-failure.png', fullPage: true })
    const url = page.url()
    const html = await page.content()
    console.error('[globalSetup] Timed out (45 s) waiting for editor or login form.')
    console.error('[globalSetup] URL:', url)
    console.error('[globalSetup] HTML snippet:', html.slice(0, 2000))
    if (pageErrors.length > 0) {
      console.error('[globalSetup] JS errors captured:')
      pageErrors.forEach(e => console.error(' ', e))
    } else {
      console.error('[globalSetup] No JS errors captured (pageerror events).')
    }
    if (failedRequests.length > 0) {
      console.error('[globalSetup] Failed/error requests:')
      failedRequests.forEach(r => console.error(' ', r))
    } else {
      console.error('[globalSetup] No failed/error requests captured.')
    }
    throw err
  }

  // If the login form appeared, complete the UI login flow.
  if (await emailInput.isVisible()) {
    console.warn('[globalSetup] Cookie injection did not restore session — using UI login fallback')
    await emailInput.fill(E2E_USER_EMAIL)
    await page.getByLabel('Password').fill(E2E_USER_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    try {
      await publishButton.waitFor({ timeout: 30_000 })
    } catch (err) {
      await page.screenshot({ path: 'e2e-setup-failure.png', fullPage: true })
      const url = page.url()
      const html = await page.content()
      console.error('[globalSetup] UI login fallback timed out after Sign-in click.')
      console.error('[globalSetup] URL:', url)
      console.error('[globalSetup] HTML snippet:', html.slice(0, 2000))
      throw err
    }
  }

  // Save storageState (cookies + localStorage)
  await context.storageState({ path: path.join(authDir, 'state.json') })
  await browser.close()

  console.log('[globalSetup] Auth state saved to e2e/.auth/state.json')
}
