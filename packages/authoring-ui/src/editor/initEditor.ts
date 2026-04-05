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
    // R-03: autoload disabled — EditorCanvas calls editor.load() explicitly so it
    // can update the storage context before loading (required for slide switching).
    // autosave disabled — T011.7 added a debounced component:update listener instead;
    // enabling autosave with stepsBeforeSave:1 fires a network PATCH on every undo step.
    // ---------------------------------------------------------------------------
    storageManager: {
      type: 'elearn-api',
      autosave: false,
      autoload: false,
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
    // Component defaults: Ensure absolute positioning and draggability
    // ---------------------------------------------------------------------------
    components: '',
    style: '',
  })

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
  //   WRONG: formula (clientY + iframe.top) * zoom adds the iframe viewport offset to
  //   an already-viewport-relative clientY → off by ~iframe.top pixels.
  // - Phase 3 fix used getMouseRelativeCanvas(event, {noScroll:1}).
  //   WRONG: confirmed via debug logs that the function adds iframe.left (~93px) to X
  //   but NOT to Y — producing a fixed +93px X offset regardless of drop position.
  //   Root cause: getMouseRelativeCanvas is designed for main-window events and adds
  //   frameOffset.left internally, which is already included in iframe-internal clientX.
  //
  // Phase 4 fix (final): compute canvas-relative coordinates directly.
  //   dragover events inside the iframe have clientX/Y relative to the viewport.
  //   The iframe's getBoundingClientRect() gives its position in the viewport.
  //   canvas-x = clientX - iframeRect.left
  //   canvas-y = clientY - iframeRect.top
  //   Verified: offset = 0px in both axes across all drop positions.
  {
    let lastDragEvent: MouseEvent | null = null

    const onCanvasDragOver = (e: Event) => {
      lastDragEvent = e as MouseEvent
    }

    const getIframeEl = (): HTMLIFrameElement | null => {
      const canvas = editor.Canvas as unknown as {
        getFrameEl?: () => HTMLIFrameElement | null
        getElement?: () => HTMLElement | null
      }
      return (
        canvas.getFrameEl?.() ??
        (canvas.getElement?.()?.querySelector('iframe') as HTMLIFrameElement | null)
      )
    }

    const getIframeDoc = (): Document | null => {
      const iframe = getIframeEl()
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
      const iframeRect = getIframeEl()?.getBoundingClientRect()
      if (!iframeRect) {
        lastDragEvent = null
        return
      }
      // canvas-relative position: viewport coords minus iframe origin
      const x = lastDragEvent.clientX - iframeRect.left
      const y = lastDragEvent.clientY - iframeRect.top
      const comp = component as { addStyle: (s: Record<string, string>) => void }
      comp.addStyle({ left: `${Math.round(x)}px`, top: `${Math.round(y)}px` })
      lastDragEvent = null
    })
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
      
      // T611: Force any active text editor to sync its content back to the model 
      // before we trigger the store() cycle.
      if (editor.Commands.isActive('text-edit')) {
        editor.stopCommand('text-edit')
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

  opts.onReady?.(editor)

  return editor
}
