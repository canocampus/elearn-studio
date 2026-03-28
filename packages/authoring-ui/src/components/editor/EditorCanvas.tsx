/**
 * GrapesJS canvas wrapper.
 * T010.4 — Mounts GrapesJS into the React component tree.
 * T010.11 — Canvas uses position:absolute for fixed slide layout.
 *
 * IMPORTANT: The GrapesJS canvas is an <iframe>. React components cannot run
 * inside it. All canvas rendering uses GrapesJS's native component system.
 *
 * R-03 fix: GrapesJS is initialized ONCE per courseId. Slide switches update
 * the storage context and call editor.load() without destroying the editor.
 */

import { useEffect, useRef, useState } from 'react'
import type { Editor } from 'grapesjs'
import { initEditor } from '../../editor/initEditor'
import { updateStorageContext } from '../../editor/storageManager'
import { useEditorStore } from '../../store/editorStore'
import { useActionsStore } from '../../store/actionsStore'
import { isQuestionWidgetType } from '../../types/questions'
import { isPhaserSimWidgetType } from '../../types/phaserSim'

interface EditorCanvasProps {
  courseId: string
  slideId: string
}

const BLOCK_MANAGER_ID = 'gjs-block-manager'
const LAYER_MANAGER_ID = 'gjs-layer-manager'
const STYLE_MANAGER_ID = 'gjs-style-manager'

export function EditorCanvas({ courseId, slideId }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  // Guard against React 18 StrictMode double-invocation of useEffect in development.
  const isInitializedRef = useRef(false)
  // Track previous context to detect genuine slide switches (vs. initial mount).
  const prevContextRef = useRef<{ courseId: string; slideId: string } | null>(null)
  const setEditor = useEditorStore(s => s.setEditor)
  const setSelectedComponentType = useEditorStore(s => s.setSelectedComponentType)
  const setRightTab = useEditorStore(s => s.setRightTab)
  const [panelError, _setPanelError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Effect 1: Initialize GrapesJS once per courseId.
  useEffect(() => {
    if (!containerRef.current) return
    if (isInitializedRef.current) return

    const missing = [BLOCK_MANAGER_ID, LAYER_MANAGER_ID, STYLE_MANAGER_ID].filter(
      id => !document.getElementById(id),
    )
    if (missing.length > 0) {
      // In some environments (like Playwright), React might not have finished the first paint
      // of the sidebar panels. We'll log a warning and continue, as GrapesJS will retry
      // internally if configured, or the containers will appear shortly.
      console.warn('[EditorCanvas] Some panel containers not immediately found in DOM:', missing.join(', '))
    }

    isInitializedRef.current = true

    const editor = initEditor({
      container: containerRef.current,
      courseId,
      slideId,
      blockManagerContainer: `#${BLOCK_MANAGER_ID}`,
      layerManagerContainer: `#${LAYER_MANAGER_ID}`,
      styleManagerContainer: `#${STYLE_MANAGER_ID}`,
      onReady: (ed) => {
        setEditor(ed)
        // Expose editor for Playwright E2E tests (dev build only)
        if (import.meta.env.DEV) {
          ;(window as Record<string, unknown>).__elearn_editor = ed
        }
        // NOTE: Do NOT call ed.load() here — Effect 2 handles all loads
        // (initial mount and slide switches). Calling load() twice causes a
        // race condition where the second loadProjectData() clears components
        // added between the two calls.

        ed.on('component:selected', (component) => {
          const type: string = component.get('type') ?? ''
          setSelectedComponentType(type)
          if (isQuestionWidgetType(type) || isPhaserSimWidgetType(type)) {
            setRightTab('properties')
          }

          // Load widget actions into actionsStore
          const widgetId: string = component.getId() ?? ''
          if (widgetId) {
            const slide = useEditorStore.getState().currentSlide()
            const widget = slide?.widgets.find((w) => w.id === widgetId)
            useActionsStore.getState().setWidget(widgetId, widget?.actions ?? [])
          }
        })

        ed.on('component:deselected', () => {
          setSelectedComponentType(null)
          useActionsStore.getState().clearWidget()
        })
      },
    })

    editorRef.current = editor

    return () => {
      isInitializedRef.current = false
      editor.destroy()
      editorRef.current = null
      setEditor(null)
    }
  }, [courseId])

  // Effect 2: Load slide content whenever courseId or slideId changes.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const prev = prevContextRef.current
    prevContextRef.current = { courseId, slideId }

    // PERSISTENCE FIX: save the current slide before switching context.
    // Without this, unsaved edits are lost when the user navigates to another slide
    // within the autosave debounce window (2s): the CRITICAL-01 guard in initEditor.ts
    // aborts the deferred autosave because the context has already moved to the new slide.
    // We only save on a genuine slide switch within the same course (not on initial mount).
    const isSlideSwitchWithinCourse =
      prev !== null && prev.courseId === courseId && prev.slideId !== slideId

    setIsReady(false)

    // AbortController guards against:
    //  1. Concurrent saveAndLoad() calls when Effect 2 fires rapidly (rapid slide clicks)
    //  2. State updates (setIsReady) on an already-unmounted component
    const controller = new AbortController()

    const saveAndLoad = async () => {
      try {
        if (isSlideSwitchWithinCourse && !controller.signal.aborted) {
          try {
            // storageContext still points to the OLD slide here — store() saves the right data.
            await editor.store()
          } catch (err) {
            // Log but don't block navigation — a failed save is better than a frozen UI.
            console.error('[EditorCanvas] Failed to save slide before switching:', err)
          }
        }

        if (controller.signal.aborted) return

        updateStorageContext({ courseId, slideId })

        // editor.load() in GrapesJS can take a callback or return a promise in newer versions.
        // We wrap it to ensure we set isReady true after the canvas is populated.
        const loadPromise = editor.load() as Promise<unknown> | undefined
        if (loadPromise && typeof loadPromise.then === 'function') {
          loadPromise
            .then(() => {
              if (!controller.signal.aborted) {
                // Small buffer to allow GrapesJS to paint the iframe content
                setTimeout(() => setIsReady(true), 150)
              }
            })
            .catch((err) => {
              console.error('[EditorCanvas] load() failed:', err)
              if (!controller.signal.aborted) {
                setIsReady(true) // Set ready anyway so we don't hang UI
              }
            })
        } else {
          // Fallback for older GrapesJS versions where load() is synchronous or lacks promise
          if (!controller.signal.aborted) {
            setTimeout(() => setIsReady(true), 500)
          }
        }
      } catch (err) {
        console.error('[EditorCanvas] Unexpected error during slide switch:', err)
        if (!controller.signal.aborted) {
          setIsReady(true)
        }
      }
    }

    void saveAndLoad()

    return () => {
      controller.abort()
    }
  }, [courseId, slideId])

  if (panelError) {
    return (
      <div style={{ color: '#f38ba8', fontSize: 13, padding: 24, textAlign: 'center' }}>
        Editor failed to initialise: {panelError}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, display: 'flex' }}>
      {!isReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#11111b', color: '#cdd6f4', fontSize: 14
        }}>
          Loading slide...
        </div>
      )}
      <div
        ref={containerRef}
        aria-label="Slide editor canvas"
        data-editor-ready={isReady ? 'true' : 'false'}
        style={{ width: '100%', height: '100%', flex: 1 }}
      />
    </div>
  )
}
