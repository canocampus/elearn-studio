/**
 * Root application component.
 *
 * On mount:
 *   1. Tries POST /auth/refresh to silently restore session from httpOnly cookie.
 *   2. If successful, bootstraps the course list and loads the editor.
 *   3. If not, shows the LoginPage.
 *
 * After login, the user is stored in authStore (memory only — no localStorage).
 */

import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { useEditorStore } from './store/editorStore'
import { useAuthStore } from './store/authStore'
import { listCourses, createCourse, getCourse } from './api/courseApi'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type AppState = 'initialising' | 'login' | 'loading' | 'ready' | 'error'

export function App() {
  const [appState, setAppState] = useState<AppState>('initialising')
  const [errorMessage, setErrorMessage] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)

  const setCourse = useEditorStore((s) => s.setCourse)
  const { accessToken, user, setAuth } = useAuthStore()

  // ── Silent refresh on first load ─────────────────────────────────────────
  useEffect(() => {
    async function tryRestoreSession() {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) {
          setAppState('login')
          return
        }
        const body = (await res.json()) as {
          success: boolean
          data: { accessToken: string }
        }
        if (!body.success) {
          setAppState('login')
          return
        }
        const token = body.data.accessToken

        // Fetch user info
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })
        if (!meRes.ok) {
          setAppState('login')
          return
        }
        const me = (await meRes.json()) as {
          success: boolean
          data: { sub: string; email: string; role: string }
        }
        setAuth(token, { id: me.data.sub, email: me.data.email, role: me.data.role })
        // bootstrapCourse runs when accessToken changes (next effect)
      } catch {
        setAppState('login')
      }
    }

    tryRestoreSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Bootstrap course when authenticated ──────────────────────────────────
  useEffect(() => {
    if (!accessToken || !user) return

    async function bootstrapCourse() {
      setAppState('loading')
      try {
        const courses = await listCourses()
        let id: string

        if (courses.length > 0) {
          const sorted = [...courses].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )
          id = sorted[0]._id
        } else {
          const created = await createCourse('My First Course')
          id = created._id
        }

        const full = await getCourse(id)
        setCourse(full)
        setCourseId(id)
        setAppState('ready')
      } catch (err) {
        console.error('[App] bootstrap failed:', err)
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setAppState('error')
      }
    }

    bootstrapCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // ── Render ────────────────────────────────────────────────────────────────

  if (appState === 'initialising' || appState === 'loading') {
    return (
      <div style={splashStyle}>
        <span style={{ color: '#89b4fa', fontSize: 14 }}>Loading eLearn Studio…</span>
      </div>
    )
  }

  if (appState === 'login') {
    return <LoginPage />
  }

  if (appState === 'error') {
    return (
      <div style={{ ...splashStyle, flexDirection: 'column', gap: 12 }}>
        <span style={{ color: '#f38ba8', fontSize: 14, fontWeight: 600 }}>Failed to load</span>
        <span style={{ color: '#a6adc8', fontSize: 12, maxWidth: 400, textAlign: 'center' }}>
          {errorMessage}
        </span>
        <span style={{ color: '#6c7086', fontSize: 11 }}>
          Is the backend running? Check {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/health
        </span>
        <button
          style={{
            marginTop: 8,
            padding: '6px 16px',
            cursor: 'pointer',
            borderRadius: 4,
            background: '#313244',
            border: '1px solid #45475a',
            color: '#cdd6f4',
            fontSize: 12,
          }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return <AppLayout courseId={courseId!} />
}

const splashStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: '#1e1e2e',
  fontFamily: 'Inter, system-ui, sans-serif',
}
