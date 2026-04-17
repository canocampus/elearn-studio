/**
 * Unit tests for EditorCanvas.tsx — T647.4
 *
 * Verifies that pre-navigation save errors surface in the Zustand store
 * (isSaving resets to false, saveError is set) so the SaveErrorBanner
 * component can render the error without relying on console.error alone.
 *
 * Regression: T647 — pre-navigation store() silently logged errors without
 * updating UI state. These tests ensure the regression cannot re-appear.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { useEditorStore } from '../store/editorStore'

// ---------------------------------------------------------------------------
// Hoisted mock factories — must be declared before vi.mock() calls
// ---------------------------------------------------------------------------

const { mockInitEditor, mockSetEditorLoading } = vi.hoisted(() => ({
  mockInitEditor: vi.fn(),
  mockSetEditorLoading: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../editor/initEditor', () => ({
  initEditor: mockInitEditor,
  setEditorLoading: mockSetEditorLoading,
  getEditorLoading: vi.fn().mockReturnValue(false),
}))

vi.mock('../store/actionsStore', () => ({
  useActionsStore: {
    getState: vi.fn().mockReturnValue({ setWidget: vi.fn(), clearWidget: vi.fn() }),
  },
}))

// Sidebar type-guard mocks — none of our test components are special widget types
vi.mock('../components/sidebar/ButtonPropertiesPanel', () => ({ isButtonWidgetType: () => false }))
vi.mock('../components/sidebar/MediaPlayerPropertiesPanel', () => ({ isMediaPlayerWidgetType: () => false }))
vi.mock('../components/sidebar/AudioNarrationPropertiesPanel', () => ({ isAudioNarrationWidgetType: () => false }))
vi.mock('../components/sidebar/ProgressBarPropertiesPanel', () => ({ isProgressBarWidgetType: () => false }))
vi.mock('../components/sidebar/VolumeControlPropertiesPanel', () => ({ isVolumeControlWidgetType: () => false }))
vi.mock('../types/questions', () => ({ isQuestionWidgetType: () => false }))
vi.mock('../types/phaserSim', () => ({ isPhaserSimWidgetType: () => false }))

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { EditorCanvas } from '../components/editor/EditorCanvas'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface MockEditorOptions {
  storeImpl?: () => Promise<unknown>
  loadImpl?: () => Promise<unknown>
}

function makeMockEditor(opts: MockEditorOptions = {}) {
  return {
    store: vi.fn().mockImplementation(opts.storeImpl ?? (() => Promise.resolve(undefined))),
    load: vi.fn().mockImplementation(opts.loadImpl ?? (() => Promise.resolve(undefined))),
    destroy: vi.fn(),
    on: vi.fn(),
    Commands: { isActive: vi.fn().mockReturnValue(false) },
  }
}

function setupInitEditorMock(mockEditor: ReturnType<typeof makeMockEditor>) {
  mockInitEditor.mockImplementation(
    ({ onReady }: { onReady: (ed: unknown) => void }) => {
      onReady(mockEditor)
      return { editor: mockEditor, cleanup: vi.fn() }
    },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorCanvas — T647 pre-navigation save error surfacing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.setState({ isSaving: false, saveError: null, editor: null })
    mockSetEditorLoading.mockReset()
  })

  afterEach(() => {
    mockSetEditorLoading.mockReset()
  })

  it('T647 regression: sets saveError and resets isSaving when store() rejects during slide switch', async () => {
    const mockEditor = makeMockEditor({
      storeImpl: () => Promise.reject(new Error('Network error 503')),
    })
    setupInitEditorMock(mockEditor)

    const { rerender } = render(<EditorCanvas courseId="c1" slideId="s1" />)

    // Wait for Effect 1 (init) + Effect 2 (initial load) to settle
    await waitFor(() => expect(mockEditor.load).toHaveBeenCalledOnce())

    // Switch slide — triggers shouldSaveBeforeSwitch = true
    await act(async () => {
      rerender(<EditorCanvas courseId="c1" slideId="s2" />)
    })

    // store() rejects → saveError must be set, isSaving must reset to false
    await waitFor(() => {
      expect(useEditorStore.getState().saveError).toBe('Network error 503')
      expect(useEditorStore.getState().isSaving).toBe(false)
    })
  })

  it('T647 regression: isSaving resets to false and saveError stays null when store() succeeds', async () => {
    const mockEditor = makeMockEditor({
      storeImpl: () => Promise.resolve(undefined),
    })
    setupInitEditorMock(mockEditor)

    const { rerender } = render(<EditorCanvas courseId="c1" slideId="s1" />)

    await waitFor(() => expect(mockEditor.load).toHaveBeenCalledOnce())

    await act(async () => {
      rerender(<EditorCanvas courseId="c1" slideId="s2" />)
    })

    // store() resolves → no error, isSaving should be false
    await waitFor(() => {
      expect(useEditorStore.getState().saveError).toBeNull()
      expect(useEditorStore.getState().isSaving).toBe(false)
      // load() should also be called for the new slide
      expect(mockEditor.load).toHaveBeenCalledTimes(2)
    })
  })

  it('T647 regression: non-Error rejection produces fallback message in saveError', async () => {
    const mockEditor = makeMockEditor({
      // eslint-disable-next-line prefer-promise-reject-errors
      storeImpl: () => Promise.reject('string rejection'),
    })
    setupInitEditorMock(mockEditor)

    const { rerender } = render(<EditorCanvas courseId="c1" slideId="s1" />)
    await waitFor(() => expect(mockEditor.load).toHaveBeenCalledOnce())

    await act(async () => {
      rerender(<EditorCanvas courseId="c1" slideId="s2" />)
    })

    await waitFor(() => {
      // Non-Error value → fallback message
      expect(useEditorStore.getState().saveError).toBe('Pre-navigation save failed')
      expect(useEditorStore.getState().isSaving).toBe(false)
    })
  })

  it('T647 regression: no store() call and isSaving stays false on initial mount (no previous slide)', async () => {
    const mockEditor = makeMockEditor()
    setupInitEditorMock(mockEditor)

    render(<EditorCanvas courseId="c1" slideId="s1" />)

    await waitFor(() => expect(mockEditor.load).toHaveBeenCalledOnce())

    // On initial mount, prevContextRef is null → shouldSaveBeforeSwitch = false
    expect(mockEditor.store).not.toHaveBeenCalled()
    expect(useEditorStore.getState().isSaving).toBe(false)
    expect(useEditorStore.getState().saveError).toBeNull()
  })
})
