/**
 * Tests for ActionsDebugOverlay — T165.5
 */

import { render, screen, act } from '@testing-library/react'
import { ActionsDebugOverlay } from '../../components/debug/ActionsDebugOverlay'

function dispatchActionEvent(
  type: 'elearn:action:start' | 'elearn:action:end' | 'elearn:action:error',
  detail: Record<string, unknown>,
) {
  window.dispatchEvent(new CustomEvent(type, { detail }))
}

describe('ActionsDebugOverlay', () => {
  it('renders nothing when no events have fired', () => {
    const { container } = render(<ActionsDebugOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the overlay after an action:start event', () => {
    render(<ActionsDebugOverlay />)
    act(() => {
      dispatchActionEvent('elearn:action:start', { type: 'navigate', timestamp: Date.now() })
    })
    expect(screen.getByTestId('actions-debug-overlay')).toBeInTheDocument()
    expect(screen.getByText('navigate')).toBeInTheDocument()
  })

  it('updates entry to done on action:end', () => {
    render(<ActionsDebugOverlay />)
    const ts = Date.now()
    act(() => {
      dispatchActionEvent('elearn:action:start', { type: 'show', timestamp: ts })
    })
    act(() => {
      dispatchActionEvent('elearn:action:end', { type: 'show', timestamp: ts, duration: 42 })
    })
    // Status label should contain duration
    expect(screen.getByText(/42ms/)).toBeInTheDocument()
  })

  it('updates entry to error on action:error', () => {
    render(<ActionsDebugOverlay />)
    const ts = Date.now()
    act(() => {
      dispatchActionEvent('elearn:action:start', { type: 'set-variable', timestamp: ts })
    })
    act(() => {
      dispatchActionEvent('elearn:action:error', { type: 'set-variable', timestamp: ts, error: 'undefined variable' })
    })
    expect(screen.getByText(/undefined variable/)).toBeInTheDocument()
  })

  it('caps the list at 20 entries', () => {
    render(<ActionsDebugOverlay />)
    act(() => {
      for (let i = 0; i < 25; i++) {
        dispatchActionEvent('elearn:action:start', { type: `action-${i}`, timestamp: Date.now() + i })
      }
    })
    const overlay = screen.getByTestId('actions-debug-overlay')
    // Each entry shows the action type; count rows
    const rows = overlay.querySelectorAll('[style*="display: flex; justify-content"]')
    // The list container should have at most 20 items visible
    expect(screen.getAllByText(/^action-/).length).toBeLessThanOrEqual(20)
  })

  it('removes event listeners on unmount', () => {
    const { unmount } = render(<ActionsDebugOverlay />)
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('elearn:action:start', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('elearn:action:end', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('elearn:action:error', expect.any(Function))
  })
})
