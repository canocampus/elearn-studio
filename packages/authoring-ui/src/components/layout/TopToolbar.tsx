/**
 * Top toolbar — T010.9
 * Buttons: course title | New Slide | Delete Slide | Preview | Publish
 */

import { useEditorStore } from '../../store/editorStore'
import { addSlide, deleteSlide, nextSlideTitle } from '../../api/courseApi'
import { useToast } from '../ui/Toast'
import { useDebugMode } from '../../hooks/useDebugMode'

interface TopToolbarProps {
  onPreview: () => void
  onPublish: () => void
  publishing?: boolean
  onToggleInspector?: () => void
  inspectorOpen?: boolean
  onToggleHistory?: () => void
  historyOpen?: boolean
}

export function TopToolbar({ onPreview, onPublish, publishing = false, onToggleInspector, inspectorOpen, onToggleHistory, historyOpen }: TopToolbarProps) {
  const toast = useToast()
  const isDebug = useDebugMode()
  const course = useEditorStore(s => s.course)
  const setCourse = useEditorStore(s => s.setCourse)
  const currentSlideIndex = useEditorStore(s => s.currentSlideIndex)
  const setCurrentSlideIndex = useEditorStore(s => s.setCurrentSlideIndex)
  const isSaving = useEditorStore(s => s.isSaving)
  const setIsSaving = useEditorStore(s => s.setIsSaving)
  const setSaveError = useEditorStore(s => s.setSaveError)

  const currentSlide = course?.slides[currentSlideIndex]

  async function handleNewSlide() {
    if (!course) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await addSlide(course._id, nextSlideTitle(course.slides))
      setCourse(updated)
      setCurrentSlideIndex(updated.slides.length - 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
      toast.error(`Failed to add slide: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteSlide() {
    if (!course || !currentSlide) return
    if (course.slides.length === 1) {
      toast.warning('A course must have at least one slide.')
      return
    }
    if (!confirm(`Delete "${currentSlide.title}"?`)) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await deleteSlide(course._id, currentSlide.id)
      setCourse(updated)
      const newIndex = Math.min(currentSlideIndex, updated.slides.length - 1)
      setCurrentSlideIndex(newIndex)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
      toast.error(`Failed to delete slide: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={styles.toolbar}>
      <span style={styles.logo}>eLearn Studio</span>
      <span style={styles.separator} />
      <span style={styles.courseTitle}>{course?.title ?? '—'}</span>
      {isSaving && <span style={styles.savingBadge}>Saving…</span>}

      <span style={styles.spacer} />

      <button style={styles.btn} onClick={handleNewSlide} title="Add slide">
        + New Slide
      </button>
      <button
        style={{ ...styles.btn, ...styles.btnDanger }}
        onClick={handleDeleteSlide}
        title="Delete current slide"
        disabled={!currentSlide}
      >
        Delete Slide
      </button>

      <span style={styles.divider} />

      <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onPreview}>
        Preview
      </button>
      <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onPublish} disabled={publishing}>
        {publishing ? 'Packaging…' : 'Publish SCORM'}
      </button>

      {import.meta.env.DEV && isDebug && (
        <>
          <span style={styles.divider} />
          <button
            style={{ ...styles.btn, ...(inspectorOpen ? styles.btnDebugActive : styles.btnDebug) }}
            onClick={onToggleInspector}
            title="Toggle Course Inspector"
            data-testid="debug-inspector-toggle"
          >
            {} JSON
          </button>
          <button
            style={{ ...styles.btn, ...(historyOpen ? styles.btnDebugActive : styles.btnDebug) }}
            onClick={onToggleHistory}
            title="Toggle Course History"
            data-testid="debug-history-toggle"
          >
            ⏱ History
          </button>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 48,
    padding: '0 16px',
    background: '#1e1e2e',
    borderBottom: '1px solid #313244',
    flexShrink: 0,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: '#cdd6f4',
    letterSpacing: '0.02em',
  },
  separator: {
    width: 1,
    height: 20,
    background: '#45475a',
  },
  courseTitle: {
    fontSize: 13,
    color: '#a6adc8',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  savingBadge: {
    fontSize: 11,
    color: '#a6e3a1',
    background: '#1e3a2f',
    padding: '2px 8px',
    borderRadius: 4,
  },
  spacer: {
    flex: 1,
  },
  btn: {
    padding: '5px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid #45475a',
    background: '#313244',
    color: '#cdd6f4',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    borderColor: '#f38ba8',
    color: '#f38ba8',
  },
  btnSecondary: {
    borderColor: '#89b4fa',
    color: '#89b4fa',
  },
  btnPrimary: {
    background: '#89b4fa',
    borderColor: '#89b4fa',
    color: '#1e1e2e',
    fontWeight: 600,
  },
  divider: {
    width: 1,
    height: 20,
    background: '#45475a',
    margin: '0 4px',
  },
  btnDebug: {
    borderColor: '#f9e2af',
    color: '#f9e2af',
    fontSize: 11,
  },
  btnDebugActive: {
    background: '#f9e2af',
    borderColor: '#f9e2af',
    color: '#1e1e2e',
    fontWeight: 600,
    fontSize: 11,
  },
}
