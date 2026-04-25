/**
 * Authenticated fetch wrapper.
 *
 * - Injects the in-memory Bearer token on every request.
 * - On 401, attempts one silent refresh via POST /auth/refresh (cookie-based).
 *   If the refresh succeeds, the original request is retried with the new token.
 *   If the refresh fails, authStore is cleared (user sent to login).
 */
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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

/**
 * Resolve a request path to a full URL.
 *
 * TD-014.8: recorder calls go to a different origin (:3002) than the main API
 * (:3001), so callers may pass an absolute URL. Relative paths still get
 * `VITE_API_URL` prepended for the primary-API case.
 */
function resolveUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`
}

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

  const url = resolveUrl(path)
  // Default to `credentials: 'include'` for the elearn backend (cookie-based
  // refresh-token handshake); allow callers to override (recorderApi calls
  // the simulation-engine on :3002 which intentionally rejects cookies — see
  // `simulation-engine/src/middleware/cors.ts`. Sending `credentials: 'include'`
  // there triggers a browser CORS preflight that demands an
  // `Access-Control-Allow-Credentials: true` response header simulation-engine
  // does NOT send by design, surfacing as `TypeError: Failed to fetch`).
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
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
  return fetch(url, {
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
    // Absolute URLs (recorder, other origins) render the origin in `path`
    // already — don't repeat API_BASE in the hint for those cases.
    const hint = /^https?:\/\//i.test(path) ? '' : ` (is the backend running at ${API_BASE}?)`
    throw new Error(
      `API ${method} ${path} — network error${hint}: ${networkErr}`,
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
