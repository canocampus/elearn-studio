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
import { useEditorStore } from '../../store/editorStore'
import { useActionsStore } from '../../store/actionsStore'
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
  // TD-009: Track the context of the last load we STARTED. StrictMode double-
  // invokes Effect 2 on mount with the SAME slideId. The first run's
  // editor.load() is async; while it is awaiting storage.load(), cleanup
  // runs (isCancelled=true), then the second run starts — if we let it
  // call editor.load() again, we end up with two concurrent loads. The
  // first one's loadData() fires AFTER the second run has returned and
  // the test (or user) has added a widget, silently clearing the canvas.
  // By remembering the last-started (courseId, slideId) we skip the second
  // invocation for the same slide, letting the first one's already-in-flight
  // load complete normally and updating setIsReady once it resolves.
  const lastLoadContextRef = useRef<{ courseId: string; slideId: string } | null>(null)
  const lastLoadPromiseRef = useRef<Promise<void> | null>(null)
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

    const { editor, cleanup, hasPendingChanges, requestSave } = initEditor({
      container: containerRef.current,
      courseId,
      slideId,
      blockManagerContainer: `#${BLOCK_MANAGER_ID}`,
      layerManagerContainer: `#${LAYER_MANAGER_ID}`,
      styleManagerContainer: `#${STYLE_MANAGER_ID}`,
      onReady: (ed) => {
        setEditor(ed)
        // Expose editor + Zustand store for Playwright E2E tests (dev build and E2E mode).
        // The store handle is used by the docs-screenshots campaign to force-sync
        // Zustand's course.slides[i].widgets with the current GrapesJS state —
        // WidgetIdParam reads from Zustand and would otherwise show bare IDs
        // instead of names until a full page reload repopulates the store
        // from getCourse(id). TD-013.4 playbook T-15.
        if (import.meta.env.DEV || import.meta.env.VITE_E2E_MODE === 'true') {
          window.__elearn_editor = ed
          window.__elearn_store = useEditorStore
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
              useActionsStore.getState().setWidget(widgetId, widget?.actions ?? [])
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

    // T651.3 — Expose the unified save closure via Zustand so SaveErrorBanner,
    // EditorCanvas saveAndLoad, useActionsSave and SimulationEditor all share one entry point.
    useEditorStore.getState().setRequestSave(requestSave)

    // TD-007 — requestCourseMutation is a plain store action, not editor-bound.
    // No lifecycle registration needed here (unlike requestSave).

    // T650.2 — Warn the user if they try to close the tab mid-debounce.
    // hasPendingChanges() reads autosaveTimer !== null at event time — no store() called here.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        e.preventDefault()
        e.returnValue = ''  // Required for Chrome legacy support
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      isInitializedRef.current = false
      cleanup()
      editor.destroy()
      editorRef.current = null
      // TD-009 lifecycle correction: the StrictMode guard in Effect 2 keys off
      // lastLoadContextRef. When Effect 1 destroys the editor (StrictMode
      // cleanup OR course switch), that ref must be cleared too — otherwise the
      // next Effect 2 run sees a stale "already loaded slide X" entry from the
      // now-destroyed editor instance, skips editor.load() on the FRESH editor,
      // and the canvas stays empty until the user navigates to another slide.
      lastLoadContextRef.current = null
      lastLoadPromiseRef.current = null
      prevContextRef.current = null
      setEditor(null)
      useEditorStore.getState().setRequestSave(null)
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

    // TD-009: In React StrictMode the mount effect is invoked twice with the
    // same deps. Skip the redundant second invocation — otherwise we fire two
    // concurrent editor.load() calls, and the first one's loadData() runs
    // AFTER the test/user has added content, clearing the canvas.
    const lastLoad = lastLoadContextRef.current
    if (
      lastLoad !== null &&
      lastLoad.courseId === courseId &&
      lastLoad.slideId === slideId
    ) {
      // If the earlier run's load is still in flight, wait for it before
      // declaring ready; otherwise the flag is already true.
      if (lastLoadPromiseRef.current) {
        lastLoadPromiseRef.current.then(() => setIsReady(true)).catch(() => setIsReady(true))
      } else {
        setIsReady(true)
      }
      return
    }
    lastLoadContextRef.current = { courseId, slideId }

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
    // E2E/race-safety: setIsReady(false) is async — React hasn't flipped the
    // data-editor-ready attribute to "false" yet. If a test (or any external
    // observer) was waiting on the *previous* slide's readySignal, it would
    // see the stale "true" and race ahead before the new slide has loaded.
    // Flip the attribute synchronously on the DOM element so the ready signal
    // correctly reflects "load in progress".
    if (containerRef.current) {
      containerRef.current.setAttribute('data-editor-ready', 'false')
    }

    // AbortController guards against:
    //  1. Concurrent saveAndLoad() calls when Effect 2 fires rapidly (rapid slide clicks)
    //  2. State updates (setIsReady) on an already-unmounted component
    const controller = new AbortController()

    // Closure-scoped cancellation flag. Set to true only in THIS Effect 2 run's cleanup.
    // Replaces the shared loadGenRef counter: a counter can be out-of-sync in edge cases
    // (e.g. React 18 StrictMode double-invoke), whereas a per-closure boolean is always
    // authoritative for exactly this run.
    let isCancelled = false


    // Fallback timer declared at effect scope so the cleanup function can clear it.
    // Guarantees setIsReady(true) within 8s even if the Promise chain below hangs silently.
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const saveAndLoad = async () => {
      fallbackTimer = setTimeout(() => {
        setEditorLoading(false)  // safety reset in case load hung before .then()/.catch()
        if (!isCancelled) setIsReady(true)
      }, 8000)

      try {
        if (shouldSaveBeforeSwitch && !controller.signal.aborted) {
          // BUG-2 fix: stop any active text-edit command before storing.
          // Without this, the text buffer for the currently focused text widget is not
          // flushed to the GrapesJS model. widgetsFromGrapesjs() would then read
          // the pre-keystroke text content, silently losing the user's latest typing.
          // The autosave debounce path in initEditor.ts already does this correctly.
          // Not part of the save recipe — stays here as a caller responsibility (T651.3).
          if (editor.Commands.isActive('text-edit')) {
            editor.stopCommand('text-edit')
          }

          // T651.3: unified save via requestSave. isSaving / saveError are set centrally.
          // 5 s timeout preserved from T647 to prevent a hung store() from freezing navigation.
          // console.error retained for log aggregation; navigation is never blocked —
          // a failed save is better than a frozen UI.
          const requestSaveFn = useEditorStore.getState().requestSave
          if (requestSaveFn) {
            try {
              await requestSaveFn({ timeoutMs: 5000 })
            } catch (err) {
              console.error('[EditorCanvas] Failed to save slide before switching:', err)
            }
          }
        }

        if (controller.signal.aborted) {
          clearTimeout(fallbackTimer)
          return
        }

        useEditorStore.getState().setEditorContext({ courseId, slideId })

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
          // TD-009: expose this load's promise so a StrictMode-twin Effect 2
          // run can await completion instead of firing a second load.
          lastLoadPromiseRef.current = loadPromise.then(() => undefined, () => undefined)
          loadPromise
            .then(() => {
              clearTimeout(fallbackTimer)
              setEditorLoading(false)
              lastLoadPromiseRef.current = null
              // isCancelled is set in this Effect 2 run's cleanup, so a stale .then() from a
              // superseded slide switch (or from a destroyed editor's load) cannot call
              // setIsReady(true) while the newer run is still in-flight.
              if (!isCancelled) {
                setIsReady(true)
              }
            })
            .catch((err) => {
              clearTimeout(fallbackTimer)
              setEditorLoading(false)
              lastLoadPromiseRef.current = null
              console.error('[EditorCanvas] load() failed:', err)
              // Always recover on load failure, even if this run was cancelled.
              // - Component unmounted: setIsReady is a no-op in React 18.
              // - New run started: new run called setIsReady(false) synchronously
              //   before its own editor.load(), so this transient true is harmless
              //   (it will be overridden when the new run completes).
              // The isCancelled guard here was blocking ALL recovery when GrapesJS's
              // loadData() threw (e.g. forEach TypeError), leaving data-editor-ready
              // permanently stuck at "false" and causing waitForCanvas() to time out.
              setIsReady(true)
            })
        } else {
          setEditorLoading(false)
          clearTimeout(fallbackTimer)
          // Fallback for older GrapesJS versions where load() is synchronous or lacks promise.
          if (!isCancelled) {
            setIsReady(true)
          }
        }
      } catch (err) {
        clearTimeout(fallbackTimer)
        console.error('[EditorCanvas] Unexpected error during slide switch:', err)
        if (!isCancelled) {
          setIsReady(true)
        }
      }
    }

    void saveAndLoad()

    return () => {
      isCancelled = true
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
