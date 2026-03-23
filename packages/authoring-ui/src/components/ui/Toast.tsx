/**
 * T160 — Toast / Notification System
 *
 * Exports:
 *   ToastProvider  — wraps the app; manages toast state
 *   useToast()     — hook: { success, warning, error, info }
 *   ToastContainer — renders active toasts (mounted inside AppLayout)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastSeverity = 'success' | 'warning' | 'error' | 'info'

interface ToastItem {
  id: string
  severity: ToastSeverity
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  warning: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

function nextId() {
  // Use crypto.randomUUID for stable, unique IDs without module-level mutable state
  return `toast-${crypto.randomUUID()}`
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((severity: ToastSeverity, message: string) => {
    const id = nextId()
    setToasts(prev => [...prev, { id, severity, message }])
  }, [])

  const value = useMemo<ToastContextValue>(() => ({
    success: (msg) => show('success', msg),
    warning: (msg) => show('warning', msg),
    error:   (msg) => show('error', msg),
    info:    (msg) => show('info', msg),
  }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ─── Container ────────────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null
  return (
    <div
      style={containerStyle}
      aria-label="Notifications"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// ─── Individual Toast ─────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000

interface ToastItemProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Errors persist until manually dismissed; all others auto-dismiss
    if (toast.severity !== 'error') {
      timerRef.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.severity, onDismiss])

  const palette = severityPalette[toast.severity]

  const ariaLive = toast.severity === 'error' ? 'assertive' : 'polite'

  return (
    <div
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
      style={{ ...toastStyle, borderLeft: `4px solid ${palette.accent}`, background: palette.bg }}
    >
      <span style={{ color: palette.accent, fontSize: 16, flexShrink: 0 }}>{palette.icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: '#cdd6f4', lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        style={dismissBtnStyle}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Styles & Palette ─────────────────────────────────────────────────────────

const severityPalette: Record<ToastSeverity, { bg: string; accent: string; icon: string }> = {
  success: { bg: '#1e3a2f', accent: '#a6e3a1', icon: '✓' },
  warning: { bg: '#3a2f1e', accent: '#f9e2af', icon: '⚠' },
  error:   { bg: '#3a1e1e', accent: '#f38ba8', icon: '✕' },
  info:    { bg: '#1e2a3a', accent: '#89b4fa', icon: 'ℹ' },
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 9999,
  maxWidth: 380,
  pointerEvents: 'none',
}

const toastStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  pointerEvents: 'all',
  animation: 'none',
}

const dismissBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#6c7086',
  cursor: 'pointer',
  fontSize: 12,
  flexShrink: 0,
  padding: '0 2px',
  lineHeight: 1,
}
