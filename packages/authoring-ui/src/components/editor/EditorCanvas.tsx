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
  const setEditor = useEditorStore(s => s.setEditor)
  const setSelectedComponentType = useEditorStore(s => s.setSelectedComponentType)
  const setRightTab = useEditorStore(s => s.setRightTab)
  const [panelError, setPanelError] = useState<string | null>(null)

  // Effect 1: Initialize GrapesJS once per courseId.
  // A course change requires full re-init (different document structure).
  // slideId is intentionally excluded — slide switching is handled by Effect 2.
  useEffect(() => {
    if (!containerRef.current) return
    if (isInitializedRef.current) return

    const missing = [BLOCK_MANAGER_ID, LAYER_MANAGER_ID, STYLE_MANAGER_ID].filter(
      id => !document.getElementById(id),
    )
    if (missing.length > 0) {
      const msg = `Panel containers not found: ${missing.join(', ')}`
      console.error('[EditorCanvas]', msg)
      setPanelError(msg)
      return
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

        ed.on('component:selected', (component) => {
          const type: string = component.get('type') ?? ''
          setSelectedComponentType(type)
          if (isQuestionWidgetType(type)) {
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
    // setEditor is stable (Zustand) and intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  // Effect 2: Load slide content whenever courseId or slideId changes.
  // Also handles the initial load (autoload is disabled in initEditor).
  // Runs after Effect 1 on mount, so editorRef.current is already set.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    updateStorageContext({ courseId, slideId })
    void editor.load()
  }, [courseId, slideId])

  if (panelError) {
    return (
      <div style={{ color: '#f38ba8', fontSize: 13, padding: 24, textAlign: 'center' }}>
        Editor failed to initialise: {panelError}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      aria-label="Slide editor canvas"
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  )
}
