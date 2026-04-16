/**
 * T644.5 — PhaserSimPropertiesPanel reactive state and save path regression tests.
 *
 * T644.1 regression: useComponentProperty subscription drives panel re-renders
 *   (undo/redo and external Backbone mutations update the UI).
 * T644.2 regression: save flows through comp.set() → component:update → debounced
 *   autosave, NOT via a direct editor.store() call from the panel.
 * T644.3 regression: sceneDefJson textarea stays in sync when ep.sceneDef changes
 *   externally (undo/redo simulation).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PhaserSimPropertiesPanel } from '../../components/sidebar/PhaserSimPropertiesPanel'
import { useEditorStore } from '../../store/editorStore'
import { PHASER_SIM_DEFAULT_EXTENDED } from '../../types/phaserSim'
import type { PhaserSimExtendedProps } from '../../types/phaserSim'

// ── Mock phaserSimStore ───────────────────────────────────────────────────────

const mockOpenPreview = vi.hoisted(() => vi.fn())
vi.mock('../../store/phaserSimStore', () => ({
  usePhaserSimStore: (selector: (s: { openPreview: typeof mockOpenPreview }) => unknown) =>
    selector({ openPreview: mockOpenPreview }),
}))

// ── Mock GrapesJS component (fires real Backbone-style change events) ─────────

type Handler = () => void

function makeComponent(ep: PhaserSimExtendedProps) {
  const props: Record<string, unknown> = {
    type: 'phaser-sim',
    extendedProperties: { ...ep },
  }
  const listeners: Record<string, Set<Handler>> = {}

  const set = vi.fn((key: string, value: unknown): void => {
    props[key] = value
    listeners[`change:${key}`]?.forEach(h => h())
  })

  return {
    get(key: string): unknown { return props[key] },
    set,
    on(event: string, handler: Handler): void {
      if (!listeners[event]) listeners[event] = new Set()
      listeners[event].add(handler)
    },
    off(event: string, handler: Handler): void {
      listeners[event]?.delete(handler)
    },
    getId: vi.fn().mockReturnValue('comp-phaser-1'),
  }
}

/** Editor mock — does NOT expose store() to prove the panel never calls it. */
function makeEditor(comp: ReturnType<typeof makeComponent>) {
  return {
    getSelected: vi.fn().mockReturnValue(comp),
  }
}

// ── Store reset ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks()
  useEditorStore.setState({
    editor: null,
    selectedComponentType: null,
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupAndRender(ep: PhaserSimExtendedProps = PHASER_SIM_DEFAULT_EXTENDED) {
  const comp = makeComponent(ep)
  const editor = makeEditor(comp)
  useEditorStore.setState({
    editor: editor as never,
    selectedComponentType: 'phaser-sim',
  })
  render(<PhaserSimPropertiesPanel />)
  return { comp, editor }
}

// ── T644.1 regression ─────────────────────────────────────────────────────────

describe('T644.1 — useComponentProperty subscription (undo/redo re-renders panel)', () => {
  it('renders with initial extendedProperties from Backbone model', () => {
    setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, simType: 'gamified-quiz', mode: 'assessment' })

    const typeSelect = screen.getByDisplayValue('Gamified Quiz') as HTMLSelectElement
    expect(typeSelect).toBeTruthy()

    const modeSelect = screen.getByDisplayValue('Assessment') as HTMLSelectElement
    expect(modeSelect).toBeTruthy()
  })

  it('re-renders when extendedProperties changes externally (undo regression)', () => {
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, simType: 'process-flow' })

    const typeSelect = screen.getByRole('combobox', { name: /type/i }) as HTMLSelectElement
    expect(typeSelect.value).toBe('process-flow')

    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, simType: 'gamified-quiz' })
    })

    expect(typeSelect.value).toBe('gamified-quiz')
  })

  it('re-renders mode select when extendedProperties changes externally', () => {
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, mode: 'demo' })

    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, mode: 'assessment' })
    })

    const modeSelect = screen.getByDisplayValue('Assessment') as HTMLSelectElement
    expect(modeSelect).toBeTruthy()
  })

  it('re-renders passing score when extendedProperties changes externally', () => {
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, passingScore: 70 })

    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, passingScore: 90 })
    })

    const scoreInput = screen.getByDisplayValue('90') as HTMLInputElement
    expect(scoreInput).toBeTruthy()
  })
})

// ── T644.2 regression ─────────────────────────────────────────────────────────

describe('T644.2 — save path routes through comp.set(), not editor.store() (debounce regression)', () => {
  it('changing simType calls comp.set("extendedProperties", ...) with updated simType', () => {
    const { comp } = setupAndRender()

    const typeSelect = screen.getByRole('combobox', { name: /type/i })
    fireEvent.change(typeSelect, { target: { value: 'gamified-quiz' } })

    expect(comp.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ simType: 'gamified-quiz' }),
    )
  })

  it('changing mode calls comp.set("extendedProperties", ...) with updated mode', () => {
    const { comp } = setupAndRender()

    const modeSelect = screen.getByRole('combobox', { name: /mode/i })
    fireEvent.change(modeSelect, { target: { value: 'assessment' } })

    expect(comp.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ mode: 'assessment' }),
    )
  })

  it('patch-merge: changing simType preserves other EP fields (T639 regression)', () => {
    const initial: PhaserSimExtendedProps = {
      ...PHASER_SIM_DEFAULT_EXTENDED,
      mode: 'assessment',
      passingScore: 85,
    }
    const { comp } = setupAndRender(initial)

    const typeSelect = screen.getByRole('combobox', { name: /type/i })
    fireEvent.change(typeSelect, { target: { value: 'interactive-diagram' } })

    const call = (comp.set as ReturnType<typeof vi.fn>).mock.calls.find(
      ([key]: [string]) => key === 'extendedProperties',
    )
    const saved = call?.[1] as PhaserSimExtendedProps
    expect(saved.simType).toBe('interactive-diagram')
    expect(saved.mode).toBe('assessment')   // preserved
    expect(saved.passingScore).toBe(85)     // preserved
  })

  it('editor has no store() method — panel cannot call it directly (T644.2 architectural proof)', () => {
    // makeEditor() intentionally omits store(). If the panel ever tried to call
    // editor.store(), this test would throw "editor.store is not a function".
    // The fact that the test renders and interacts without error proves the panel
    // no longer calls editor.store() directly.
    const { comp } = setupAndRender()

    const typeSelect = screen.getByRole('combobox', { name: /type/i })
    expect(() => {
      fireEvent.change(typeSelect, { target: { value: 'gamified-quiz' } })
    }).not.toThrow()

    expect(comp.set).toHaveBeenCalled()
  })
})

// ── T644.3 regression ─────────────────────────────────────────────────────────

describe('T644.3 — sceneDefJson textarea stays in sync after external Backbone change', () => {
  it('textarea is empty when sceneDef is null on mount', () => {
    setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: null })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('textarea shows JSON when sceneDef is set on mount', () => {
    const sceneDef = { simType: 'process-flow', nodes: [] }
    setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe(JSON.stringify(sceneDef, null, 2))
  })

  it('textarea updates when sceneDef changes externally (undo regression)', () => {
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: null })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    const newSceneDef = { simType: 'process-flow', nodes: [{ id: 'n1' }] }

    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: newSceneDef })
    })

    expect(textarea.value).toBe(JSON.stringify(newSceneDef, null, 2))
  })

  it('textarea clears when sceneDef is reverted to null externally (undo past initial state)', () => {
    const initialSceneDef = { simType: 'process-flow', nodes: [] }
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: initialSceneDef })

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe(JSON.stringify(initialSceneDef, null, 2))

    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: null })
    })

    expect(textarea.value).toBe('')
  })

  it('jsonError resets to false when sceneDef changes externally after a parse error', () => {
    const { comp } = setupAndRender({ ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: null })

    // Simulate user typing invalid JSON, then blurring
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{ bad json' } })
    fireEvent.blur(textarea)

    expect(screen.getByText(/Invalid JSON/i)).toBeTruthy()

    // Simulate undo restoring a valid sceneDef
    act(() => {
      comp.set('extendedProperties', { ...PHASER_SIM_DEFAULT_EXTENDED, sceneDef: { simType: 'process-flow' } })
    })

    expect(screen.queryByText(/Invalid JSON/i)).toBeNull()
  })
})

// ── Panel visibility guard ────────────────────────────────────────────────────

describe('PhaserSimPropertiesPanel — visibility guard', () => {
  it('renders nothing when editor is null', () => {
    useEditorStore.setState({ editor: null, selectedComponentType: null })
    const { container } = render(<PhaserSimPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when selectedComponentType is not phaser-sim', () => {
    const comp = makeComponent(PHASER_SIM_DEFAULT_EXTENDED)
    const editor = makeEditor(comp)
    useEditorStore.setState({ editor: editor as never, selectedComponentType: 'text' })
    const { container } = render(<PhaserSimPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders panel when editor is set and selectedComponentType is phaser-sim', () => {
    setupAndRender()
    expect(screen.getByTestId('phaser-sim-properties-panel')).toBeTruthy()
  })
})
