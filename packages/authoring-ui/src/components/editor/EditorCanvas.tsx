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
import { initEditor, setEditorLoading } from '../../editor/initEditor'
import { updateStorageContext } from '../../editor/storageManager'
import { useEditorStore } from '../../store/editorStore'
import { useActionsStore } from '../../store/actionsStore'
import type { ActionSequence } from '../../types/actions'
import { isQuestionWidgetType } from '../../types/questions'
import { isPhaserSimWidgetType } from '../../types/phaserSim'
import { isButtonWidgetType } from '../sidebar/ButtonPropertiesPanel'
import { isMediaPlayerWidgetType } from '../sidebar/MediaPlayerPropertiesPanel'
import { isAudioNarrationWidgetType } from '../sidebar/AudioNarrationPropertiesPanel'
import { isProgressBarWidgetType } from '../sidebar/ProgressBarPropertiesPanel'
import { isVolumeControlWidgetType } from '../sidebar/VolumeControlPropertiesPanel'

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
  // Monotonically increasing counter: each Effect 2 run captures its generation so that
  // stale editor.load() .then()/.catch() callbacks from a previous run cannot call
  // setIsReady(true) after a newer run has already called setIsReady(false).
  const loadGenRef = useRef(0)
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
        // Expose editor for Playwright E2E tests (dev build and E2E mode)
        if (import.meta.env.DEV || import.meta.env.VITE_E2E_MODE === 'true') {
          ;(window as unknown as Record<string, unknown>).__elearn_editor = ed
        }
        // NOTE: Do NOT call ed.load() here — Effect 2 handles all loads
        // (initial mount and slide switches). Calling load() twice causes a
        // race condition where the second loadProjectData() clears components
        // added between the two calls.

        ed.on('component:selected', (component) => {
          const type: string = component.get('type') ?? ''
          setSelectedComponentType(type)
          if (isQuestionWidgetType(type) || isPhaserSimWidgetType(type) || isButtonWidgetType(type) || isMediaPlayerWidgetType(type) || isAudioNarrationWidgetType(type) || isProgressBarWidgetType(type) || isVolumeControlWidgetType(type)) {
            setRightTab('properties')
          }

          // Load widget actions into actionsStore
          const widgetId: string = component.getId() ?? ''
          if (widgetId) {
            const slide = useEditorStore.getState().currentSlide()
            if (slide) {
              const widget = slide.widgets.find((w) => w.id === widgetId)
              useActionsStore.getState().setWidget(widgetId, (widget?.actions ?? []) as unknown as ActionSequence[])
            }
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
    // Effect 1 intentionally runs only when courseId changes.
    // setEditor/setRightTab/setSelectedComponentType are stable Zustand actions.
    // slideId is handled exclusively by Effect 2 below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // BUG-3 fix: save on ANY genuine navigation (including course switches), not just
    // within-course slide switches. A course change leaves the old slide with unsaved edits
    // if the 2s debounce has not yet fired.
    const shouldSaveBeforeSwitch = prev !== null && prev.slideId !== slideId

    setIsReady(false)

    // AbortController guards against:
    //  1. Concurrent saveAndLoad() calls when Effect 2 fires rapidly (rapid slide clicks)
    //  2. State updates (setIsReady) on an already-unmounted component
    const controller = new AbortController()

    // Fallback timer declared at effect scope so the cleanup function can clear it.
    // Guarantees setIsReady(true) within 8s even if the Promise chain below hangs silently.
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const saveAndLoad = async () => {
      // Capture this run's generation. Any callback that sees a different loadGenRef.current
      // is stale (a newer Effect 2 run has started) and must not call setIsReady(true).
      const gen = ++loadGenRef.current

      fallbackTimer = setTimeout(() => {
        console.warn('[EditorCanvas] Fallback timer fired — forcing isReady=true after 8s')
        setEditorLoading(false)  // safety reset in case load hung before .then()/.catch()
        if (loadGenRef.current === gen && editorRef.current === editor) setIsReady(true)
      }, 8000)

      try {
        if (shouldSaveBeforeSwitch && !controller.signal.aborted) {
          try {
            // BUG-2 fix: stop any active text-edit command before storing.
            // Without this, the text buffer for the currently focused text widget is not
            // flushed to the GrapesJS model. widgetsFromGrapesjs() would then read
            // the pre-keystroke text content, silently losing the user's latest typing.
            // The autosave debounce path in initEditor.ts already does this correctly.
            if (editor.Commands.isActive('text-edit')) {
              editor.stopCommand('text-edit')
            }

            // storageContext still points to the OLD slide here — store() saves the right data.
            // Timeout: if store() hangs (network stall, GrapesJS state corruption) we must
            // not block slide navigation. 5s is generous for a local/fast API call.
            await Promise.race([
              editor.store() as Promise<unknown>,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('[EditorCanvas] store() timed out after 5s')), 5000)
              ),
            ])
          } catch (err) {
            // Log but don't block navigation — a failed save is better than a frozen UI.
            console.error('[EditorCanvas] Failed to save slide before switching:', err)
          }
        }

        if (controller.signal.aborted) {
          clearTimeout(fallbackTimer)
          return
        }

        updateStorageContext({ courseId, slideId })

        // editor.load() in GrapesJS can take a callback or return a promise in newer versions.
        // We wrap it to ensure we set isReady true after the canvas is populated.
        //
        // GAP-06b/c fix: set the loading gate BEFORE editor.load() so that all component:add,
        // component:remove, and component:update events fired by loadData() (which runs
        // synchronously after the storage promise resolves) are suppressed in triggerAutosave.
        // The gate is cleared in .then()/.catch() — after loadData() has completed — so the
        // first real user edit after loading correctly starts the autosave debounce timer.
        setEditorLoading(true)
        const loadPromise = editor.load() as Promise<unknown> | undefined
        if (loadPromise && typeof loadPromise.then === 'function') {
          loadPromise
            .then(() => {
              clearTimeout(fallbackTimer)
              setEditorLoading(false)
              // Guard with generation AND editor identity: a stale .then() (from a load that
              // was superseded by a newer slide switch) must not call setIsReady(true) while
              // the new load is still in-flight. The editor identity check prevents this
              // callback from firing after editor.destroy() replaced editorRef.current with a
              // new instance — which would cause waitForCanvas() to see "true" on a broken canvas
              // (TypeError: Cannot read properties of undefined (reading 'forEach') at loadData).
              if (loadGenRef.current === gen && editorRef.current === editor) {
                setTimeout(() => setIsReady(true), 150)
              }
            })
            .catch((err) => {
              clearTimeout(fallbackTimer)
              setEditorLoading(false)
              console.error('[EditorCanvas] load() failed:', err)
              // Guard with generation AND editor identity: only unblock the UI if this is still
              // the active editor. If editor.destroy() was called (editorRef.current !== editor),
              // a new editor is being initialized — its own Effect 2 run will set isReady when
              // its load completes successfully. Calling setIsReady(true) here on a destroyed
              // editor would expose a broken canvas to waitForCanvas().
              if (loadGenRef.current === gen && editorRef.current === editor) {
                setIsReady(true)
              }
            })
        } else {
          setEditorLoading(false)
          clearTimeout(fallbackTimer)
          // Fallback for older GrapesJS versions where load() is synchronous or lacks promise.
          if (loadGenRef.current === gen && editorRef.current === editor) {
            setTimeout(() => setIsReady(true), 500)
          }
        }
      } catch (err) {
        clearTimeout(fallbackTimer)
        console.error('[EditorCanvas] Unexpected error during slide switch:', err)
        if (loadGenRef.current === gen && editorRef.current === editor) {
          setIsReady(true)
        }
      }
    }

    void saveAndLoad()

    return () => {
      clearTimeout(fallbackTimer)
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
