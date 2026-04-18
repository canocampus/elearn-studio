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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// T651.2: keep real performSave so triggerAutosave still reaches editor.store()
// under test. Only registerStorageManager is mocked — its real impl calls
// editor.StorageManager.add() which needs a full GrapesJS editor we don't have.
vi.mock('../editor/storageManager', async () => {
  const actual = await vi.importActual<typeof import('../editor/storageManager')>('../editor/storageManager')
  return {
    ...actual,
    registerStorageManager: vi.fn().mockReturnValue(vi.fn()),
  }
})

vi.mock('../editor/registerBlocks', () => ({
  registerBlocks: vi.fn(),
}))

vi.mock('../store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn().mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
      setEditorContext: vi.fn(),
      bumpCacheVersion: vi.fn(),
      courseId: 'c1',
      slideId: 's1',
      cacheVersion: 0,
    }),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

import grapesjs from 'grapesjs'
import { initEditor, setEditorLoading, type InitEditorOptions } from '../editor/initEditor'

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
    Commands: { isActive: vi.fn().mockReturnValue(false), add: vi.fn() },
    Keymaps: { add: vi.fn() },
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
    return (component: unknown) => handlerList.forEach((h) => h(component))
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

    widgetsFromLoad.forEach((w) => handler(w))

    // All three must get draggable + resizable
    widgetsFromLoad.forEach((w) => {
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
      getStyle: vi.fn((prop: string) => (prop === 'position' ? 'absolute' : '')),
      addStyle: vi.fn(),
      get: vi.fn((key: string) => (key === 'type' ? 'question-mc' : undefined)),
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

    expect(result.editor).toBe(fakeEditor)
  })
})

// ---------------------------------------------------------------------------
// T800 — triggerAutosave: RTE-active defer + rte:disable trigger
//
// T637.2 fix: GrapesJS v0.21.13 does NOT register a 'text-edit' command.
// Commands.isActive('text-edit') always returns false — the T611 fix and the
// first T637.2 guard were both no-ops. Text editing is tracked via rte:enable /
// rte:disable events from the RichTextEditor module.
// ---------------------------------------------------------------------------

import { useEditorStore } from '../store/editorStore'

/**
 * Mock editor for T637.2 / T800 tests.
 * stopCommand is present only to assert it is NEVER called (regression guard).
 */
function makeMockEditorWithStopCommand(eventCapture: ReturnType<typeof makeEventCapture>): Editor {
  return {
    on: eventCapture.on,
    setDevice: vi.fn(),
    StorageManager: { add: vi.fn() },
    Commands: { isActive: vi.fn().mockReturnValue(false), add: vi.fn() },
    Keymaps: { add: vi.fn() },
    stopCommand: vi.fn(),
    store: vi.fn().mockResolvedValue(undefined),
  } as unknown as Editor
}

describe('T800 — triggerAutosave: RTE-active defer + rte:disable trigger', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let fakeEditor: Editor

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    eventCapture = makeEventCapture()
    fakeEditor = makeMockEditorWithStopCommand(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
    vi.mocked(useEditorStore.getState).mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
      setEditorContext: vi.fn(),
      bumpCacheVersion: vi.fn(),
      courseId: 'c1',
      slideId: 's1',
      cacheVersion: 0,
    } as unknown as ReturnType<typeof useEditorStore.getState>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Fire component:update and advance past the 2 s debounce. */
  async function triggerAndWait() {
    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    if (updateHandlers.length === 0) throw new Error('component:update handler not registered')
    updateHandlers.forEach((h) => h({}))
    await vi.advanceTimersByTimeAsync(2001)
  }

  // ---- T800.1 — autosave is deferred when RTE is active (T637.2) ----

  it('T800.1: store() is NOT called when rte:enable has fired — autosave is deferred', async () => {
    initEditor(defaultOpts())

    // Simulate user double-clicking a Text widget (enters text-edit mode)
    const rteEnableHandlers = eventCapture.handlers.get('rte:enable') ?? []
    expect(rteEnableHandlers.length).toBeGreaterThan(0)
    rteEnableHandlers.forEach((h) => h({}))

    // Autosave trigger arrives while user is still typing
    await triggerAndWait()

    // RTE is active → autosave must be deferred, stopCommand must NOT be called
    expect(fakeEditor.stopCommand).not.toHaveBeenCalled()
    expect(fakeEditor.store).not.toHaveBeenCalled()
  })

  // ---- T800.1b — rte:disable triggers autosave ----

  it('T800.1b: store() IS called when rte:disable fires (user exits text-edit)', async () => {
    initEditor(defaultOpts())

    // Enter text-edit, then exit
    const rteEnableHandlers = eventCapture.handlers.get('rte:enable') ?? []
    rteEnableHandlers.forEach((h) => h({}))

    const rteDisableHandlers = eventCapture.handlers.get('rte:disable') ?? []
    expect(rteDisableHandlers.length).toBeGreaterThan(0)
    // rte:disable handlers: [isRteActive=false, triggerAutosave, ...diagnostic]
    rteDisableHandlers.forEach((h) => h({}))

    // Advance past the 2 s debounce started by triggerAutosave above
    await vi.advanceTimersByTimeAsync(2001)

    expect(fakeEditor.store).toHaveBeenCalledOnce()
  })

  // ---- T800.2 — autosave runs normally when RTE is not active ----

  it('T800.2: store() IS called and stopCommand is NOT called when RTE is inactive', async () => {
    initEditor(defaultOpts())
    // RTE never activated — isRteActive stays false
    await triggerAndWait()

    expect(fakeEditor.stopCommand).not.toHaveBeenCalled()
    expect(fakeEditor.store).toHaveBeenCalledOnce()
  })

  // ---- CRITICAL-01 — context mismatch aborts autosave ----

  it('CRITICAL-01: store() is NOT called when courseId changes during debounce', async () => {
    initEditor(defaultOpts())
    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    updateHandlers.forEach((h) => h({}))

    // Simulate slide switch mid-debounce: context changes before timer fires
    vi.mocked(useEditorStore.getState).mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
      setEditorContext: vi.fn(),
      bumpCacheVersion: vi.fn(),
      courseId: 'c1',
      slideId: 's2',
      cacheVersion: 0,
    } as unknown as ReturnType<typeof useEditorStore.getState>)

    await vi.advanceTimersByTimeAsync(2001)

    expect(fakeEditor.store).not.toHaveBeenCalled()
    expect(fakeEditor.stopCommand).not.toHaveBeenCalled()
  })

  it('CRITICAL-01b: store() is NOT called when slideId changes during debounce', async () => {
    initEditor(defaultOpts())
    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    updateHandlers.forEach((h) => h({}))

    vi.mocked(useEditorStore.getState).mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
      setEditorContext: vi.fn(),
      bumpCacheVersion: vi.fn(),
      courseId: 'c2',
      slideId: 's1',
      cacheVersion: 0,
    } as unknown as ReturnType<typeof useEditorStore.getState>)

    await vi.advanceTimersByTimeAsync(2001)

    expect(fakeEditor.store).not.toHaveBeenCalled()
  })

  // ---- debounce resets on rapid events ----

  it('T800.3: rapid events debounce to a single store() call', async () => {
    initEditor(defaultOpts())
    const updateHandlers = eventCapture.handlers.get('component:update') ?? []

    // Fire 5 events in quick succession (each resets the timer)
    for (let i = 0; i < 5; i++) {
      updateHandlers.forEach((h) => h({}))
      await vi.advanceTimersByTimeAsync(500)
    }

    // Not yet fired (still within debounce window after last event)
    expect(fakeEditor.store).not.toHaveBeenCalled()

    // Advance past debounce window
    await vi.advanceTimersByTimeAsync(2001)

    expect(fakeEditor.store).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// T630 Phase 5 — block:drag:stop uses clientX/Y / zoomDecimal (correct formula)
//
// Phase 1 bug: listened to 'mousemove' on main document — suppressed during DnD.
// Phase 2 bug: getMouseRelativePos — formula adds iframeRect offset to clientX/Y which
//   are already viewport-relative (the iframe has its own coordinate space).
// Phase 3 bug: getMouseRelativeCanvas — adds frameOffset.left (+93px) to X.
// Phase 4 bug: subtracted iframeRect.left from clientX — debug misread; clientX from
//   iframeDoc events is already canvas-relative (iframe has its own coordinate space);
//   subtracting offset shifted widgets 93px to the left.
//
// Phase 5 fix: clientX/Y from iframeDoc dragover events ARE canvas coordinates.
//   Divide by getZoomDecimal() (zoom/100) to account for canvas zoom.
//   At 100% zoom (default): zoomDecimal=1 → x=clientX, y=clientY.
// ---------------------------------------------------------------------------

describe('T630 — block:drag:stop iframe dragover coordinates', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let capturedHandlers: Map<string, (e: Event) => void>
  let mockAddEventListener: ReturnType<typeof vi.fn>
  let mockRemoveEventListener: ReturnType<typeof vi.fn>
  let mockGetZoomDecimal: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    eventCapture = makeEventCapture()
    capturedHandlers = new Map()
    mockAddEventListener = vi.fn((event: string, handler: (e: Event) => void) => {
      capturedHandlers.set(event, handler)
    })
    mockRemoveEventListener = vi.fn()
    mockGetZoomDecimal = vi.fn().mockReturnValue(1) // 100% zoom by default

    const mockIframeDoc = {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    }

    const fakeEditor = {
      on: eventCapture.on,
      setDevice: vi.fn(),
      StorageManager: { add: vi.fn() },
      Commands: { isActive: vi.fn().mockReturnValue(false), add: vi.fn() },
      Keymaps: { add: vi.fn() },
      store: vi.fn().mockResolvedValue(undefined),
      Canvas: {
        getFrameEl: vi.fn().mockReturnValue({ contentDocument: mockIframeDoc }),
        getZoomDecimal: mockGetZoomDecimal,
      },
    } as unknown as Editor

    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
  })

  function setup() {
    initEditor(defaultOpts())
  }

  function fire(name: string, arg?: unknown) {
    const handlers = eventCapture.handlers.get(name) ?? []
    handlers.forEach((h) => h(arg))
  }

  it('T630.1: block:drag:start registers dragover listener on iframe document', () => {
    setup()
    fire('block:drag:start')
    expect(mockAddEventListener).toHaveBeenCalledWith('dragover', expect.any(Function))
  })

  it('T630.2: block:drag:stop removes dragover listener from iframe document', () => {
    setup()
    fire('block:drag:start')
    const comp = { addStyle: vi.fn() }
    fire('block:drag:stop', comp)
    expect(mockRemoveEventListener).toHaveBeenCalledWith('dragover', expect.any(Function))
  })

  it('T630.3: block:drag:stop calls addStyle with clientX/Y directly (at zoom=1)', () => {
    setup()
    fire('block:drag:start')

    // clientX/Y from iframeDoc events are canvas-relative at zoom=1
    const dragoverFn = capturedHandlers.get('dragover')!
    dragoverFn({ clientX: 400, clientY: 300, target: {} } as unknown as Event)

    const comp = { addStyle: vi.fn() }
    fire('block:drag:stop', comp)

    expect(comp.addStyle).toHaveBeenCalledWith({ left: '400px', top: '300px' })
  })

  it('T630.4: block:drag:stop skips addStyle when no dragover was captured (Slide 2+ regression guard)', () => {
    // Critical regression: on Slide 2+ lastDragEvent was null because the main-doc
    // mousemove never fired. The handler must bail early (not crash/set 0,0).
    setup()
    fire('block:drag:start')
    // No dragover event — lastDragEvent stays null

    const comp = { addStyle: vi.fn() }
    fire('block:drag:stop', comp)

    expect(comp.addStyle).not.toHaveBeenCalled()
  })

  it('T630.5: block:drag:stop skips addStyle when component is undefined (cancelled drag)', () => {
    setup()
    fire('block:drag:start')

    capturedHandlers.get('dragover')!({ clientX: 400, clientY: 300 } as unknown as Event)

    // component = undefined → drag cancelled, not dropped on canvas
    fire('block:drag:stop', undefined)

    expect(mockGetZoomDecimal).not.toHaveBeenCalled()
  })

  it('T630.6: second drag correctly re-registers listener and applies fresh coordinates', () => {
    setup()

    // First drag cycle
    fire('block:drag:start')
    capturedHandlers.get('dragover')!({ clientX: 200, clientY: 150 } as unknown as Event)
    const comp1 = { addStyle: vi.fn() }
    fire('block:drag:stop', comp1)
    expect(comp1.addStyle).toHaveBeenCalledWith({ left: '200px', top: '150px' })

    // Second drag cycle — listener must be re-registered and new coordinates applied
    fire('block:drag:start')
    capturedHandlers.get('dragover')!({ clientX: 700, clientY: 500 } as unknown as Event)
    const comp2 = { addStyle: vi.fn() }
    fire('block:drag:stop', comp2)
    expect(comp2.addStyle).toHaveBeenCalledWith({ left: '700px', top: '500px' })
  })

  it('T630.7: coordinates are rounded to integers (Math.round applied)', () => {
    setup()
    fire('block:drag:start')
    capturedHandlers.get('dragover')!({ clientX: 350.7, clientY: 249.3 } as unknown as Event)
    const comp = { addStyle: vi.fn() }
    fire('block:drag:stop', comp)
    expect(comp.addStyle).toHaveBeenCalledWith({ left: '351px', top: '249px' })
  })

  it('T630.8: coordinates are divided by zoom when canvas is zoomed (regression guard)', () => {
    mockGetZoomDecimal.mockReturnValue(0.5) // 50% zoom
    setup()
    fire('block:drag:start')
    // At 50% zoom, clientX=300 in the iframe maps to canvas coordinate 600
    capturedHandlers.get('dragover')!({ clientX: 300, clientY: 200 } as unknown as Event)
    const comp = { addStyle: vi.fn() }
    fire('block:drag:stop', comp)
    expect(comp.addStyle).toHaveBeenCalledWith({ left: '600px', top: '400px' })
  })
})

// ---------------------------------------------------------------------------
// T636 — elearn:copy and elearn:paste commands with cross-slide position preservation
// ---------------------------------------------------------------------------

import { getClipboard, clearClipboard } from '../editor/clipboard'

describe('T636 — elearn:copy and elearn:paste commands', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let fakeEditor: Editor
  let registeredCommands: Map<string, { run: (ed: Editor) => void }>
  let keymapRegistrations: Array<[string, string, string]>

  beforeEach(() => {
    vi.clearAllMocks()
    clearClipboard()
    eventCapture = makeEventCapture()
    registeredCommands = new Map()
    keymapRegistrations = []

    fakeEditor = {
      on: eventCapture.on,
      setDevice: vi.fn(),
      StorageManager: { add: vi.fn() },
      Commands: {
        isActive: vi.fn().mockReturnValue(false),
        add: vi.fn((name: string, def: { run: (ed: Editor) => void }) => {
          registeredCommands.set(name, def)
        }),
      },
      Keymaps: {
        add: vi.fn((id: string, keys: string, command: string) => {
          keymapRegistrations.push([id, keys, command])
        }),
      },
      store: vi.fn().mockResolvedValue(undefined),
    } as unknown as Editor

    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
  })

  function setup() {
    initEditor(defaultOpts())
  }

  function runCommand(name: string) {
    const def = registeredCommands.get(name)
    if (!def) throw new Error(`Command ${name} not registered`)
    def.run(fakeEditor)
  }

  // ---- T636.1 — elearn:copy command is registered ----

  it('T636.1: registers elearn:copy command', () => {
    setup()
    expect(registeredCommands.has('elearn:copy')).toBe(true)
  })

  it('T636.2: registers elearn:paste command', () => {
    setup()
    expect(registeredCommands.has('elearn:paste')).toBe(true)
  })

  // ---- T636.3 — keymaps are registered at editor context ----

  it('T636.3a: registers ctrl+c keymap bound to elearn:copy', () => {
    setup()
    const entry = keymapRegistrations.find(([, keys]) => keys === 'ctrl+c')
    expect(entry).toBeDefined()
    expect(entry![2]).toBe('elearn:copy')
  })

  it('T636.3b: registers ctrl+v keymap bound to elearn:paste', () => {
    setup()
    const entry = keymapRegistrations.find(([, keys]) => keys === 'ctrl+v')
    expect(entry).toBeDefined()
    expect(entry![2]).toBe('elearn:paste')
  })

  // ---- T636.4 — copy captures style and definition ----

  it('T636.4: elearn:copy stores style and component definition in module clipboard', () => {
    const mockComponent = {
      getStyle: vi
        .fn()
        .mockReturnValue({ left: '300px', top: '200px', width: '150px', height: '60px' }),
      toJSON: vi.fn().mockReturnValue({ type: 'text', content: 'Hello' }),
    }
    ;(fakeEditor as unknown as { getSelected: () => unknown }).getSelected = vi
      .fn()
      .mockReturnValue(mockComponent)

    setup()
    runCommand('elearn:copy')

    const entry = getClipboard()
    expect(entry).not.toBeNull()
    expect(entry!.style).toEqual({ left: '300px', top: '200px', width: '150px', height: '60px' })
    expect(entry!.definition).toEqual({ type: 'text', content: 'Hello' })
  })

  it('T636.4b: elearn:copy does nothing when no component is selected', () => {
    ;(fakeEditor as unknown as { getSelected: () => unknown }).getSelected = vi
      .fn()
      .mockReturnValue(null)

    setup()
    runCommand('elearn:copy')

    expect(getClipboard()).toBeNull()
  })

  // ---- T636.5 — paste recreates component with position ----

  it('T636.5: elearn:paste adds component and applies left/top/width/height from clipboard', () => {
    const mockAdded = { addStyle: vi.fn() }
    ;(fakeEditor as unknown as { getComponents: () => unknown }).getComponents = vi
      .fn()
      .mockReturnValue({
        add: vi.fn().mockReturnValue(mockAdded),
      })

    // Prime clipboard first
    const mockComponent = {
      getStyle: vi
        .fn()
        .mockReturnValue({ left: '300px', top: '200px', width: '150px', height: '60px' }),
      toJSON: vi.fn().mockReturnValue({ type: 'text', content: 'Hello' }),
    }
    ;(fakeEditor as unknown as { getSelected: () => unknown }).getSelected = vi
      .fn()
      .mockReturnValue(mockComponent)

    setup()
    runCommand('elearn:copy')
    runCommand('elearn:paste')

    expect(mockAdded.addStyle).toHaveBeenCalledWith({
      left: '300px',
      top: '200px',
      width: '150px',
      height: '60px',
    })
  })

  it('T636.5b: elearn:paste does nothing when clipboard is empty', () => {
    const mockComponents = { add: vi.fn() }
    ;(fakeEditor as unknown as { getComponents: () => unknown }).getComponents = vi
      .fn()
      .mockReturnValue(mockComponents)

    setup()
    // clipboard is empty (clearClipboard() called in beforeEach)
    runCommand('elearn:paste')

    expect(mockComponents.add).not.toHaveBeenCalled()
  })

  it('T636.5c: elearn:paste uses defaults when style fields are missing', () => {
    const mockAdded = { addStyle: vi.fn() }
    ;(fakeEditor as unknown as { getComponents: () => unknown }).getComponents = vi
      .fn()
      .mockReturnValue({
        add: vi.fn().mockReturnValue(mockAdded),
      })

    // Clipboard has no width/height
    const mockComponent = {
      getStyle: vi.fn().mockReturnValue({ left: '100px', top: '50px' }),
      toJSON: vi.fn().mockReturnValue({ type: 'image' }),
    }
    ;(fakeEditor as unknown as { getSelected: () => unknown }).getSelected = vi
      .fn()
      .mockReturnValue(mockComponent)

    setup()
    runCommand('elearn:copy')
    runCommand('elearn:paste')

    expect(mockAdded.addStyle).toHaveBeenCalledWith({
      left: '100px',
      top: '50px',
      width: '100px', // default
      height: '50px', // default
    })
  })
})

// ---------------------------------------------------------------------------
// T646.6 — Cleanup lifecycle: timer cancellation, listener removal, isUnmounted guard
// ---------------------------------------------------------------------------

describe('T646.6 — initEditor cleanup lifecycle', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let fakeEditor: Editor
  let mockBlockContainer: {
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }
  let cleanupFn: () => void
  let querySelectorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    eventCapture = makeEventCapture()
    mockBlockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    querySelectorSpy = vi
      .spyOn(document, 'querySelector')
      .mockReturnValue(mockBlockContainer as unknown as HTMLElement)

    fakeEditor = makeMockFakeEditor(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)

    const result = initEditor(defaultOpts())
    cleanupFn = result.cleanup
  })

  afterEach(() => {
    vi.useRealTimers()
    querySelectorSpy.mockRestore()
    setEditorLoading(false)
  })

  it('T646.6.1: cleanup() calls removeEventListener for dragstart exactly once', () => {
    cleanupFn()
    expect(mockBlockContainer.removeEventListener).toHaveBeenCalledTimes(1)
    expect(mockBlockContainer.removeEventListener).toHaveBeenCalledWith(
      'dragstart',
      expect.any(Function)
    )
  })

  it('T646.6.2: cleanup() prevents pending autosave from firing after destroy', () => {
    // Trigger autosave debounce timer via component:update
    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    updateHandlers.forEach((h) => h({}))

    // Advance partway through debounce — timer is live
    vi.advanceTimersByTime(500)

    cleanupFn()

    // Run the full remaining time — without cleanup, store() would fire here
    vi.runAllTimers()

    expect(fakeEditor.store).not.toHaveBeenCalled()
  })

  it('T646.6.3: dragstart listener count stays 1 after 3 init/destroy cycles (no accumulation)', () => {
    // Cycle 1 already done in beforeEach. Verify 1 registration so far.
    expect(mockBlockContainer.addEventListener).toHaveBeenCalledTimes(1)

    // Cycle 2
    cleanupFn()
    expect(mockBlockContainer.removeEventListener).toHaveBeenCalledTimes(1)

    const ec2 = makeEventCapture()
    const fe2 = makeMockFakeEditor(ec2)
    vi.mocked(grapesjs.init).mockReturnValue(fe2)
    mockBlockContainer.addEventListener.mockClear()
    mockBlockContainer.removeEventListener.mockClear()

    const r2 = initEditor(defaultOpts())
    expect(mockBlockContainer.addEventListener).toHaveBeenCalledTimes(1)

    // Cycle 3
    r2.cleanup()
    expect(mockBlockContainer.removeEventListener).toHaveBeenCalledTimes(1)

    const ec3 = makeEventCapture()
    const fe3 = makeMockFakeEditor(ec3)
    vi.mocked(grapesjs.init).mockReturnValue(fe3)
    mockBlockContainer.addEventListener.mockClear()
    mockBlockContainer.removeEventListener.mockClear()

    const r3 = initEditor(defaultOpts())
    expect(mockBlockContainer.addEventListener).toHaveBeenCalledTimes(1)
    r3.cleanup()
    expect(mockBlockContainer.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('T646.6.4: isUnmounted prevents ghost DOM removal in rAF after cleanup', () => {
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)

    cleanupFn()

    // Flush any requestAnimationFrame callbacks — they must exit early (isUnmounted === true)
    vi.runAllTimers()

    expect(removeChildSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T650.3 — hasPendingChanges reflects autosave timer state
//
// hasPendingChanges() is a pure closure over autosaveTimer:
//   - null        → returns false (idle / just saved)
//   - !== null    → returns true  (2 s debounce in flight)
// It exists so that EditorCanvas can wire a beforeunload warning (T650.2)
// without forcing a synchronous store() on tab close.
// ---------------------------------------------------------------------------

describe('T650.3 — hasPendingChanges reflects autosave timer state', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let fakeEditor: Editor

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    eventCapture = makeEventCapture()
    fakeEditor = makeMockFakeEditor(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
    vi.mocked(useEditorStore.getState).mockReturnValue({
      setIsSaving: vi.fn(),
      setSaveError: vi.fn(),
      setEditorContext: vi.fn(),
      bumpCacheVersion: vi.fn(),
      courseId: 'c1',
      slideId: 's1',
      cacheVersion: 0,
    } as unknown as ReturnType<typeof useEditorStore.getState>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('T650.3.1: returns false when autosaveTimer is null (no debounce pending)', () => {
    const { hasPendingChanges } = initEditor(defaultOpts())
    expect(hasPendingChanges()).toBe(false)
  })

  it('T650.3.2: returns true after component:update fires (debounce in flight)', () => {
    const { hasPendingChanges } = initEditor(defaultOpts())

    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    expect(updateHandlers.length).toBeGreaterThan(0)
    updateHandlers.forEach((h) => h({}))

    expect(hasPendingChanges()).toBe(true)
  })

  it('T650.3.3: returns false after store() completes (timer cleared)', async () => {
    const { hasPendingChanges } = initEditor(defaultOpts())

    const updateHandlers = eventCapture.handlers.get('component:update') ?? []
    updateHandlers.forEach((h) => h({}))
    expect(hasPendingChanges()).toBe(true)

    // Advance past the 2 s debounce so the scheduled store() runs and clears the timer.
    await vi.advanceTimersByTimeAsync(2001)

    expect(fakeEditor.store).toHaveBeenCalledOnce()
    expect(hasPendingChanges()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TD-007 — requestCourseMutation closure binds performCourseMutation to Zustand
//
// The closure is constructed inside initEditor() and returned alongside
// requestSave. It wires:
//   - setIsSaving(true)/setSaveError(null) on onStart
//   - setIsSaving(false) + (bumpCacheVersion IF opts.bumpCache !== false) on onSuccess
//   - setIsSaving(false)/setSaveError(msg) on onError
// These tests verify the wiring against mock Zustand setters.
// ---------------------------------------------------------------------------

describe('TD-007 — requestCourseMutation closure wires Zustand state and cache bump', () => {
  let eventCapture: ReturnType<typeof makeEventCapture>
  let fakeEditor: Editor
  let setIsSaving: ReturnType<typeof vi.fn>
  let setSaveError: ReturnType<typeof vi.fn>
  let bumpCacheVersion: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    eventCapture = makeEventCapture()
    fakeEditor = makeMockFakeEditor(eventCapture)
    vi.mocked(grapesjs.init).mockReturnValue(fakeEditor)
    setIsSaving = vi.fn()
    setSaveError = vi.fn()
    bumpCacheVersion = vi.fn()
    vi.mocked(useEditorStore.getState).mockReturnValue({
      setIsSaving,
      setSaveError,
      setEditorContext: vi.fn(),
      bumpCacheVersion,
      courseId: 'c1',
      slideId: 's1',
      cacheVersion: 0,
    } as unknown as ReturnType<typeof useEditorStore.getState>)
  })

  it('TD-007.1: success path → setIsSaving(true), then bumpCacheVersion + setIsSaving(false); setSaveError(null) at start', async () => {
    const { requestCourseMutation } = initEditor(defaultOpts())

    const result = await requestCourseMutation(async () => ({ _id: 'c1', slides: [] }))

    expect(result).toEqual({ _id: 'c1', slides: [] })
    // Start
    expect(setIsSaving).toHaveBeenNthCalledWith(1, true)
    expect(setSaveError).toHaveBeenCalledWith(null)
    // Success
    expect(bumpCacheVersion).toHaveBeenCalledTimes(1)
    expect(setIsSaving).toHaveBeenNthCalledWith(2, false)
  })

  it('TD-007.2: { bumpCache: false } success path → does NOT call bumpCacheVersion', async () => {
    const { requestCourseMutation } = initEditor(defaultOpts())

    await requestCourseMutation(async () => ({ ok: true }), { bumpCache: false })

    expect(bumpCacheVersion).not.toHaveBeenCalled()
    // isSaving still flips false
    expect(setIsSaving).toHaveBeenNthCalledWith(2, false)
  })

  it('TD-007.3: error path → setSaveError(msg) + setIsSaving(false); no bumpCacheVersion; returns undefined', async () => {
    const { requestCourseMutation } = initEditor(defaultOpts())

    const result = await requestCourseMutation(async () => {
      throw new Error('backend 500')
    })

    expect(result).toBeUndefined()
    expect(setSaveError).toHaveBeenCalledWith('backend 500')
    expect(setIsSaving).toHaveBeenNthCalledWith(2, false)
    expect(bumpCacheVersion).not.toHaveBeenCalled()
  })
})
