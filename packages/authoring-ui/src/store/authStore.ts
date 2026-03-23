/**
 * Auth store — access token lives in memory only (never localStorage/sessionStorage).
 * The httpOnly refresh token cookie is managed by the browser automatically.
 */
import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  role: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  /** Call after successful login or token refresh. */
  setAuth: (token: string, user: AuthUser) => void
  /** Call on logout or when refresh fails. */
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}))
