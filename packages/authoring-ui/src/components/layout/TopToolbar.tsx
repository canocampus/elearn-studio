/**
 * Top toolbar — T010.9
 * Buttons: course title | New Slide | Delete Slide | Preview | Publish
 */

import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { addSlide, deleteSlide, nextSlideTitle } from '../../api/courseApi'
import { invalidateCourseCache } from '../../editor/storageManager'
import { useToast } from '../ui/Toast'
import { useDebugMode } from '../../hooks/useDebugMode'
import { saveUserTemplate } from '../../templates/courseTemplates'

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
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const toast = useToast()
  const isDebug = useDebugMode()
  const course = useEditorStore(s => s.course)
  const setCourse = useEditorStore(s => s.setCourse)
  const currentSlideIndex = useEditorStore(s => s.currentSlideIndex)
  const setCurrentSlideIndex = useEditorStore(s => s.setCurrentSlideIndex)
  const isSaving = useEditorStore(s => s.isSaving)
  const setIsSaving = useEditorStore(s => s.setIsSaving)
  const setSaveError = useEditorStore(s => s.setSaveError)
  const setShowNewCourseDialog = useEditorStore(s => s.setShowNewCourseDialog)

  const currentSlide = course?.slides[currentSlideIndex]

  async function handleNewSlide() {
    if (!course) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await addSlide(course._id, nextSlideTitle(course.slides))
      invalidateCourseCache()
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

  function handleSaveAsTemplate() {
    if (!course) return
    setShowSaveTemplate(true)
  }

  function handleSaveTemplateConfirm(name: string) {
    if (!course) return
    saveUserTemplate({
      id: `user-${Date.now()}`,
      name,
      description: `Saved from "${course.title}"`,
      icon: '📋',
      isBuiltIn: false,
      slides: course.slides.map(slide => ({
        title: slide.title,
        widgets: slide.widgets.map(({ id: _id, actions: _actions, ...rest }) => rest),
      })),
    })
    setShowSaveTemplate(false)
    toast.success('Template saved.')
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
      invalidateCourseCache()
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
    <>
    {showSaveTemplate && course && (
      <SaveTemplateDialog
        defaultName={`${course.title} Template`}
        onConfirm={handleSaveTemplateConfirm}
        onCancel={() => setShowSaveTemplate(false)}
      />
    )}
    <div style={styles.toolbar}>
      <span style={styles.logo}>eLearn Studio</span>
      <span style={styles.separator} />
      <span style={styles.courseTitle}>{course?.title ?? '—'}</span>
      {isSaving && <span role="status" aria-live="polite" style={styles.savingBadge}>Saving…</span>}

      <span style={styles.spacer} />

      <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowNewCourseDialog(true)} title="New course">
        New Course
      </button>

      <span style={styles.divider} />

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

      <button style={styles.btn} onClick={handleSaveAsTemplate} title="Save current course as a template" disabled={!course}>
        Save as Template
      </button>

      <span style={styles.divider} />

      <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onPreview}>
        Preview
      </button>
      <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onPublish} disabled={publishing} aria-busy={publishing}>
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
    </>
  )
}

// ── SaveTemplateDialog ────────────────────────────────────────────────────────

interface SaveTemplateDialogProps {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

function SaveTemplateDialog({ defaultName, onConfirm, onCancel }: SaveTemplateDialogProps) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && name.trim()) onConfirm(name.trim())
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={saveDialogStyles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={saveDialogStyles.dialog} role="dialog" aria-modal="true" aria-label="Save as Template">
        <h2 style={saveDialogStyles.heading}>Save as Template</h2>
        <label style={saveDialogStyles.label} htmlFor="template-name-input">Template name</label>
        <input
          id="template-name-input"
          ref={inputRef}
          style={saveDialogStyles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={80}
          autoComplete="off"
        />
        <div style={saveDialogStyles.actions}>
          <button style={saveDialogStyles.btnCancel} onClick={onCancel}>Cancel</button>
          <button style={saveDialogStyles.btnSave} onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim()}>
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

const saveDialogStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 8,
    padding: '24px 28px',
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heading: { margin: 0, fontSize: 16, fontWeight: 600, color: '#cdd6f4' },
  label: { margin: 0, fontSize: 12, color: '#a6adc8', fontWeight: 500 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 13,
    outline: 'none',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  btnCancel: {
    padding: '6px 14px', fontSize: 12,
    background: 'transparent', border: '1px solid #45475a',
    borderRadius: 4, color: '#a6adc8', cursor: 'pointer',
  },
  btnSave: {
    padding: '6px 18px', fontSize: 12,
    background: '#89b4fa', border: '1px solid #89b4fa',
    borderRadius: 4, color: '#1e1e2e', fontWeight: 600, cursor: 'pointer',
  },
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
