/**
 * GrapesJS editor initialization for eLearn Studio.
 * T010.2 — Fixed 1024×768 slide device
 * T010.3 — All default panels disabled (custom React panels used)
 * T010.11 — Canvas uses position:absolute layout for ToolBook-style fixed positioning
 */

import 'grapesjs/dist/css/grapes.min.css'
import grapesjs, { type Editor } from 'grapesjs'
import { buildAssetManagerConfig } from './assetManager'
import { registerStorageManager, updateStorageContext, getStorageContext } from './storageManager'
import { registerBlocks } from './registerBlocks'
import { useEditorStore } from '../store/editorStore'
import { setClipboard, getClipboard } from './clipboard'

const AUTOSAVE_DEBOUNCE_MS = 2000

// Loading gate — module-level flag set by EditorCanvas around editor.load() calls.
// Suppresses autosave events fired during component reconstruction (loadData) so that
// the debounce timer does not start until the first real user edit after loading.
// See GAP-06b/c for why storage events alone are insufficient (loadData fires after
// storage:end:load, so component:add events arrive when isEditorLoading is already false
// if we relied on storage events).
let _isEditorLoading = false
export function setEditorLoading(loading: boolean): void {
  _isEditorLoading = loading
}
export function getEditorLoading(): boolean {
  return _isEditorLoading
}

export interface InitEditorOptions {
  container: HTMLElement
  courseId: string
  slideId: string
  blockManagerContainer: string
  layerManagerContainer: string
  styleManagerContainer: string
  onReady?: (editor: Editor) => void
}

export function initEditor(opts: InitEditorOptions): Editor {
  const editor = grapesjs.init({
    container: opts.container,
    fromElement: false,
    height: '100%',
    width: '100%',

    // ---------------------------------------------------------------------------
    // Storage Manager — elearn-api (T010: stub, T011: real)
    //
    // IMPORTANT (C-04 / T011): GrapesJS 0.21 changed how custom storage options
    // are forwarded. Verify in T011 that `options['elearn-api']` is what the
    // custom storage's load/store callbacks actually receive as their first arg.
    // Alternative: pass courseId/slideId via editor.StorageManager.get() or
    // a module-level variable set before calling editor.load().
    //
    // ---------------------------------------------------------------------------
    storageManager: {
      type: 'elearn-api',
      // INTENTIONAL — do NOT change to true.
      // EditorCanvas calls editor.load() explicitly after updateStorageContext() so it
      // controls the exact slide being loaded. With autoload:true GrapesJS fires an
      // extra load() on init (before EditorCanvas sets courseId/slideId), racing against
      // EditorCanvas's own load() — clearing components added between the two calls.
      // See R-03 fix notes in EditorCanvas.tsx Effect 2. (T640.2)
      autoload: false,
      // INTENTIONAL — do NOT change to true.
      // A debounced component:update listener in initEditor.ts (triggerAutosave) handles
      // saves instead (T011.7). Enabling autosave with stepsBeforeSave:1 would fire a
      // PATCH /courses/:id/slides/:slideId on every single undo/redo step.
      autosave: false,
    },

    // ---------------------------------------------------------------------------
    // Device: fixed 1024×768 slide (ToolBook default page size)
    // ---------------------------------------------------------------------------
    deviceManager: {
      devices: [
        {
          id: 'slide',
          name: 'Slide 1024×768',
          width: '1024px',
          height: '768px',
        },
      ],
    },

    // ---------------------------------------------------------------------------
    // Panels: all disabled — we build custom React panels
    // ---------------------------------------------------------------------------
    panels: { defaults: [] },

    // ---------------------------------------------------------------------------
    // Block Manager → appends to left sidebar container
    // ---------------------------------------------------------------------------
    blockManager: {
      appendTo: opts.blockManagerContainer,
      blocks: [], // T012 will register blocks
    },

    // ---------------------------------------------------------------------------
    // Layer Manager → appends to right sidebar container
    // ---------------------------------------------------------------------------
    layerManager: {
      appendTo: opts.layerManagerContainer,
    },

    // ---------------------------------------------------------------------------
    // Style Manager → appends to right sidebar container
    // ---------------------------------------------------------------------------
    styleManager: {
      appendTo: opts.styleManagerContainer,
      sectors: [
        {
          name: 'Position & Size',
          open: true,
          properties: [
            { name: 'Left', property: 'left', type: 'integer', units: ['px'], default: '0' },
            { name: 'Top', property: 'top', type: 'integer', units: ['px'], default: '0' },
            { name: 'Width', property: 'width', type: 'integer', units: ['px'], default: '200' },
            { name: 'Height', property: 'height', type: 'integer', units: ['px'], default: '50' },
            { name: 'Z-Index', property: 'z-index', type: 'integer', default: '1' },
          ],
        },
        {
          name: 'Typography',
          open: false,
          properties: [
            'font-family',
            'font-size',
            'font-weight',
            'color',
            'text-align',
          ],
        },
        {
          name: 'Background',
          open: false,
          properties: ['background-color', 'background-image'],
        },
        {
          name: 'Border',
          open: false,
          properties: ['border', 'border-radius'],
        },
        {
          name: 'Spacing',
          open: false,
          properties: [
            { name: 'Padding Top',    property: 'padding-top',    type: 'integer', units: ['px'], default: '0' },
            { name: 'Padding Right',  property: 'padding-right',  type: 'integer', units: ['px'], default: '0' },
            { name: 'Padding Bottom', property: 'padding-bottom', type: 'integer', units: ['px'], default: '0' },
            { name: 'Padding Left',   property: 'padding-left',   type: 'integer', units: ['px'], default: '0' },
          ],
        },
      ],
    },

    // ---------------------------------------------------------------------------
    // Asset Manager → Garage via backend API
    // ---------------------------------------------------------------------------
    assetManager: buildAssetManagerConfig(),

    // ---------------------------------------------------------------------------
    // Canvas: fixed layout, no margin, absolute positioning handled by GrapesJS
    // ---------------------------------------------------------------------------
    canvas: {
      styles: [
        'body { margin: 0; overflow: hidden; background-color: white !important; }',
        '* { box-sizing: border-box; }',
        // T605 — Image widget placeholder: GrapesJS adds .gjs-plh-image when src is empty.
        // SVG background provides camera icon + hint text without needing child elements
        // (img is a void element; ::before/::after do not work on it).
        `img.gjs-plh-image {
  background-color: #f8fafc;
  background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 110'><rect x='60' y='28' width='100' height='65' rx='8' fill='none' stroke='%2394a3b8' stroke-width='2.5'/><circle cx='110' cy='60' r='18' fill='none' stroke='%2394a3b8' stroke-width='2.5'/><circle cx='110' cy='60' r='8' fill='%23c8d4e0'/><path d='M93,28 L97,20 L123,20 L127,28' fill='%2394a3b8'/><rect x='70' y='34' width='15' height='10' rx='2' fill='%23c8d4e0'/><text x='110' y='108' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' fill='%2364748b'>Click to choose image</text></svg>");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 70%;
  border: 2px dashed #94a3b8 !important;
  cursor: pointer;
}`,
      ],
    },

    /**
     * T010.11 / T012.6 — Free-form positioning
     * Setting dragMode to 'absolute' tells GrapesJS to move components
     * using top/left instead of trying to insert them into the DOM flow.
     */
    dragMode: 'absolute',

    // ---------------------------------------------------------------------------
    // Rich Text Editor — toolbar for text widgets (editable: true components)
    // T637.3: Explicitly initialise the RTE module so the toolbar renders when
    // the user double-clicks a text widget and selects text.
    // T637.4: Formatting actions available in the RTE toolbar.
    // ---------------------------------------------------------------------------
    richTextEditor: {
      actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
    },

    // ---------------------------------------------------------------------------
    // Component defaults: Ensure absolute positioning and draggability
    // ---------------------------------------------------------------------------
    components: '',
    style: '',
  })

  // T639.8 — Guard against destroy/load race condition.
  //
  // Root cause: editor.destroy() calls Backbone this.clear({ silent:true }), which wipes
  // ALL model attributes including `storables`. If editor.load() is in-flight (awaiting the
  // Storage.load() API call) when destroy() runs, the subsequent loadData(result) call
  // crashes with "Cannot read properties of undefined (reading 'forEach')" at:
  //   grapesjs.js:55206  this.storables.forEach(...)
  //
  // GrapesJS does not guard loadData() against the destroyed state itself.
  // Fix: monkey-patch em.loadData to silently return early when em.destroyed === true.
  type GrapesEditorInternal = { em?: { destroyed?: boolean; loadData?: (data: unknown) => unknown } }
  const em = (editor as unknown as GrapesEditorInternal).em
  if (em && typeof em.loadData === 'function') {
    const originalLoadData = em.loadData.bind(em)
    em.loadData = function (data: unknown) {
      if (em.destroyed) return data
      return originalLoadData(data)
    }
  }

  // Register custom storage type (elearn-api — see storageManager.ts)
  registerStorageManager(editor)

  // Register widget blocks and component types (T012)
  registerBlocks(editor)

  // R-03: prime the context so the first editor.load() call (from EditorCanvas) targets
  // the correct course/slide without requiring a full editor re-init on slide switch.
  updateStorageContext({ courseId: opts.courseId, slideId: opts.slideId })

  // Select default device
  editor.setDevice('slide')

  // T010.11 / T012.6 — Ensure all components are draggable and resizable.
  editor.on('component:add', (component) => {
    component.set({ draggable: true, resizable: true })
    if (component.getStyle('position') !== 'absolute') {
      component.addStyle({ position: 'absolute' })
    }
  })

  // T630 — Correct drop coordinates using iframe dragover events.
  //
  // Root cause (confirmed via GrapesJS 0.21.13 source analysis + runtime debug):
  // - The canvas lives in a GrapesJS iframe. During HTML5 drag-and-drop the browser
  //   suppresses mousemove and fires dragover on the drop target (inside the iframe).
  // - Phase 1 fix registered mousemove on the main document → no events once cursor
  //   enters the iframe.
  // - Phase 2 fix used getMouseRelativePos() with iframe-internal dragover events.
  //   WRONG: adds iframeRect offset to clientX/Y which are already viewport-relative.
  // - Phase 3 fix used getMouseRelativeCanvas(event, {noScroll:1}).
  //   WRONG: debug confirmed +93px constant X offset = getMouseRelativeCanvas adds
  //   frameOffset.left internally (designed for main-window events).
  // - Phase 4 tried clientX - iframeRect.left.
  //   WRONG: the browser fires dragover events captured on iframeDoc with clientX/Y
  //   already in the iframe's own coordinate space (= canvas coordinates). The iframe
  //   has its own viewport; clientX inside it is already canvas-relative. Subtracting
  //   iframeRect.left subtracted the offset AGAIN, shifting widgets 93px to the left.
  //
  // Phase 5 fix (correct): clientX/Y from iframeDoc events ARE canvas-relative.
  //   No offset subtraction needed. Divide by getZoomDecimal() to account for zoom.
  //   At 100% zoom zoomDecimal=1 → x = clientX, y = clientY.
  {
    let lastDragEvent: MouseEvent | null = null

    const onCanvasDragOver = (e: Event) => {
      lastDragEvent = e as MouseEvent
    }

    const getIframeDoc = (): Document | null => {
      const canvas = editor.Canvas as unknown as {
        getFrameEl?: () => HTMLIFrameElement | null
        getElement?: () => HTMLElement | null
      }
      const iframe =
        canvas.getFrameEl?.() ??
        (canvas.getElement?.()?.querySelector('iframe') as HTMLIFrameElement | null)
      return iframe?.contentDocument ?? iframe?.contentWindow?.document ?? null
    }

    editor.on('block:drag:start', () => {
      getIframeDoc()?.addEventListener('dragover', onCanvasDragOver)
    })

    editor.on('block:drag:stop', (component: unknown) => {
      getIframeDoc()?.removeEventListener('dragover', onCanvasDragOver)
      if (!component || !lastDragEvent) {
        lastDragEvent = null
        return
      }
      // clientX/Y from iframeDoc dragover events are already in canvas coordinate space.
      // Divide by zoomDecimal (zoom/100) so the position is correct at any zoom level.
      const canvasModel = editor.Canvas as unknown as { getZoomDecimal?: () => number }
      const zoom = canvasModel.getZoomDecimal?.() ?? 1
      const x = lastDragEvent.clientX / zoom
      const y = lastDragEvent.clientY / zoom
      const comp = component as { addStyle: (s: Record<string, string>) => void }
      comp.addStyle({ left: `${Math.round(x)}px`, top: `${Math.round(y)}px` })
      lastDragEvent = null
    })
  }

  // T630.UX — Replace the browser's default block drag ghost (full block element,
  // large rectangle) with a small 24×24 indicator. The ghost is positioned with the
  // cursor at its top-left corner (hotspot 0,0) so the user can see exactly where the
  // widget's top-left will land. This makes drop placement predictable and intuitive.
  {
    const blockContainer = document.querySelector<HTMLElement>(opts.blockManagerContainer)
    blockContainer?.addEventListener('dragstart', (e: Event) => {
      const de = e as DragEvent
      if (!de.dataTransfer) return
      const ghost = document.createElement('div')
      ghost.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:24px;height:24px;' +
        'background:#6366f1;border-radius:3px;opacity:0.85;pointer-events:none;'
      document.body.appendChild(ghost)
      de.dataTransfer.setDragImage(ghost, 0, 0)
      requestAnimationFrame(() => {
        try { document.body.removeChild(ghost) } catch { /* Already removed or not in DOM */ }
      })
    })
  }

  // T636 — Custom copy/paste commands with cross-slide position preservation.
  //
  // GrapesJS built-in Ctrl+C/V works only within a single slide because its clipboard
  // is held in the GrapesJS editor instance; switching slides reinitialises the editor
  // and clears it. Solution: custom elearn:copy / elearn:paste commands backed by a
  // module-level variable (clipboard.ts) that survives slide navigation.
  //
  // T636.3: editor.Keymaps.add registers at editor context. GrapesJS bridges iframe
  // keyboard events to the editor internally — NO manual iframeDoc listener needed.
  // T636.1: component.getStyle() reads left/top/width/height — no mouse coordinates.
  {
    editor.Commands.add('elearn:copy', {
      run(ed: Editor) {
        // T637.1: GrapesJS keymap filter does NOT exclude contenteditable elements.
        // Skip widget copy during text-edit so the native Ctrl+C copies selected text.
        if (isRteActive) return
        const selected = ed.getSelected()
        if (!selected) return
        const style = selected.getStyle() as Record<string, string>
        const definition = selected.toJSON() as Record<string, unknown>
        setClipboard({ style, definition })
      },
    })

    editor.Commands.add('elearn:paste', {
      run(ed: Editor) {
        // T637.1: Skip widget paste during text-edit so the native Ctrl+V pastes text.
        // Without this guard, elearn:paste would add a widget to the canvas and
        // GrapesJS could select it, causing the RTE to exit and cursor to be lost.
        if (isRteActive) return
        const entry = getClipboard()
        if (!entry) return
        const added = ed.getComponents().add(entry.definition)
        const comp = Array.isArray(added) ? added[0] : added
        if (!comp) return
        comp.addStyle({
          left: entry.style['left'] ?? '0px',
          top: entry.style['top'] ?? '0px',
          width: entry.style['width'] ?? '100px',
          height: entry.style['height'] ?? '50px',
        })
      },
    })

    editor.Keymaps.add('elearn:copy', 'ctrl+c', 'elearn:copy')
    editor.Keymaps.add('elearn:paste', 'ctrl+v', 'elearn:paste')
  }

  // T011.7 — Debounced autosave: triggers 2s after the last component:update event.
  // We use editor.store() rather than GrapesJS autosave (which fired on every undo step).
  //
  // Race-condition guard (CRITICAL-01): snapshot the context at event time and compare
  // when the timer fires. If the user switched slides during the debounce window the
  // snapshot won't match the current context, so we abort instead of saving stale data.
  //
  // Loading gate (GAP-06b/c fix): GrapesJS fires component:add, component:remove, and
  // component:update events for every component reconstructed during editor.load(). GrapesJS
  // calls loadData() AFTER storage:end:load fires (confirmed in grapes.min.js em.prototype.load),
  // so we cannot use storage events to gate. Instead, EditorCanvas calls setEditorLoading()
  // before/after editor.load() — isEditorLoading=true suppresses the spurious events so the
  // autosave timer only starts ticking once the first genuine user edit fires.
  //
  // T637.2 — RTE active flag: GrapesJS v0.21.13 does NOT expose a 'text-edit' command.
  // Text editing is managed by the RichTextEditor module which fires rte:enable/rte:disable.
  // Commands.isActive('text-edit') ALWAYS returns false — do not use it.
  // Use this per-editor closure flag instead.
  let isRteActive = false
  editor.on('rte:enable', () => { isRteActive = true })
  editor.on('rte:disable', () => { isRteActive = false })

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  const triggerAutosave = () => {
    if (getEditorLoading()) return
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    const snapshot = getStorageContext()
    autosaveTimer = setTimeout(async () => {
      autosaveTimer = null
      const current = getStorageContext()
      if (current.courseId !== snapshot.courseId || current.slideId !== snapshot.slideId) {
        // Slide was switched during debounce — skip to avoid saving to the wrong slide.
        return
      }

      // T637.2: If RTE (text-edit) is active, defer autosave until the user exits.
      // rte:disable fires when text-edit ends and triggers triggerAutosave directly
      // (see listener below), so typed content is never lost.
      if (isRteActive) {
        return
      }

      const { setIsSaving, setSaveError } = useEditorStore.getState()
      setIsSaving(true)
      setSaveError(null)
      try {
        await editor.store()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Autosave failed')
      } finally {
        setIsSaving(false)
      }
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  editor.on('component:update', triggerAutosave)
  editor.on('component:update:content', triggerAutosave)
  editor.on('component:add', triggerAutosave)
  editor.on('component:remove', triggerAutosave)

  // T637.2: Save after RTE (text-edit) exits so typed content is not lost.
  // The isRteActive=false handler registered above runs first (earlier registration),
  // so by the time triggerAutosave runs the flag is already cleared.
  // GrapesJS syncs the contenteditable back to the model on rte:disable, so
  // this fires AFTER the model is up to date.
  editor.on('rte:disable', triggerAutosave)

  opts.onReady?.(editor)

  return editor
}
