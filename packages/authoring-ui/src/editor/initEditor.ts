/**
 * GrapesJS editor initialization for eLearn Studio.
 * T010.2 — Fixed 1024×768 slide device
 * T010.3 — All default panels disabled (custom React panels used)
 * T010.11 — Canvas uses position:absolute layout for ToolBook-style fixed positioning
 */

import grapesjs, { type Editor } from 'grapesjs'
import { buildAssetManagerConfig } from './assetManager'
import { registerStorageManager, updateStorageContext, getStorageContext } from './storageManager'
import { registerBlocks } from './registerBlocks'
import { useEditorStore } from '../store/editorStore'

const AUTOSAVE_DEBOUNCE_MS = 2000

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
      ],
    },

    // ---------------------------------------------------------------------------
    // Asset Manager → Garage via backend API
    // ---------------------------------------------------------------------------
    assetManager: buildAssetManagerConfig(),

    // ---------------------------------------------------------------------------
    // Canvas: fixed layout, no margin, position:absolute for widgets
    // ---------------------------------------------------------------------------
    canvas: {
      styles: [
        'body { margin: 0; overflow: hidden; background: white; }',
        '* { box-sizing: border-box; }',
        '[data-gjs-type] { position: absolute; }',
      ],
    },

    // ---------------------------------------------------------------------------
    // Component defaults: disable draggable text editing in canvas header bar
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

  // Force absolute positioning when a component is added via drag-drop
  editor.on('component:add', (component) => {
    if (!component.getStyle('position')) {
      component.addStyle({ position: 'absolute' })
    }
  })

  // T011.7 — Debounced autosave: triggers 2s after the last component:update event.
  // We use editor.store() rather than GrapesJS autosave (which fired on every undo step).
  //
  // Race-condition guard (CRITICAL-01): snapshot the context at event time and compare
  // when the timer fires. If the user switched slides during the debounce window the
  // snapshot won't match the current context, so we abort instead of saving stale data.
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  editor.on('component:update', () => {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    const snapshot = getStorageContext()
    autosaveTimer = setTimeout(async () => {
      autosaveTimer = null
      const current = getStorageContext()
      if (current.courseId !== snapshot.courseId || current.slideId !== snapshot.slideId) {
        // Slide was switched during debounce — skip to avoid saving to the wrong slide.
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
  })

  opts.onReady?.(editor)

  return editor
}
