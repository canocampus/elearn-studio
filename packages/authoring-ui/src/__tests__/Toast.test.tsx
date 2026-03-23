/**
 * T160 — Toast / Notification System unit tests
 * Covers: render all severities, auto-dismiss, manual dismiss, error persistence,
 *         useToast throws outside provider, aria attributes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '../components/ui/Toast'

// ─── Helper ───────────────────────────────────────────────────────────────────

function Trigger({ action }: { action: (t: ReturnType<typeof useToast>) => void }) {
  const toast = useToast()
  return <button onClick={() => action(toast)}>trigger</button>
}

function renderWithProvider(action: (t: ReturnType<typeof useToast>) => void) {
  return render(
    <ToastProvider>
      <Trigger action={action} />
    </ToastProvider>,
  )
}

// ─── Render & severity ────────────────────────────────────────────────────────

describe('ToastProvider / useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders a success toast with correct message', () => {
    renderWithProvider(t => t.success('Saved successfully'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Saved successfully')).toBeInTheDocument()
  })

  it('renders a warning toast', () => {
    renderWithProvider(t => t.warning('Low disk space'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Low disk space')).toBeInTheDocument()
  })

  it('renders an error toast', () => {
    renderWithProvider(t => t.error('Save failed'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Save failed')).toBeInTheDocument()
  })

  it('renders an info toast', () => {
    renderWithProvider(t => t.info('Autosave enabled'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Autosave enabled')).toBeInTheDocument()
  })

  it('applies role="alert" to each toast', () => {
    renderWithProvider(t => t.success('ok'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('uses aria-live="polite" for non-error severities', () => {
    renderWithProvider(t => t.info('info'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
  })

  it('uses aria-live="assertive" for error severity', () => {
    renderWithProvider(t => t.error('boom'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })
})

// ─── Auto-dismiss ─────────────────────────────────────────────────────────────

describe('Auto-dismiss', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('auto-dismisses success toast after 4 s', async () => {
    renderWithProvider(t => t.success('done'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('done')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByText('done')).not.toBeInTheDocument()
  })

  it('auto-dismisses warning toast after 4 s', async () => {
    renderWithProvider(t => t.warning('warn'))
    fireEvent.click(screen.getByText('trigger'))
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByText('warn')).not.toBeInTheDocument()
  })

  it('auto-dismisses info toast after 4 s', async () => {
    renderWithProvider(t => t.info('fyi'))
    fireEvent.click(screen.getByText('trigger'))
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByText('fyi')).not.toBeInTheDocument()
  })

  it('does NOT auto-dismiss error toast after 4 s', () => {
    renderWithProvider(t => t.error('critical'))
    fireEvent.click(screen.getByText('trigger'))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('toast is still visible just before 4 s', () => {
    renderWithProvider(t => t.success('soon'))
    fireEvent.click(screen.getByText('trigger'))
    act(() => vi.advanceTimersByTime(3999))
    expect(screen.getByText('soon')).toBeInTheDocument()
  })
})

// ─── Manual dismiss ───────────────────────────────────────────────────────────

describe('Manual dismiss', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('removes toast when dismiss button is clicked', () => {
    renderWithProvider(t => t.error('persist'))
    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('persist')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss notification'))
    expect(screen.queryByText('persist')).not.toBeInTheDocument()
  })

  it('can dismiss a success toast before auto-dismiss fires', () => {
    renderWithProvider(t => t.success('early'))
    fireEvent.click(screen.getByText('trigger'))
    fireEvent.click(screen.getByLabelText('Dismiss notification'))
    expect(screen.queryByText('early')).not.toBeInTheDocument()
    // Timer should NOT fire on removed element (no error)
    act(() => vi.advanceTimersByTime(4000))
  })
})

// ─── Multiple toasts ──────────────────────────────────────────────────────────

describe('Multiple toasts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders multiple toasts simultaneously', () => {
    let count = 0
    function MultiTrigger() {
      const toast = useToast()
      return (
        <button onClick={() => {
          if (count === 0) { toast.success('first'); toast.error('second') }
          count++
        }}>go</button>
      )
    }
    render(<ToastProvider><MultiTrigger /></ToastProvider>)
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('dismissing one toast does not remove others', () => {
    function MultiTrigger() {
      const toast = useToast()
      return (
        <button onClick={() => { toast.error('A'); toast.error('B') }}>go</button>
      )
    }
    render(<ToastProvider><MultiTrigger /></ToastProvider>)
    fireEvent.click(screen.getByText('go'))
    const dismissBtns = screen.getAllByLabelText('Dismiss notification')
    fireEvent.click(dismissBtns[0]!)
    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

// ─── useToast outside provider ────────────────────────────────────────────────

describe('useToast outside provider', () => {
  it('throws when used outside <ToastProvider>', () => {
    function Bad() {
      useToast()
      return null
    }
    // Suppress React error boundary output in test console
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bad />)).toThrow('useToast must be used inside <ToastProvider>')
    spy.mockRestore()
  })
})
