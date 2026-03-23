import { request } from '@playwright/test'
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from './global-setup'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001'

export default async function globalTeardown() {
  const apiCtx = await request.newContext({ baseURL: API_URL })

  // Login to get access token for cleanup
  const loginRes = await apiCtx.post('/auth/login', {
    data: { email: E2E_USER_EMAIL, password: E2E_USER_PASSWORD },
  })
  if (!loginRes.ok()) {
    console.warn('[globalTeardown] Could not login for cleanup — skipping')
    await apiCtx.dispose()
    return
  }
  const loginBody = await loginRes.json() as { data: { accessToken: string } }
  const accessToken = loginBody.data.accessToken

  // Delete all courses owned by the test user
  const coursesRes = await apiCtx.get('/courses', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!coursesRes.ok()) {
    console.warn(`[globalTeardown] Failed to fetch courses: ${coursesRes.status()} — skipping cleanup`)
    await apiCtx.dispose()
    return
  }
  const coursesBody = await coursesRes.json() as { data: Array<{ _id: string }> }
  for (const course of coursesBody.data) {
    const delRes = await apiCtx.delete(`/courses/${course._id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!delRes.ok()) {
      console.warn(`[globalTeardown] Failed to delete course ${course._id}: ${delRes.status()}`)
    }
  }
  console.log(`[globalTeardown] Deleted ${coursesBody.data.length} test course(s)`)

  await apiCtx.dispose()
  console.log('[globalTeardown] Cleanup complete')
}
