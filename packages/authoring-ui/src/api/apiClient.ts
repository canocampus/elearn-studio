/**
 * Authenticated fetch wrapper.
 *
 * - Injects the in-memory Bearer token on every request.
 * - On 401, attempts one silent refresh via POST /auth/refresh (cookie-based).
 *   If the refresh succeeds, the original request is retried with the new token.
 *   If the refresh fails, authStore is cleared (user sent to login).
 */
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ── Refresh token exchange ────────────────────────────────────────────────

interface RefreshResponse {
  success: boolean
  data: { accessToken: string }
}

interface MeResponse {
  success: boolean
  data: { sub: string; email: string; role: string }
}

async function attemptRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends httpOnly cookie
    })
    if (!res.ok) return null
    const body = (await res.json()) as RefreshResponse
    return body.data.accessToken
  } catch {
    return null
  }
}

// ── Core request function ─────────────────────────────────────────────────

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { accessToken, setAuth, clearAuth } = useAuthStore.getState()

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  if (
    init.body &&
    typeof init.body === 'string' &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.status !== 401) return res

  // Try silent refresh on 401
  const newToken = await attemptRefresh()
  if (!newToken) {
    clearAuth()
    return res
  }

  // Fetch /auth/me to get user info for the store
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
      credentials: 'include',
    })
    if (meRes.ok) {
      const me = (await meRes.json()) as MeResponse
      setAuth(newToken, {
        id: me.data.sub,
        email: me.data.email,
        role: me.data.role,
      })
    }
  } catch {
    // If /me fails we still have the new token; just update the token
    setAuth(newToken, useAuthStore.getState().user ?? { id: '', email: '', role: 'author' })
  }

  // Retry original request with new token
  const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  })
}

// ── Typed JSON helpers ────────────────────────────────────────────────────

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'
  let res: Response
  try {
    res = await apiFetch(path, init)
  } catch (networkErr) {
    throw new Error(
      `API ${method} ${path} — network error (is the backend running at ${API_BASE}?): ${networkErr}`,
    )
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    const body = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
    throw new Error(`API ${method} ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export async function apiBlobRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET'
  let res: Response
  try {
    res = await apiFetch(path, init)
  } catch (networkErr) {
    throw new Error(
      `API ${method} ${path} — network error: ${networkErr}`,
    )
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${method} ${path} → ${res.status}: ${body}`)
  }
  return res
}
