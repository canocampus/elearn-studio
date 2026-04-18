/**
 * Slide list sidebar — T010.5, T013
 * T013.1 — Add blank slide via "+" button
 * T013.2 — Duplicate slide via action button
 * T013.3 — Delete slide with confirm (disabled when only one slide)
 * T013.4 — Reorder slides via HTML5 drag-and-drop
 * T013.5 — Rename slide via double-click inline edit
 */

import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { Slide } from '../../types/course'
import {
  addSlide,
  deleteSlide,
  duplicateSlide,
  nextSlideTitle,
  reorderSlides,
  updateSlide,
} from '../../api/courseApi'
import { useToast } from '../ui/Toast'

export function SlideList() {
  const toast = useToast()
  const course = useEditorStore(s => s.course)
  const setCourse = useEditorStore(s => s.setCourse)
  const currentSlideIndex = useEditorStore(s => s.currentSlideIndex)
  const setCurrentSlideIndex = useEditorStore(s => s.setCurrentSlideIndex)
  const isSaving = useEditorStore(s => s.isSaving)
  const saveError = useEditorStore(s => s.saveError)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (!course) {
    return <div style={styles.empty}>No course loaded</div>
  }

  // TD-007 — All REST mutations route through requestCourseMutation:
  // centralised setIsSaving / setSaveError / bumpCacheVersion. Local per-op
  // flags were removed; the global `isSaving` flag replaces them for per-row
  // button disabled states. Toast level unified to `error`.
  function getSaveError() {
    return useEditorStore.getState().saveError ?? 'unknown error'
  }

  // -------------------------------------------------------------------------
  // T013.1 — Add blank slide
  // -------------------------------------------------------------------------

  async function handleAddSlide() {
    if (isSaving) return
    const updated = await useEditorStore.getState().requestCourseMutation(
      () => addSlide(course!._id, nextSlideTitle(course!.slides)),
    )
    if (!updated) {
      toast.error(`Failed to add slide: ${getSaveError()}`)
      return
    }
    setCourse(updated)
    setCurrentSlideIndex(updated.slides.length - 1)
  }

  // -------------------------------------------------------------------------
  // T013.2 — Duplicate slide
  // -------------------------------------------------------------------------

  async function handleDuplicate(slide: Slide) {
    if (isSaving) return
    const updated = await useEditorStore.getState().requestCourseMutation(
      () => duplicateSlide(course!._id, slide),
    )
    if (!updated) {
      toast.error(`Failed to duplicate slide: ${getSaveError()}`)
      return
    }
    setCourse(updated)
    setCurrentSlideIndex(updated.slides.length - 1)
  }

  // -------------------------------------------------------------------------
  // T013.3 — Delete slide (with confirm; disabled on last slide)
  // -------------------------------------------------------------------------

  async function handleDelete(slide: Slide, index: number) {
    if (isSaving || course!.slides.length <= 1) return
    if (!window.confirm(`Delete "${slide.title}"?`)) return
    const updated = await useEditorStore.getState().requestCourseMutation(
      () => deleteSlide(course!._id, slide.id),
    )
    if (!updated) {
      toast.error(`Failed to delete slide: ${getSaveError()}`)
      return
    }
    setCourse(updated)
    setCurrentSlideIndex(Math.min(index, updated.slides.length - 1))
  }

  // -------------------------------------------------------------------------
  // T013.5 — Rename slide (double-click → inline input → blur/Enter commits)
  // -------------------------------------------------------------------------

  function startEditing(slide: Slide) {
    setEditingId(slide.id)
    setEditingTitle(slide.title)
  }

  async function commitRename(slide: Slide) {
    if (isSaving) return
    const trimmed = editingTitle.trim()
    setEditingId(null)
    if (!trimmed || trimmed === slide.title) return
    const updated = await useEditorStore.getState().requestCourseMutation(
      () => updateSlide(course!._id, slide.id, { title: trimmed }),
    )
    if (!updated) {
      toast.error(`Failed to rename slide: ${getSaveError()}`)
      return
    }
    setCourse(updated)
  }

  // -------------------------------------------------------------------------
  // T013.4 — Reorder slides (drag-and-drop)
  // -------------------------------------------------------------------------

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (index !== dragIndex) setDropIndex(index)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    const ids = course!.slides.map(s => s.id)
    const moved = ids[dragIndex]!
    ids.splice(dragIndex, 1)
    // After removing dragIndex, indices above it shift down by 1
    const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex
    ids.splice(adjustedDropIndex, 0, moved)
    setDragIndex(null)
    setDropIndex(null)
    const updated = await useEditorStore.getState().requestCourseMutation(
      () => reorderSlides(course!._id, ids),
    )
    if (!updated) {
      toast.error(`Failed to reorder slides: ${getSaveError()}`)
      return
    }
    setCourse(updated)
    setCurrentSlideIndex(adjustedDropIndex)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDropIndex(null)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const canDelete = course.slides.length > 1

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {course.slides.map((slide, index) => (
          <SlideItem
            key={slide.id}
            slide={slide}
            index={index}
            isActive={index === currentSlideIndex}
            isEditing={editingId === slide.id}
            editingTitle={editingTitle}
            isDragging={dragIndex === index}
            isDropTarget={dropIndex === index && dragIndex !== index}
            canDelete={canDelete}
            isBusy={isSaving}
            onClick={() => { if (!saveError) setCurrentSlideIndex(index) }}
            onDoubleClick={() => startEditing(slide)}
            onDuplicate={() => handleDuplicate(slide)}
            onDelete={() => handleDelete(slide, index)}
            onRenameChange={setEditingTitle}
            onRenameCommit={() => commitRename(slide)}
            onRenameCancel={() => setEditingId(null)}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
      <button
        style={{ ...styles.addButton, opacity: isSaving ? 0.6 : 1 }}
        onClick={handleAddSlide}
        disabled={isSaving}
        title="Add blank slide"
      >
        + Add Slide
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SlideItem
// ---------------------------------------------------------------------------

/** Props for an individual slide row in the slide list panel. */
interface SlideItemProps {
  slide: Slide
  index: number
  isActive: boolean
  isEditing: boolean
  editingTitle: string
  isDragging: boolean
  isDropTarget: boolean
  canDelete: boolean
  isBusy: boolean
  onClick: () => void
  onDoubleClick: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRenameChange: (title: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function SlideItem({
  slide,
  index,
  isActive,
  isEditing,
  editingTitle,
  isDragging,
  isDropTarget,
  canDelete,
  isBusy,
  onClick,
  onDoubleClick,
  onDuplicate,
  onDelete,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SlideItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      data-testid="slide-item"
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Slide ${index + 1}: ${slide.title}`}
      aria-current={isActive ? 'true' : undefined}
      style={{
        ...styles.item,
        ...(isActive ? styles.itemActive : {}),
        ...(hovered && !isActive ? styles.itemHovered : {}),
        ...(isDragging ? styles.itemDragging : {}),
        ...(isDropTarget ? styles.itemDropTarget : {}),
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* T013.6: render real canvas thumbnail as a scaled srcdoc iframe */}
      <div style={styles.thumbnail}>
        {slide.thumbnail ? (
          <iframe
            srcDoc={slide.thumbnail}
            style={styles.thumbnailFrame}
            sandbox=""
            title={`Slide ${index + 1} preview`}
          />
        ) : (
          <span style={styles.thumbnailNumber}>{index + 1}</span>
        )}
      </div>

      <div style={styles.titleArea}>
        {isEditing ? (
          <input
            style={styles.titleInput}
            value={editingTitle}
            aria-label={`Rename slide: ${slide.title}`}
            autoFocus
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameCommit()
              if (e.key === 'Escape') onRenameCancel()
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span style={styles.title} title={slide.title}>
            {slide.title}
          </span>
        )}
      </div>

      {/* Action buttons — visible on hover or when active */}
      {(hovered || isActive) && !isEditing && (
        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, ...(isBusy ? styles.actionBtnDisabled : {}) }}
            onClick={e => { e.stopPropagation(); onDuplicate() }}
            title="Duplicate slide"
            disabled={isBusy}
          >
            ⧉
          </button>
          <button
            style={{ ...styles.actionBtn, ...(!canDelete || isBusy ? styles.actionBtnDisabled : {}) }}
            onClick={e => { e.stopPropagation(); onDelete() }}
            title={canDelete ? 'Delete slide' : 'Cannot delete last slide'}
            disabled={!canDelete || isBusy}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 8,
    overflowY: 'auto',
    flex: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  itemActive: {
    background: '#313244',
    border: '1px solid #89b4fa',
  },
  itemHovered: {
    background: '#1e1e2e',
  },
  itemDragging: {
    opacity: 0.4,
  },
  itemDropTarget: {
    borderTop: '2px solid #89b4fa',
  },
  thumbnail: {
    width: 48,
    height: 34,
    background: '#181825',
    borderRadius: 3,
    border: '1px solid #45475a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailFrame: {
    width: 1024,
    height: 768,
    border: 'none',
    transform: 'scale(0.0469)',
    transformOrigin: 'top left',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  thumbnailNumber: {
    fontSize: 11,
    color: '#6c7086',
    fontWeight: 600,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    color: '#cdd6f4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  titleInput: {
    width: '100%',
    fontSize: 12,
    color: '#cdd6f4',
    background: '#181825',
    border: '1px solid #89b4fa',
    borderRadius: 3,
    padding: '1px 4px',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 3,
    lineHeight: 1,
  },
  actionBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  addButton: {
    margin: '4px 8px 8px',
    padding: '6px 0',
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    width: 'calc(100% - 16px)',
  },
  empty: {
    padding: 16,
    color: '#6c7086',
    fontSize: 12,
  },
}
