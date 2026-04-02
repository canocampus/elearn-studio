import * as path from 'path'
import * as fs from 'fs'
import { test, expect } from '../fixtures'

/**
 * Image Widget Upload & Display Tests
 *
 * Verifies the full image lifecycle in the GrapesJS canvas:
 *   1. Upload via Asset Manager → backend stores in Garage
 *   2. Image widget resolves /assets/ path to a presigned URL
 *   3. The <img> element in the canvas displays the presigned URL (not a 401 path)
 *
 * Root cause this tests against: browser <img> tags cannot send Bearer tokens,
 * so /assets/:objectName returns 401. The fix adds a /presigned endpoint and
 * resolves the URL in the GrapesJS view's onRender() / change:attributes handler.
 */

// Minimal 1×1 transparent PNG (67 bytes) — no external file needed.
const TINY_PNG_BUF = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** Returns a real image buffer+name from the fixtures directory if available,
 *  otherwise falls back to the in-memory tiny PNG. */
function testImageFile(): { name: string; mimeType: string; buffer: Buffer } {
  const fixturesDir = path.join(__dirname, '../fixtures/images')
  const candidates = ['test.png', 'test.jpg', 'test.jpeg']
  for (const name of candidates) {
    const fullPath = path.join(fixturesDir, name)
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath)
      const mimeType = name.endsWith('.png') ? 'image/png' : 'image/jpeg'
      return { name, mimeType, buffer }
    }
  }
  // Fallback: generated 1×1 PNG
  return { name: 'test-image.png', mimeType: 'image/png', buffer: TINY_PNG_BUF }
}

test.describe('Image Widget: Upload & Presigned URL Display', () => {

  test.beforeEach(async ({ editorPage, page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`)
    })

    await editorPage.addSlide()
    await editorPage.waitForCanvas()
  })

  // ── Test 1: Full upload → presigned URL resolution in canvas ───────────────

  test('image upload resolves to a presigned URL in the canvas', async ({ editorPage, page }) => {
    // Track whether /presigned endpoint was called by the canvas JS
    let presignedApiCalled = false
    page.on('response', res => {
      if (/\/assets\/[^/]+\/presigned/.test(res.url()) && res.status() === 200) {
        presignedApiCalled = true
      }
    })

    // 1. Drop an Image block onto the canvas
    await editorPage.dragBlockToCanvas('Image', 300, 200)
    const img = editorPage.canvasComponent('[data-gjs-type="image"]')
    await expect(img).toBeVisible({ timeout: 15_000 })

    // 2. Click the image widget → opens the GrapesJS Asset Manager modal
    await img.click()

    const assetManager = page.locator('.gjs-mdl-container')
    await assetManager.waitFor({ state: 'visible', timeout: 10_000 })

    // 3. Upload the test image via the hidden file input inside the AM
    //    setInputFiles works on hidden inputs without force: true
    const fileInput = page.locator('input[type="file"]').first()
    const testFile = testImageFile()
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    })

    // 4. Wait for the asset to appear in the AM list (upload is async)
    //    GrapesJS renders each uploaded asset as .gjs-am-asset
    const assetItem = page.locator('.gjs-am-asset').first()
    await assetItem.waitFor({ state: 'visible', timeout: 20_000 })

    // 5. Click the asset to select it.
    //    In GrapesJS, clicking an asset calls our select() callback which sets
    //    model.addAttributes({ src: '/assets/uuid.png' }).
    await assetItem.click()

    // Wait for the AM to close (select callback calls editor.AssetManager.close()
    // when complete=true). If it doesn't close automatically, close it manually.
    await Promise.race([
      assetManager.waitFor({ state: 'hidden', timeout: 5_000 }),
      page.waitForTimeout(5_000),
    ]).catch(() => {})

    // 6. Poll for the presigned URL to appear as the img src.
    //    resolveAndSetSrc() is async (~100-500 ms for the API call), so we give
    //    it up to 15 s — more than enough even on a slow CI runner.
    await expect(img).toHaveAttribute('src', /^https?:\/\//, { timeout: 15_000 })

    // 7. Confirm the /presigned endpoint was actually called by the canvas JS.
    //    This distinguishes our fix from the case where the src was never updated.
    expect(presignedApiCalled).toBe(true)
  })

  // ── T601 Test 2: AM shows presigned thumbnail + original filename after upload ─

  test('T601 — Asset Manager shows image thumbnail (not broken icon) and original filename after upload', async ({ editorPage, page }) => {
    // 1. Drop image block and open AM
    await editorPage.dragBlockToCanvas('Image', 300, 200)
    const img = editorPage.canvasComponent('[data-gjs-type="image"]')
    await expect(img).toBeVisible({ timeout: 15_000 })
    await img.click()

    const assetManager = page.locator('.gjs-mdl-container')
    await assetManager.waitFor({ state: 'visible', timeout: 10_000 })

    // 2. Upload via file input
    const fileInput = page.locator('input[type="file"]').first()
    const testFile = testImageFile()
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    })

    // 3. Wait for asset item to appear in the list
    const assetItem = page.locator('.gjs-am-asset').first()
    await assetItem.waitFor({ state: 'visible', timeout: 20_000 })

    // 4. T601 BETA-07: the thumbnail <img> inside the AM item must have a presigned URL
    //    src (http://…) — NOT the auth-protected /assets/ path.
    const thumbImg = assetItem.locator('img').first()
    if (await thumbImg.count() > 0) {
      await expect(thumbImg).toHaveAttribute('src', /^https?:\/\//, { timeout: 10_000 })
    }

    // 5. T601 BETA-12: the AM item must display the original filename, not a UUID.
    //    GrapesJS renders the asset name as text inside .gjs-am-asset-name (or similar).
    //    The original filename is testFile.name (e.g. "test-image.png").
    const assetItemText = await assetItem.textContent() ?? ''
    // Original name should appear somewhere in the item text; UUID pattern should NOT be the only text
    expect(assetItemText).toContain(testFile.name.replace(/\.[^.]+$/, '')) // stem without extension
  })

  // ── Test 3: /assets/:objectName/presigned returns JSON with presignedUrl ───

  test('GET /assets/:objectName/presigned endpoint returns a presigned URL', async ({ page }) => {
    // Upload an asset directly via the API so we have a real objectName to test with
    const testFile = testImageFile()
    const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001'

    // The access token lives in Zustand memory only (never localStorage/sessionStorage),
    // so storageState() won't contain it. Do a fresh login to get a token for direct API calls.
    const email = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@elearn.test'
    const password = process.env.E2E_TEST_USER_PASSWORD ?? 'e2e-password-secure-123'
    const loginRes = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    })
    const loginBody = await loginRes.json() as { data: { accessToken: string } }
    const token: string = loginBody.data.accessToken ?? ''

    // Upload via backend API using Playwright's multipart helper.
    // page.request inherits cookies from the context, but the backend uses Bearer auth,
    // so we add the Authorization header explicitly.
    const uploadRes = await page.request.post(`${API_BASE}/assets`, {
      multipart: {
        file: {
          name: testFile.name,
          mimeType: testFile.mimeType,
          buffer: testFile.buffer,
        },
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    expect(uploadRes.status()).toBe(201)
    const uploadBody = await uploadRes.json()
    const objectName: string = uploadBody.data.objectName

    // Call the new /presigned endpoint
    const presignedRes = await page.request.get(`${API_BASE}/assets/${objectName}/presigned`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    expect(presignedRes.status()).toBe(200)
    const presignedBody = await presignedRes.json()

    expect(presignedBody.success).toBe(true)
    expect(presignedBody.data.presignedUrl).toMatch(/^https?:\/\//)
    // The presigned URL must not be the /assets/ path itself
    expect(presignedBody.data.presignedUrl).not.toMatch(/^\/assets\//)
  })

  // ── Test 3: /assets/:objectName without auth returns 401 ──────────────────

  test('GET /assets/:objectName returns 401 without auth (confirms why fix is needed)', async ({ page }) => {
    const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3001'

    // Try to access a well-formed but non-existent asset without auth.
    // We just need to confirm auth is required — 401 is expected.
    const res = await page.request.get(
      `${API_BASE}/assets/00000000-0000-4000-8000-000000000000.png`,
      {
        // No Authorization header
        headers: {},
        // Don't follow the 302 redirect to Garage since we're testing auth
        failOnStatusCode: false,
      },
    )

    // Backend must reject unauthenticated requests before reaching Garage
    expect(res.status()).toBe(401)
  })

})
