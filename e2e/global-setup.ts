import { chromium, request } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * global-setup — runs once before all tests.
 *
 * 1. Creates a test user via POST /auth/register (only works when NODE_ENV=test)
 * 2. Logs in to obtain a refresh cookie
 * 3. Creates a seed course so the editor opens in 'ready' state
 * 4. Saves the browser auth state (cookies) to .auth/state.json for reuse
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
  const loginBody = await loginRes.json() as { data: { accessToken: string } }
  const accessToken = loginBody.data.accessToken

  // ── 3. Create seed course if none exist ────────────────────────────────────
  const coursesRes = await apiCtx.get('/courses', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const coursesBody = await coursesRes.json() as { data: Array<{ _id: string }> }
  if (coursesBody.data.length === 0) {
    const createRes = await apiCtx.post('/courses', {
      data: { title: 'E2E Test Course' },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!createRes.ok()) {
      const body = await createRes.text()
      throw new Error(`Failed to create seed course: ${body}`)
    }
  }
  await apiCtx.dispose()

  // ── 4. Capture browser auth state (cookies) via a real browser session ─────
  // The app uses httpOnly refresh cookie. We must open a real browser context,
  // navigate so the cookie is set on the right origin, then save storageState.
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL: BASE_URL })

  // Set the refresh token cookie on the API origin so the app's /auth/refresh
  // fetch succeeds when it loads. We achieve this by logging in through the
  // login page so the browser cookie jar is populated normally.
  const page = await context.newPage()
  await page.goto('/')

  // Wait for login form then fill with semantic locators
  await page.getByLabel('Email').waitFor({ timeout: 15_000 })
  await page.getByLabel('Email').fill(E2E_USER_EMAIL)
  await page.getByLabel('Password').fill(E2E_USER_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait for editor to be ready (TopToolbar "Publish SCORM" visible)
  try {
    await page.getByRole('button', { name: /Publish SCORM/i }).waitFor({ timeout: 20_000 })
  } catch (err) {
    await page.screenshot({ path: 'e2e-setup-failure.png', fullPage: true })
    const url = page.url()
    const html = await page.content()
    console.error('[globalSetup] Timed out. URL:', url)
    console.error('[globalSetup] Page HTML snippet:', html.slice(0, 2000))
    throw err
  }

  // Save storageState (cookies + localStorage)
  await context.storageState({ path: path.join(authDir, 'state.json') })
  await browser.close()

  console.log('[globalSetup] Auth state saved to e2e/.auth/state.json')
}
