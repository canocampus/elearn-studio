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
import { exportSCORM12 } from '../../api/courseApi'
import { TopToolbar } from './TopToolbar'
import { SlideList } from '../sidebar/SlideList'
import { BlockManagerPanel } from '../sidebar/BlockManagerPanel'
import { LayerManagerPanel } from '../sidebar/LayerManagerPanel'
import { StyleManagerPanel } from '../sidebar/StyleManagerPanel'
import { QuestionPropertiesPanel } from '../sidebar/QuestionPropertiesPanel'
import { AnimationPropertiesPanel } from '../sidebar/AnimationPropertiesPanel'
import { ActionsPanel } from '../actions/ActionsPanel'
import { EditorCanvas } from '../editor/EditorCanvas'
import { SimulationEditor } from '../simulation/SimulationEditor'

interface AppLayoutProps {
  courseId: string
}

export function AppLayout({ courseId }: AppLayoutProps) {
  const course = useEditorStore(s => s.course)
  const currentSlideIndex = useEditorStore(s => s.currentSlideIndex)
  const leftTab = useEditorStore(s => s.leftTab)
  const setLeftTab = useEditorStore(s => s.setLeftTab)
  const rightTab = useEditorStore(s => s.rightTab)
  const setRightTab = useEditorStore(s => s.setRightTab)

  const [publishing, setPublishing] = useState(false)
  const currentSlide = course?.slides[currentSlideIndex]

  function handlePreview() {
    // T017: full preview mode — future enhancement
    alert('Preview mode — coming soon')
  }

  async function handlePublish() {
    if (!course) return
    setPublishing(true)
    try {
      await exportSCORM12(course._id, course.title)
    } catch (err) {
      alert(`Publish failed: ${err instanceof Error ? err.message : err}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* T024.2 — SimulationEditor overlays the entire IDE when open */}
      <SimulationEditor />
      <TopToolbar onPreview={handlePreview} onPublish={handlePublish} publishing={publishing} />

      <div style={styles.body}>
        {/* ---- Left sidebar ---- */}
        <aside style={styles.sidebar}>
          <div style={styles.tabBar}>
            <TabButton label="Slides" active={leftTab === 'slides'} onClick={() => setLeftTab('slides')} />
            <TabButton label="Blocks" active={leftTab === 'blocks'} onClick={() => setLeftTab('blocks')} />
          </div>

          <div style={{ display: leftTab === 'slides' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <SlideList />
          </div>
          <div style={{ display: leftTab === 'blocks' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <BlockManagerPanel />
          </div>
        </aside>

        {/* ---- Canvas ---- */}
        <main style={styles.canvasArea}>
          {currentSlide ? (
            <EditorCanvas
              courseId={courseId}
              slideId={currentSlide.id}
            />
          ) : (
            <div style={styles.noSlide}>
              No slides yet — click <strong>+ New Slide</strong> to start
            </div>
          )}
        </main>

        {/* ---- Right sidebar ---- */}
        <aside style={{ ...styles.sidebar, borderRight: 'none', borderLeft: '1px solid #313244' }}>
          <div style={styles.tabBar}>
            <TabButton label="Layers" active={rightTab === 'layers'} onClick={() => setRightTab('layers')} />
            <TabButton label="Styles" active={rightTab === 'styles'} onClick={() => setRightTab('styles')} />
            <TabButton label="Props" active={rightTab === 'properties'} onClick={() => setRightTab('properties')} />
            <TabButton label="Actions" active={rightTab === 'actions'} onClick={() => setRightTab('actions')} />
            <TabButton label="Anim" active={rightTab === 'animations'} onClick={() => setRightTab('animations')} />
          </div>

          <div style={{ display: rightTab === 'layers' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <LayerManagerPanel />
          </div>
          <div style={{ display: rightTab === 'styles' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <StyleManagerPanel />
          </div>
          <div style={{ display: rightTab === 'properties' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <QuestionPropertiesPanel />
          </div>
          <div style={{ display: rightTab === 'actions' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <ActionsPanel />
          </div>
          <div style={{ display: rightTab === 'animations' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <AnimationPropertiesPanel />
          </div>
        </aside>
      </div>
    </div>
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
    alignItems: 'center',
    justifyContent: 'center',
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
