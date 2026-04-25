/**
 * SimulationEditor — TD-014.3 unit tests for the "+ Add step" button.
 *
 * Scope of this file: verify the wiring of the sticky footer button in the
 * left step-list column — rendering, click behaviour, and the disabled state
 * derived from editorStore.isSaving. The behaviour of simStore.addStep itself
 * is covered by simStore.test.ts (TD-014.2).
 *
 * react-konva requires the native `canvas` module at runtime, which jsdom
 * does not provide. We stub it here so importing SimulationEditor (which
 * transitively imports HotspotCanvas → react-konva → konva) stays loadable
 * under vitest's default environment. This mirrors the "no konva in unit
 * tests" convention documented in propsEmptyState.tsx (TD-010).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Editor } from 'grapesjs'
import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { ToastProvider } from '../../components/ui/Toast'
import type { SimConfig } from '../../types/simulation'

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Image: () => null,
  Rect: () => null,
  Transformer: () => null,
}))
vi.mock('konva', () => ({ default: {} }))

// Import AFTER the mocks so they apply.
import { SimulationEditor } from '../../components/simulation/SimulationEditor'

function emptyConfig(): SimConfig {
  return { mode: 'practice', passingScore: 80, steps: [] }
}

/**
 * SimulationEditor renders <StepForm> when config has ≥1 step; StepForm in
 * turn calls `useToast()` (TD-014.4) which requires a ToastProvider.
 */
function renderEditor() {
  return render(<ToastProvider><SimulationEditor /></ToastProvider>)
}

describe('SimulationEditor — TD-014.3 Add Step button', () => {
  beforeEach(() => {
    useSimStore.setState({
      config: null,
      selectedStepIndex: 0,
      panelOpen: false,
      editingComponentId: null,
    })
    useEditorStore.setState({ isSaving: false })
  })

  it('renders the + Add step button when the overlay is open', () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    renderEditor()

    const btn = screen.getByTestId('sim-add-step-btn')
    expect(btn.textContent).toMatch(/add step/i)
  })

  it('appends a new step on click', () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    renderEditor()

    expect(useSimStore.getState().config!.steps).toHaveLength(0)
    fireEvent.click(screen.getByTestId('sim-add-step-btn'))
    expect(useSimStore.getState().config!.steps).toHaveLength(1)
    expect(useSimStore.getState().selectedStepIndex).toBe(0)
  })

  it('is disabled while editorStore.isSaving is true', () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    useEditorStore.setState({ isSaving: true })
    renderEditor()

    const btn = screen.getByTestId('sim-add-step-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('is enabled when editorStore.isSaving is false', () => {
    useSimStore.getState().openPanel(emptyConfig(), 'comp-1')
    useEditorStore.setState({ isSaving: false })
    renderEditor()

    const btn = screen.getByTestId('sim-add-step-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('is present regardless of step count (sticky footer contract)', () => {
    const cfg: SimConfig = {
      mode: 'practice',
      passingScore: 80,
      steps: Array.from({ length: 5 }, (_, i) => ({
        id: `step-${i}`,
        order: i,
        description: `Step ${i + 1}`,
        instruction: '',
        hint: '',
        correctFeedback: '',
        incorrectFeedback: '',
        demoDelay: 1500,
        maxAttempts: -1,
        screenshotKey: '',
        screenshotUrl: '',
        hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
        interactionType: 'click',
      })),
    }
    useSimStore.getState().openPanel(cfg, 'comp-1')
    renderEditor()

    // Sticky footer lives outside the scrollable items region — when there
    // are many steps it must still be queryable by test id (i.e. present in
    // the DOM, not removed by overflow).
    expect(screen.getByTestId('sim-add-step-btn')).toBeDefined()
  })
})

// ── TD-014.7b — drag-drop reorder + keyboard fallback ─────────────────────────

function configWithSteps(stepCount: number): SimConfig {
  return {
    mode: 'practice',
    passingScore: 80,
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i}`,
      order: i,
      description: `Step ${i + 1}`,
      instruction: '',
      hint: '',
      correctFeedback: '',
      incorrectFeedback: '',
      demoDelay: 1500,
      maxAttempts: -1,
      screenshotKey: '',
      screenshotUrl: '',
      hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
      interactionType: 'click',
    })),
  }
}

describe('SimulationEditor — TD-014.7b drag-drop reorder', () => {
  beforeEach(() => {
    useSimStore.setState({
      config: null,
      selectedStepIndex: 0,
      panelOpen: false,
      editingComponentId: null,
    })
    useEditorStore.setState({ isSaving: false })
  })

  it('each step item is draggable', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    expect(items).toHaveLength(3)
    items.forEach(item => expect(item.getAttribute('draggable')).toBe('true'))
  })

  it('drag step 0 onto step 2 → step-0 lands between step-1 and step-2 (adjustedDropIndex)', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.dragStart(items[0])
    fireEvent.dragOver(items[2])
    fireEvent.drop(items[2])
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    // With dragIndex=0, dropIndex=2: adjusted = 1 → [step-1, step-0, step-2]
    expect(ids).toEqual(['step-1', 'step-0', 'step-2'])
  })

  it('drag step 2 onto step 0 → step-2 goes first', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.dragStart(items[2])
    fireEvent.dragOver(items[0])
    fireEvent.drop(items[0])
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    // dragIndex=2, dropIndex=0, adjusted=0 → [step-2, step-0, step-1]
    expect(ids).toEqual(['step-2', 'step-0', 'step-1'])
  })

  it('drag onto self is a no-op', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.dragStart(items[1])
    fireEvent.dragOver(items[1])
    fireEvent.drop(items[1])
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('dragEnd without drop clears state and does not reorder', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.dragStart(items[0])
    fireEvent.dragOver(items[2])
    fireEvent.dragEnd(items[0])
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('Alt+ArrowDown on focused step moves it down', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.keyDown(items[0], { key: 'ArrowDown', altKey: true })
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-1', 'step-0', 'step-2'])
  })

  it('Alt+ArrowUp on focused step moves it up', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.keyDown(items[2], { key: 'ArrowUp', altKey: true })
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-2', 'step-1'])
  })

  it('Alt+ArrowUp at index 0 is a no-op', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.keyDown(items[0], { key: 'ArrowUp', altKey: true })
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('Alt+ArrowDown at last index is a no-op', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.keyDown(items[2], { key: 'ArrowDown', altKey: true })
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('ArrowDown without Alt does not reorder (modifier required)', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('the ↑ ↓ icon buttons still work alongside drag-drop (accessibility fallback)', () => {
    useSimStore.getState().openPanel(configWithSteps(3), 'comp-1')
    renderEditor()
    const items = screen.getAllByTestId(/^sim-step-item-/)
    const downBtn = within(items[0]).getByTitle('Move down')
    fireEvent.click(downBtn)
    const ids = useSimStore.getState().config!.steps.map(s => s.id)
    expect(ids).toEqual(['step-1', 'step-0', 'step-2'])
  })
})

// ── TD-014.32 (F11) — handleSave test coverage + safety hardening ──────────────
//
// The production function covers 4 branches that pre-TD-014.32 all ended the
// same way (closePanel + silent console.error). The fix is that each failure
// keeps the overlay open and surfaces the reason via Toast; this suite is the
// contract that pins that behaviour. Mocks mirror the real editorStore shape
// (editor: grapesjs Editor, requestSave: () => Promise<void>) — closest to the
// actual contract so a drift on either side surfaces here first.

interface MockComponent {
  set: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
}

/**
 * Build a minimal GrapesJS Editor stub whose `getWrapper().find(sel)[0]`
 * returns the supplied component (or undefined to simulate a deleted widget).
 * Only the two methods handleSave touches are implemented — cast through
 * `unknown` is the documented pattern (matches `PropsTabRouting.test.tsx`).
 */
function makeMockEditor(component: MockComponent | undefined): Editor {
  return {
    getWrapper: vi.fn().mockReturnValue({
      find: vi.fn().mockReturnValue(component ? [component] : []),
    }),
  } as unknown as Editor
}

function makeMockComponent(): MockComponent {
  return {
    set: vi.fn(),
    get: vi.fn().mockReturnValue({}),
  }
}

function simpleConfig(): SimConfig {
  return {
    mode: 'practice',
    passingScore: 80,
    steps: [{
      id: 'step-0',
      order: 0,
      description: 'Only step',
      instruction: '',
      hint: '',
      correctFeedback: '',
      incorrectFeedback: '',
      demoDelay: 1500,
      maxAttempts: -1,
      screenshotKey: '',
      screenshotUrl: '',
      hotspot: { x: 0, y: 0, width: 0, height: 0, tolerance: 12 },
      interactionType: 'click',
    }],
  }
}

describe('SimulationEditor — TD-014.32 handleSave (F11)', () => {
  beforeEach(() => {
    useSimStore.setState({
      config: null,
      selectedStepIndex: 0,
      panelOpen: false,
      editingComponentId: null,
    })
    useEditorStore.setState({
      editor: null,
      isSaving: false,
      requestSave: null,
    })
  })

  it('happy path — component found + requestSave resolves → closePanel called, no toast', async () => {
    const component = makeMockComponent()
    const requestSave = vi.fn().mockResolvedValue(undefined)
    useEditorStore.setState({ editor: makeMockEditor(component), requestSave })
    useSimStore.getState().openPanel(simpleConfig(), 'comp-1')
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save.*close/i }))

    // requestSave invoked with the updated extendedProperties already on the component.
    await waitFor(() => expect(requestSave).toHaveBeenCalledTimes(1))
    expect(component.set).toHaveBeenCalledWith(
      'extendedProperties',
      expect.objectContaining({ simConfig: expect.objectContaining({ mode: 'practice' }) }),
    )

    // closePanel ran → overlay no longer rendered → sim-add-step-btn gone.
    await waitFor(() => expect(useSimStore.getState().panelOpen).toBe(false))
    expect(screen.queryByTestId('sim-add-step-btn')).toBeNull()

    // No error toast surfaced (role=alert from ToastProvider).
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('component missing — toast error, closePanel NOT called', async () => {
    const requestSave = vi.fn().mockResolvedValue(undefined)
    // find() returns [] → [0] is undefined → handleSave aborts before requestSave.
    useEditorStore.setState({ editor: makeMockEditor(undefined), requestSave })
    useSimStore.getState().openPanel(simpleConfig(), 'comp-1')
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save.*close/i }))

    // Error toast with the exact contractual copy.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/widget no longer exists/i)

    // requestSave never called; panel still open.
    expect(requestSave).not.toHaveBeenCalled()
    expect(useSimStore.getState().panelOpen).toBe(true)
    expect(screen.getByTestId('sim-add-step-btn')).toBeDefined()
  })

  it('requestSave rejects — toast error includes the reason, closePanel NOT called', async () => {
    const component = makeMockComponent()
    const requestSave = vi.fn().mockRejectedValue(new Error('network down'))
    useEditorStore.setState({ editor: makeMockEditor(component), requestSave })
    useSimStore.getState().openPanel(simpleConfig(), 'comp-1')
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save.*close/i }))

    // extendedProperties got set before the save attempt (value is retained
    // on the in-memory component even though the persist step failed).
    await waitFor(() => expect(requestSave).toHaveBeenCalledTimes(1))
    expect(component.set).toHaveBeenCalled()

    // Error toast surfaces the underlying message.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/save failed.*network down/i)

    // Panel stays open so the user can retry / copy content out / Cancel.
    expect(useSimStore.getState().panelOpen).toBe(true)
    expect(screen.getByTestId('sim-add-step-btn')).toBeDefined()
  })

  it('no editor available — silent no-op (no toast, panel stays open)', () => {
    const requestSave = vi.fn()
    // editor is null (beforeEach default); requestSave is set but unreachable.
    useEditorStore.setState({ editor: null, requestSave })
    useSimStore.getState().openPanel(simpleConfig(), 'comp-1')
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save.*close/i }))

    // No side effects: no save attempt, no toast, panel still open.
    expect(requestSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(useSimStore.getState().panelOpen).toBe(true)
  })
})
