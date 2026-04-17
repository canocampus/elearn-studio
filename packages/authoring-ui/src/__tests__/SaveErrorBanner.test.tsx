/**
 * T622.6 — SaveErrorBanner unit tests
 *
 * saveError in store → banner renders with message and retry button
 * retry success → banner disappears
 * retry failure → banner updates message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Editor } from 'grapesjs'
import { SaveErrorBanner } from '../components/ui/SaveErrorBanner'
import { useEditorStore } from '../store/editorStore'
import { performSave } from '../editor/storageManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner() {
  return render(<SaveErrorBanner />)
}

function setStoreState(patch: Partial<ReturnType<typeof useEditorStore.getState>>) {
  useEditorStore.setState(patch)
}

/**
 * T651.3: build a requestSave that runs the real performSave against a mock editor.
 * Mirrors the closure that initEditor.ts constructs in production.
 */
function makeRequestSave(mockStore: () => Promise<unknown>): (opts?: { timeoutMs?: number }) => Promise<void> {
  const mockEditor = { store: mockStore } as unknown as Editor
  return (opts = {}) => performSave(mockEditor, {
    onStart:   () => { useEditorStore.getState().setIsSaving(true); useEditorStore.getState().setSaveError(null) },
    onSuccess: () => { useEditorStore.getState().setIsSaving(false) },
    onError:   (msg) => { useEditorStore.getState().setIsSaving(false); useEditorStore.getState().setSaveError(msg) },
    timeoutMs: opts.timeoutMs,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveErrorBanner', () => {
  beforeEach(() => {
    useEditorStore.setState({
      saveError: null,
      editor: null,
      requestSave: null,
      isSaving: false,
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

  it('calls requestSave() on Retry and clears error on success (T651.3)', async () => {
    const mockStore = vi.fn().mockResolvedValue(undefined)
    setStoreState({
      saveError: 'Timeout',
      requestSave: makeRequestSave(mockStore),
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(mockStore).toHaveBeenCalledOnce()
      // Banner should be gone after successful retry (onStart cleared, onSuccess left null)
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('updates error message when retry fails (T622 regression, T651.3 path)', async () => {
    const mockStore = vi.fn().mockRejectedValue(new Error('Still failing'))
    setStoreState({
      saveError: 'Original error',
      requestSave: makeRequestSave(mockStore),
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/Still failing/)).toBeTruthy()
    })
  })

  it('T651.3: sets isSaving(true) during retry — fixes pre-T651 missing-feedback bug', async () => {
    // Slow mockStore so we can observe isSaving=true mid-flight
    let resolveStore!: () => void
    const mockStore = vi.fn().mockImplementation(() => new Promise<void>(r => { resolveStore = r }))
    setStoreState({
      saveError: 'Timeout',
      requestSave: makeRequestSave(mockStore),
    })
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    // onStart fires synchronously before the promise awaits — isSaving must be true.
    await waitFor(() => expect(useEditorStore.getState().isSaving).toBe(true))

    resolveStore()
    await waitFor(() => expect(useEditorStore.getState().isSaving).toBe(false))
  })

  it('does nothing when Retry is clicked without a requestSave closure (editor not ready)', () => {
    setStoreState({ saveError: 'No editor yet', requestSave: null })
    renderBanner()
    // Should not throw
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    // Banner remains (error not cleared because requestSave is null)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
