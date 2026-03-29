/**
 * Unit tests for initEditor.ts — T706
 *
 * Tests the component:add event handler that enforces absolute positioning and
 * draggability for every component added to the GrapesJS canvas.
 *
 * Focus: verifying the position guard logic — components that already have
 * `position: absolute` must NOT have addStyle() called, while fresh drops
 * (no position set) must receive `{ position: 'absolute' }`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Editor } from 'grapesjs'

// ---------------------------------------------------------------------------
// Mock all initEditor.ts dependencies before importing
// ---------------------------------------------------------------------------

vi.mock('grapesjs', () => ({
  default: {
    init: vi.fn(),
  },
}))

vi.mock('../editor/assetManager', () => ({
  buildAssetManagerConfig: vi.fn().mockReturnValue({}),
}))

vi.mock('../editor/storageManager', () => ({
  registerStorageManager: vi.fn(),
  updateStorageContext: vi.fn(),
  getStorageContext: vi.fn().mockReturnValue({ courseId: 'c1', slideId: 's1' }),
}))

vi.mock('../editor/registerBlocks', () => ({
  registerBlocks: vi.fn(),
}))

vi.mock('../store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn().mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
    }),
  },
}))

import grapesjs from 'grapesjs'
import { initEditor, type InitEditorOptions } from '../editor/initEditor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Captures event handlers registered via editor.on() indexed by event name.
 * Uses arrays so that multiple registrations for the same event are all kept
 * (initEditor.ts registers 'component:add' twice — position guard + autosave).
 */
function makeEventCapture(): {
  handlers: Map<string, Array<(arg: unknown) => void>>
  on: (event: string, cb: (arg: unknown) => void) => void
} {
  const handlers = new Map<string, Array<(arg: unknown) => void>>()
  return {
    handlers,
    on: vi.fn((event: string, cb: (arg: unknown) => void) => {
      const list = handlers.get(event) ?? []
      list.push(cb)
      handlers.set(event, list)
    }),
  }
}

function makeMockFakeEditor(eventCapture: ReturnType<typeof makeEventCapture>): Editor {
  return {
    on: eventCapture.on,
    setDevice: vi.fn(),
    StorageManager: { add: vi.fn() },
    Commands: { isActive: vi.fn().mockReturnValue(false) },
    store: vi.fn().mockResolvedValue(undefined),
  } as unknown as Editor
}

function defaultOpts(): InitEditorOptions {
  return {
    container: document.createElement('div'),
    courseId: 'course-1',
    slideId: 'slide-1',
    blockManagerContainer: '#bm',
    layerManagerContainer: '#lm',
    styleManagerContainer: '#sm',
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('T706 — initEditor component:add position guard', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>

  beforeEach(() => {
    vi.clearAllMocks()
    eventCapture = makeEventCapture()
    const fakeEditor = makeMockFakeEditor(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
  })

  function getComponentAddHandler(): (component: unknown) => void {
    initEditor(defaultOpts())
    const handlerList = eventCapture.handlers.get('component:add') ?? []
    if (handlerList.length === 0) throw new Error('component:add handler was not registered')
    // Invoke ALL registered handlers (initEditor registers component:add twice:
    // once for position/drag logic and once for autosave triggerAutosave)
    return (component: unknown) => handlerList.forEach(h => h(component))
  }

  // ---- T706.1 ----

  it('T706.1: does not call addStyle when component already has position: absolute', () => {
    const handler = getComponentAddHandler()

    const component = {
      set: vi.fn(),
      getStyle: vi.fn().mockReturnValue('absolute'), // already has position
      addStyle: vi.fn(),
    }

    handler(component)

    expect(component.set).toHaveBeenCalledWith({ draggable: true, resizable: true })
    expect(component.addStyle).not.toHaveBeenCalled()
  })

  // ---- T706.2 ----

  it('T706.2: calls addStyle({ position: "absolute" }) when component has no position set', () => {
    const handler = getComponentAddHandler()

    const component = {
      set: vi.fn(),
      getStyle: vi.fn().mockReturnValue(''), // no position
      addStyle: vi.fn(),
    }

    handler(component)

    expect(component.addStyle).toHaveBeenCalledWith({ position: 'absolute' })
  })

  it('T706.2b: calls addStyle({ position: "absolute" }) when getStyle returns null/undefined', () => {
    const handler = getComponentAddHandler()

    const component = {
      set: vi.fn(),
      getStyle: vi.fn().mockReturnValue(undefined),
      addStyle: vi.fn(),
    }

    handler(component)

    expect(component.addStyle).toHaveBeenCalledWith({ position: 'absolute' })
  })

  // ---- T706.3 ----

  it('T706.3: three widgets loaded from JSON all receive draggable+resizable; only widgets without position get addStyle', () => {
    const handler = getComponentAddHandler()

    const widgetsFromLoad = [
      // Already positioned (loaded from saved slide)
      { set: vi.fn(), getStyle: vi.fn().mockReturnValue('absolute'), addStyle: vi.fn() },
      { set: vi.fn(), getStyle: vi.fn().mockReturnValue('absolute'), addStyle: vi.fn() },
      // Freshly dragged (no position yet)
      { set: vi.fn(), getStyle: vi.fn().mockReturnValue(''), addStyle: vi.fn() },
    ]

    widgetsFromLoad.forEach(w => handler(w))

    // All three must get draggable + resizable
    widgetsFromLoad.forEach(w => {
      expect(w.set).toHaveBeenCalledWith({ draggable: true, resizable: true })
    })

    // Only the third (no position) should get addStyle
    expect(widgetsFromLoad[0].addStyle).not.toHaveBeenCalled()
    expect(widgetsFromLoad[1].addStyle).not.toHaveBeenCalled()
    expect(widgetsFromLoad[2].addStyle).toHaveBeenCalledWith({ position: 'absolute' })
  })

  // ---- T706.4 ----

  it('T706.4: question-mc component loaded from JSON with position set does not get addStyle', () => {
    const handler = getComponentAddHandler()

    // Simulates a question-mc component that was loaded from saved slide JSON
    // (already has position:absolute from previous save)
    const mcComponent = {
      set: vi.fn(),
      getStyle: vi.fn((prop: string) => prop === 'position' ? 'absolute' : ''),
      addStyle: vi.fn(),
      get: vi.fn((key: string) => key === 'type' ? 'question-mc' : undefined),
    }

    handler(mcComponent)

    expect(mcComponent.set).toHaveBeenCalledWith({ draggable: true, resizable: true })
    expect(mcComponent.addStyle).not.toHaveBeenCalled()
  })

  // ---- T706.5 — non-absolute position values must also get overridden (C-01 regression guard) ----

  it('T706.5a: component with position: relative gets addStyle({ position: "absolute" })', () => {
    // Regression guard for C-01: guard uses !== "absolute", not falsy check.
    // A component with position:relative must be converted — it violates the
    // ToolBook absolute layout model even though getStyle returns a truthy string.
    const handler = getComponentAddHandler()

    const component = {
      set: vi.fn(),
      getStyle: vi.fn().mockReturnValue('relative'),
      addStyle: vi.fn(),
    }

    handler(component)

    expect(component.addStyle).toHaveBeenCalledWith({ position: 'absolute' })
  })

  it('T706.5b: component with position: fixed gets addStyle({ position: "absolute" })', () => {
    const handler = getComponentAddHandler()

    const component = {
      set: vi.fn(),
      getStyle: vi.fn().mockReturnValue('fixed'),
      addStyle: vi.fn(),
    }

    handler(component)

    expect(component.addStyle).toHaveBeenCalledWith({ position: 'absolute' })
  })

  // ---- initEditor returns the editor ----

  it('initEditor() returns the editor object created by grapesjs.init()', () => {
    const fakeEditor = makeMockFakeEditor(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)

    const result = initEditor(defaultOpts())

    expect(result).toBe(fakeEditor)
  })
})
