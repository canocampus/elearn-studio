import { test as base, type Page, type APIRequestContext } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage'
import { LoginPage } from '../pages/LoginPage'

/**
 * Extended fixture that provides an authenticated page with the editor ready.
 *
 * Uses storageState from globalSetup (.auth/state.json) so the test starts
 * already logged in.
 *
 * T642.1: `editorPage` creates a fresh course per test via API and deletes it
 * in teardown — eliminates the shared seed course that caused FLAKE-03 when
 * parallel workers mutated the same course concurrently.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001'

async function getAccessToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_URL}/auth/refresh`, {
    // storageState cookies (refresh token) are automatically sent by the request fixture
  })
  if (!res.ok()) {
    throw new Error(`[fixture] /auth/refresh failed: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json() as { data: { accessToken: string } }
  return body.data.accessToken
}

async function createTestCourse(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${API_URL}/courses`, {
    data: { title: 'E2E Test Course' },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok()) {
    throw new Error(`[fixture] POST /courses failed: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json() as { data: { _id: string } }
  return body.data._id
}

async function deleteTestCourse(request: APIRequestContext, token: string, courseId: string): Promise<void> {
  const res = await request.delete(`${API_URL}/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok() && res.status() !== 404) {
    // 404 is acceptable — course may have been deleted by the test itself
    console.warn(`[fixture] DELETE /courses/${courseId} returned ${res.status()}`)
  }
}

type AuthFixtures = {
  editorPage: EditorPage
  loginPage: LoginPage
}

export const test = base.extend<AuthFixtures>({
  editorPage: async ({ page, request }: { page: Page; request: APIRequestContext }, use: (page: EditorPage) => Promise<void>) => {
    // ── Setup: create an isolated course for this test ────────────────────
    const token = await getAccessToken(request)
    const courseId = await createTestCourse(request, token)

    // Navigate directly to this course via ?courseId — prevents parallel workers
    // from loading each other's courses (T642.1).
    const editorPage = new EditorPage(page)
    await page.goto(`/?courseId=${courseId}`)
    await editorPage.waitForReady()
    const iframe = page.locator('iframe.gjs-frame')
    const appeared = await iframe.waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true).catch(() => false)
    if (appeared) {
      await page.locator('[data-editor-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })
    }

    await use(editorPage)

    // ── Teardown: delete the course so it doesn't accumulate ──────────────
    try {
      // Re-fetch token in case it expired during a long test
      const teardownToken = await getAccessToken(request).catch(() => token)
      await deleteTestCourse(request, teardownToken, courseId)
    } catch (err) {
      // Teardown failures must not shadow test failures
      console.warn(`[fixture] teardown delete failed for course ${courseId}:`, err)
    }
  },

  loginPage: async ({ page }: { page: Page }, use: (page: LoginPage) => Promise<void>) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await use(loginPage)
  },
})

export { expect } from '@playwright/test'
