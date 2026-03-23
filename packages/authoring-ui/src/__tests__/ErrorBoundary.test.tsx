/**
 * T181 — React Error Boundaries
 *
 * Tests:
 *   - ErrorBoundary renders children when no error occurs
 *   - ErrorBoundary shows fallback UI when a child throws
 *   - Retry button resets the boundary and re-renders children
 *   - onError callback is called with the thrown error
 *   - PanelErrorBoundary calls toast.error with panel name + message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, PanelErrorBoundary } from '../components/ui/ErrorBoundary'
import { ToastProvider } from '../components/ui/Toast'

// Suppress React's console.error for expected boundary catches
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

// ── Throwing child helper ──────────────────────────────────────────────────────

function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('render exploded')
  return <div data-testid="child">OK</div>
}

// ── ErrorBoundary (class) ──────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary name="TestPanel">
        <ThrowOnRender shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary name="TestPanel">
        <ThrowOnRender shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/Panel error/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload panel/i })).toBeInTheDocument()
  })

  it('fallback mentions the panel name', () => {
    render(
      <ErrorBoundary name="SlideList">
        <ThrowOnRender shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/SlideList/)).toBeInTheDocument()
  })

  it('retry button resets boundary and re-renders children', () => {
    // Control shouldThrow via a closure flag so we can fix it before retry
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('transient error')
      return <div data-testid="child">OK</div>
    }

    render(
      <ErrorBoundary name="TestPanel">
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /reload panel/i })).toBeInTheDocument()

    // Resolve the underlying error, then click retry
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /reload panel/i }))

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('calls onError with the thrown error', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary name="TestPanel" onError={onError}>
        <ThrowOnRender shouldThrow />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'render exploded' }),
      expect.any(Object), // ErrorInfo
    )
  })

  it('does NOT call onError when children render successfully', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary name="TestPanel" onError={onError}>
        <ThrowOnRender shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(onError).not.toHaveBeenCalled()
  })
})

// ── PanelErrorBoundary (toast integration) ────────────────────────────────────

describe('PanelErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ToastProvider>
        <PanelErrorBoundary name="TestPanel">
          <ThrowOnRender shouldThrow={false} />
        </PanelErrorBoundary>
      </ToastProvider>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows fallback and fires toast.error when child throws', () => {
    render(
      <ToastProvider>
        <PanelErrorBoundary name="MyPanel">
          <ThrowOnRender shouldThrow />
        </PanelErrorBoundary>
      </ToastProvider>,
    )

    // Fallback is shown
    expect(screen.getByText(/Panel error/i)).toBeInTheDocument()

    // Toast was rendered with error message containing panel name
    expect(screen.getByText(/Panel crashed: MyPanel/i)).toBeInTheDocument()
  })

  it('logs component stack to console.error when child throws', () => {
    render(
      <ToastProvider>
        <PanelErrorBoundary name="StackPanel">
          <ThrowOnRender shouldThrow />
        </PanelErrorBoundary>
      </ToastProvider>,
    )

    // console.error is mocked in beforeEach; verify it was called with componentStack log
    const calls = vi.mocked(console.error).mock.calls
    const stackCall = calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('[Panel:StackPanel] Component stack:'),
    )
    expect(stackCall).toBeDefined()
  })
})
