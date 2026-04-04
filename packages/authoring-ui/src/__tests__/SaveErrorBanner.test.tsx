/**
 * T622.6 — SaveErrorBanner unit tests
 *
 * saveError in store → banner renders with message and retry button
 * retry success → banner disappears
 * retry failure → banner updates message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SaveErrorBanner } from '../components/ui/SaveErrorBanner'
import { useEditorStore } from '../store/editorStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner() {
  return render(<SaveErrorBanner />)
}

function setStoreState(patch: Partial<ReturnType<typeof useEditorStore.getState>>) {
  useEditorStore.setState(patch)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveErrorBanner', () => {
  beforeEach(() => {
    useEditorStore.setState({
      saveError: null,
      editor: null,
    })
  })

  it('renders nothing when saveError is null', () => {
    renderBanner()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders banner with error message when saveError is set (T622 regression)', () => {
    setStoreState({ saveError: 'Network error 503' })
    renderBanner()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Network error 503/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('calls editor.store() on Retry and clears error on success', async () => {
    const mockStore = vi.fn().mockResolvedValue(undefined)
    setStoreState({
      saveError: 'Timeout',
      editor: { store: mockStore } as unknown as ReturnType<typeof useEditorStore.getState>['editor'],
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(mockStore).toHaveBeenCalledOnce()
      // Banner should be gone after successful retry
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('updates error message when retry fails (T622 regression)', async () => {
    const mockStore = vi.fn().mockRejectedValue(new Error('Still failing'))
    setStoreState({
      saveError: 'Original error',
      editor: { store: mockStore } as unknown as ReturnType<typeof useEditorStore.getState>['editor'],
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/Still failing/)).toBeTruthy()
    })
  })

  it('does nothing when Retry is clicked without an editor instance', () => {
    setStoreState({ saveError: 'No editor yet', editor: null })
    renderBanner()
    // Should not throw
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    // Banner remains (error not cleared because no editor)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
