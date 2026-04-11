/**
 * Main authoring IDE layout.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  TopToolbar (48px)                                       │
 * ├──────────────┬───────────────────────────┬───────────────┤
 * │ Left (240px) │  Canvas (flex-grow)        │ Right (240px) │
 * │  [Slides]    │                            │  [Layers]     │
 * │  [Blocks]    │   GrapesJS iframe          │  [Styles]     │
 * └──────────────┴───────────────────────────┴───────────────┘
 *
 * T010.5-T010.8: Left = slide list + block manager; Right = layer + style manager.
 * Panel containers rendered first so GrapesJS can find them by ID on init.
 */

import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { exportSCORM12, exportSCORM2004, exportAICC } from '../../api/courseApi'
import { widgetsFromGrapesjs } from '../../editor/converters'
import { ToastProvider, useToast } from '../ui/Toast'
import { TopToolbar } from './TopToolbar'
import { PublishDialog, type PublishStatus, type ExportFormat } from './PublishDialog'
import { SlideList } from '../sidebar/SlideList'
import { BlockManagerPanel } from '../sidebar/BlockManagerPanel'
import { LayerManagerPanel } from '../sidebar/LayerManagerPanel'
import { StyleManagerPanel } from '../sidebar/StyleManagerPanel'
import { QuestionPropertiesPanel } from '../sidebar/QuestionPropertiesPanel'
import { PhaserSimPropertiesPanel } from '../sidebar/PhaserSimPropertiesPanel'
import { ButtonPropertiesPanel } from '../sidebar/ButtonPropertiesPanel'
import { MediaPlayerPropertiesPanel } from '../sidebar/MediaPlayerPropertiesPanel'
import { AudioNarrationPropertiesPanel } from '../sidebar/AudioNarrationPropertiesPanel'
import { ProgressBarPropertiesPanel } from '../sidebar/ProgressBarPropertiesPanel'
import { VolumeControlPropertiesPanel } from '../sidebar/VolumeControlPropertiesPanel'
import { AnimationPropertiesPanel } from '../sidebar/AnimationPropertiesPanel'
import { ActionsPanel } from '../actions/ActionsPanel'
import { EditorCanvas } from '../editor/EditorCanvas'
import { SimulationEditor } from '../simulation/SimulationEditor'
import { PhaserSimPreviewModal } from '../simulation/PhaserSimPreviewModal'
import { PanelErrorBoundary } from '../ui/ErrorBoundary'
import { SaveErrorBanner } from '../ui/SaveErrorBanner'
import { useDebugMode } from '../../hooks/useDebugMode'
import { CourseInspector } from '../debug/CourseInspector'
import { CourseHistory } from '../debug/CourseHistory'
import { ActionsDebugOverlay } from '../debug/ActionsDebugOverlay'

interface AppLayoutProps {
  courseId: string
}

function AppLayoutInner({ courseId }: AppLayoutProps) {
  const toast = useToast()
  const course = useEditorStore(s => s.course)
  const editor = useEditorStore(s => s.editor)
  const currentSlideIndex = useEditorStore(s => s.currentSlideIndex)
  const leftTab = useEditorStore(s => s.leftTab)
  const setLeftTab = useEditorStore(s => s.setLeftTab)
  const rightTab = useEditorStore(s => s.rightTab)
  const setRightTab = useEditorStore(s => s.setRightTab)

  const [publishing, setPublishing] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
  const [publishError, setPublishError] = useState('')
  const [showInspector, setShowInspector] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const isDebug = useDebugMode()
  const currentSlide = course?.slides[currentSlideIndex]

  function handlePreview() {
    if (!course) {
      toast.info('No course loaded')
      return
    }
    // T641.1: open runtime player in a new tab via postMessage ready-handshake.
    // Listener is attached BEFORE window.open() so the "ready" signal from the
    // popup is never missed (JS single-threaded: popup cannot run until this
    // call stack unwinds, by which point the listener is already registered).
    const origin = window.location.origin

    // The Zustand store's course.slides[i].widgets is the initial fetch state —
    // GrapesJS edits go through storageManager → backend but do NOT update the
    // store. Inject the live GrapesJS component tree for the current slide so
    // the preview reflects the actual canvas state, not the stale store.
    let previewCourse = course
    if (editor) {
      const currentWidgets = widgetsFromGrapesjs(editor.getComponents().toArray())
      const updatedSlides = course.slides.map((slide, i) =>
        i === currentSlideIndex ? { ...slide, widgets: currentWidgets } : slide
      )
      previewCourse = { ...course, slides: updatedSlides }
    }

    function onReady(e: MessageEvent) {
      if (e.source !== popup || e.data !== 'elearn-preview-ready') return
      window.removeEventListener('message', onReady)
      popup.postMessage(
        { type: 'elearn-preview-data', course: previewCourse, slideIndex: currentSlideIndex },
        origin,
      )
    }

    window.addEventListener('message', onReady)
    const popup = window.open('/preview.html', '_blank')
    if (!popup) {
      window.removeEventListener('message', onReady)
      toast.info('Preview blocked — allow popups for this site')
    }
  }

  function handlePublish() {
    if (!course) return
    setPublishStatus('idle')
    setPublishError('')
    setShowPublishDialog(true)
  }

  async function handleConfirmPublish(format: ExportFormat) {
    if (!course) return
    setPublishing(true)
    setPublishStatus('packaging')
    setPublishError('')
    try {
      if (format === 'scorm2004') {
        await exportSCORM2004(course._id, course.title)
      } else if (format === 'aicc') {
        await exportAICC(course._id, course.title)
      } else {
        await exportSCORM12(course._id, course.title)
      }
      setPublishStatus('done')
      toast.success('SCORM package ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPublishStatus('error')
      setPublishError(msg)
    } finally {
      setPublishing(false)
    }
  }

  function handleCancelPublish() {
    setShowPublishDialog(false)
    setPublishStatus('idle')
    setPublishError('')
  }

  return (
    <div style={styles.root}>
      {/* T024.2 — SimulationEditor overlays the entire IDE when open */}
      <SimulationEditor />
      {/* T034 — PhaserSimPreviewModal overlays the IDE for phaser sim preview */}
      <PhaserSimPreviewModal />
      {showPublishDialog && course && (
        <PublishDialog
          course={course}
          onConfirm={handleConfirmPublish}
          onCancel={handleCancelPublish}
          publishing={publishing}
          publishStatus={publishStatus}
          publishError={publishError}
        />
      )}
      <TopToolbar
        onPreview={handlePreview}
        onPublish={handlePublish}
        publishing={publishing}
        onToggleInspector={() => setShowInspector(v => !v)}
        inspectorOpen={showInspector}
        onToggleHistory={() => setShowHistory(v => !v)}
        historyOpen={showHistory}
      />
      {/* T622 — persistent save-error banner, shown below TopToolbar when save fails */}
      <SaveErrorBanner />
      {import.meta.env.DEV && isDebug && <ActionsDebugOverlay />}
      {import.meta.env.DEV && isDebug && showInspector && (
        <CourseInspector onClose={() => setShowInspector(false)} />
      )}
      {import.meta.env.DEV && isDebug && showHistory && (
        <CourseHistory courseId={courseId} onClose={() => setShowHistory(false)} />
      )}

      <div style={styles.body}>
        {/* ---- Left sidebar ---- */}
        <aside style={styles.sidebar} aria-label="Slide navigation">
          <div style={styles.tabBar} role="tablist" aria-label="Left panel tabs">
            <TabButton label="Slides" active={leftTab === 'slides'} onClick={() => setLeftTab('slides')} />
            <TabButton label="Blocks" active={leftTab === 'blocks'} onClick={() => setLeftTab('blocks')} />
          </div>

          <div style={{ display: leftTab === 'slides' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="SlideList">
              <SlideList />
            </PanelErrorBoundary>
          </div>
          
          {/* T010.5 — BlockManagerPanel MUST be in DOM for GrapesJS init */}
          <div style={{ display: leftTab === 'blocks' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="BlockManagerPanel">
              <BlockManagerPanel />
            </PanelErrorBoundary>
          </div>
        </aside>

        {/* ---- Canvas ---- */}
        <main style={styles.canvasArea}>
          {currentSlide ? (
            <PanelErrorBoundary name="EditorCanvas">
              <EditorCanvas
                courseId={courseId}
                slideId={currentSlide.id}
              />
            </PanelErrorBoundary>
          ) : (
            <div style={styles.noSlide}>
              No slides yet — click <strong>+ New Slide</strong> to start
            </div>
          )}
        </main>

        {/* ---- Right sidebar ---- */}
        <aside style={{ ...styles.sidebar, borderRight: 'none', borderLeft: '1px solid #313244' }} aria-label="Properties">
          <div style={styles.tabBar} role="tablist" aria-label="Right panel tabs">
            <TabButton label="Layers" active={rightTab === 'layers'} onClick={() => setRightTab('layers')} />
            <TabButton label="Styles" active={rightTab === 'styles'} onClick={() => setRightTab('styles')} />
            <TabButton label="Props" active={rightTab === 'properties'} onClick={() => setRightTab('properties')} />
            <TabButton label="Actions" active={rightTab === 'actions'} onClick={() => setRightTab('actions')} />
            <TabButton label="Anim" active={rightTab === 'animations'} onClick={() => setRightTab('animations')} />
          </div>

          {/* GrapesJS Panels (Layer & Style) MUST be in DOM for init */}
          <div style={{ display: rightTab === 'layers' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="LayerManagerPanel">
              <LayerManagerPanel />
            </PanelErrorBoundary>
          </div>
          <div style={{ display: rightTab === 'styles' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="StyleManagerPanel">
              <StyleManagerPanel />
            </PanelErrorBoundary>
          </div>
          <div style={{ display: rightTab === 'properties' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="QuestionPropertiesPanel">
              <QuestionPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="PhaserSimPropertiesPanel">
              <PhaserSimPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="ButtonPropertiesPanel">
              <ButtonPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="MediaPlayerPropertiesPanel">
              <MediaPlayerPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="AudioNarrationPropertiesPanel">
              <AudioNarrationPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="ProgressBarPropertiesPanel">
              <ProgressBarPropertiesPanel />
            </PanelErrorBoundary>
            <PanelErrorBoundary name="VolumeControlPropertiesPanel">
              <VolumeControlPropertiesPanel />
            </PanelErrorBoundary>
          </div>
          <div style={{ display: rightTab === 'actions' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="ActionsPanel">
              <ActionsPanel />
            </PanelErrorBoundary>
          </div>
          <div style={{ display: rightTab === 'animations' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <PanelErrorBoundary name="AnimationPropertiesPanel">
              <AnimationPropertiesPanel />
            </PanelErrorBoundary>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function AppLayout({ courseId }: AppLayoutProps) {
  return (
    <ToastProvider>
      <AppLayoutInner courseId={courseId} />
    </ToastProvider>
  )
}

interface TabButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 4px',
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        color: active ? '#89b4fa' : '#6c7086',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #89b4fa' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: '#1e1e2e',
    color: '#cdd6f4',
    fontFamily: 'Inter, system-ui, sans-serif',
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 240,
    display: 'flex',
    flexDirection: 'column',
    background: '#181825',
    borderRight: '1px solid #313244',
    flexShrink: 0,
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    background: '#1e1e2e',
    borderBottom: '1px solid #313244',
    flexShrink: 0,
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#11111b',
    overflow: 'hidden',
    position: 'relative',
  },
  noSlide: {
    color: '#6c7086',
    fontSize: 14,
    textAlign: 'center',
  },
}
