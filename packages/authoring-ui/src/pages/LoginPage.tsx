/**
 * LoginPage — email/password auth form.
 * Calls POST /auth/login, stores token in authStore (memory only).
 */
import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface LoginResponse {
  success: boolean
  data: {
    accessToken: string
    user: { id: string; email: string; role: string }
  }
  error?: string
}

export function LoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const body = (await res.json()) as LoginResponse
      if (!res.ok || !body.success) {
        setError(body.error ?? 'Login failed')
        return
      }
      setAuth(body.data.accessToken, body.data.user)
    } catch {
      setError('Network error — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>eLearn Studio</h1>
        <p style={subtitleStyle}>Sign in to continue</p>
        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </label>
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: '#1e1e2e',
  fontFamily: 'Inter, system-ui, sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: '#313244',
  borderRadius: 8,
  padding: '32px 40px',
  width: 360,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: '#cdd6f4',
}

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 24,
  fontSize: 13,
  color: '#a6adc8',
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#cdd6f4',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid #45475a',
  background: '#1e1e2e',
  color: '#cdd6f4',
  fontSize: 14,
  outline: 'none',
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#f38ba8',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 4,
  padding: '9px 0',
  borderRadius: 4,
  border: 'none',
  background: '#89b4fa',
  color: '#1e1e2e',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
