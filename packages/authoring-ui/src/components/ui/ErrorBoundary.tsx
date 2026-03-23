/**
 * T181 — React Error Boundaries
 *
 * Exports:
 *   ErrorBoundary       — generic class-component boundary; accepts onError callback
 *   PanelErrorBoundary  — functional wrapper that auto-wires toast.error via useToast()
 *
 * Usage in AppLayout:
 *   <PanelErrorBoundary name="SlideList">
 *     <SlideList />
 *   </PanelErrorBoundary>
 */

import { Component, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { useToast } from './Toast'
import { captureError } from '../../lib/errorReporter'

// ── ErrorBoundary (class) ──────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  name: string
  children: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info)
    this.props.onError?.(error, info)
    captureError(error, { panel: this.props.name, componentStack: info.componentStack })
  }

  /**
   * Resets the boundary to re-render children. Note: this is unconditional —
   * if the underlying crash is permanent (corrupted store state, missing props),
   * the panel will crash again immediately. Most panel crashes are transient.
   */
  private reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <PanelFallback
          name={this.props.name}
          error={this.state.error}
          onRetry={this.reset}
        />
      )
    }
    return this.props.children
  }
}

// ── Fallback UI ────────────────────────────────────────────────────────────────

interface PanelFallbackProps {
  name: string
  error: Error | null
  onRetry: () => void
}

function PanelFallback({ name, error, onRetry }: PanelFallbackProps) {
  return (
    <div style={styles.container} role="alert">
      <span style={styles.title}>Panel error — {name}</span>
      {error && (
        <span style={styles.detail}>{error.message}</span>
      )}
      <button style={styles.button} onClick={onRetry}>
        Reload panel
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    height: '100%',
    color: '#f38ba8',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    textAlign: 'center',
  },
  title: {
    fontWeight: 600,
  },
  detail: {
    color: '#a6adc8',
    fontSize: 11,
    maxWidth: 200,
    wordBreak: 'break-word',
  },
  button: {
    marginTop: 4,
    padding: '5px 12px',
    fontSize: 11,
    cursor: 'pointer',
    borderRadius: 4,
    background: '#313244',
    border: '1px solid #45475a',
    color: '#cdd6f4',
  },
}

// ── PanelErrorBoundary (hooks wrapper) ────────────────────────────────────────

interface PanelErrorBoundaryProps {
  name: string
  children: ReactNode
}

/**
 * Functional wrapper around ErrorBoundary that wires toast.error automatically.
 * Must be rendered inside <ToastProvider>.
 */
export function PanelErrorBoundary({ name, children }: PanelErrorBoundaryProps) {
  const toast = useToast()

  const handleError = useCallback(
    (error: Error, info: ErrorInfo) => {
      console.error(`[Panel:${name}] Component stack:`, info.componentStack)
      toast.error(`Panel crashed: ${name} — ${error.message}`)
    },
    [name, toast],
  )

  return (
    <ErrorBoundary name={name} onError={handleError}>
      {children}
    </ErrorBoundary>
  )
}
