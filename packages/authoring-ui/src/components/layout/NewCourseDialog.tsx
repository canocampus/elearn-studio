/**
 * NewCourseDialog — T043
 *
 * Modal dialog for creating a new course. Shows a title input and a grid of
 * template cards (Blank + 4 built-in templates + any user-saved templates).
 */

import { useState, useEffect, useRef } from 'react'
import { getAllTemplates, type CourseTemplate } from '../../templates/courseTemplates'

interface NewCourseDialogProps {
  onConfirm: (title: string, template: CourseTemplate | null) => void
  onCancel: () => void
}

export function NewCourseDialog({ onConfirm, onCancel }: NewCourseDialogProps) {
  const [title, setTitle] = useState('Untitled Course')
  const [selectedId, setSelectedId] = useState<string | null>(null) // null = Blank
  const templates = getAllTemplates()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  function handleConfirm() {
    const trimmed = title.trim()
    if (!trimmed) return
    // Re-fetch at confirm time in case a user template was removed while the dialog was open
    const currentTemplates = getAllTemplates()
    const template = selectedId ? (currentTemplates.find(t => t.id === selectedId) ?? null) : null
    onConfirm(trimmed, template)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={s.dialog} role="dialog" aria-modal="true" aria-label="New Course">
        <h2 style={s.heading}>New Course</h2>

        {/* Title input */}
        <label style={s.label} htmlFor="new-course-title">Course title</label>
        <input
          id="new-course-title"
          ref={inputRef}
          style={s.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={120}
          autoComplete="off"
        />

        {/* Template grid */}
        <p style={s.label}>Choose a template</p>
        <div style={s.grid}>
          {/* Blank option */}
          <TemplateCard
            name="Blank"
            description="Start from scratch with a single empty slide."
            icon="☐"
            selected={selectedId === null}
            onSelect={() => setSelectedId(null)}
          />
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              name={t.name}
              description={t.description}
              icon={t.icon}
              isBuiltIn={t.isBuiltIn}
              selected={selectedId === t.id}
              onSelect={() => setSelectedId(t.id)}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={s.actions}>
          <button style={s.btnCancel} onClick={onCancel}>Cancel</button>
          <button style={s.btnCreate} onClick={handleConfirm} disabled={!title.trim()}>
            Create Course
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template Card ───────────────────────────────────────────────────────────

interface TemplateCardProps {
  name: string
  description: string
  icon: string
  isBuiltIn?: boolean
  selected: boolean
  onSelect: () => void
}

function TemplateCard({ name, description, icon, isBuiltIn, selected, onSelect }: TemplateCardProps) {
  return (
    <button
      style={{
        ...s.card,
        ...(selected ? s.cardSelected : {}),
      }}
      onClick={onSelect}
      type="button"
      aria-pressed={selected}
    >
      <span style={s.cardIcon}>{icon}</span>
      <span style={s.cardName}>{name}</span>
      {isBuiltIn === false && <span style={s.userBadge}>Custom</span>}
      <span style={s.cardDesc}>{description}</span>
    </button>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 8,
    padding: '28px 32px',
    width: 640,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#cdd6f4',
  },
  label: {
    margin: 0,
    fontSize: 12,
    color: '#a6adc8',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    background: '#181825',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 14,
    outline: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
    marginTop: 4,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '12px 14px',
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#cdd6f4',
    transition: 'border-color 0.1s',
    minHeight: 100,
  },
  cardSelected: {
    borderColor: '#89b4fa',
    background: '#1a2540',
  },
  cardIcon: {
    fontSize: 22,
    lineHeight: 1,
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#cdd6f4',
  },
  cardDesc: {
    fontSize: 11,
    color: '#a6adc8',
    lineHeight: 1.4,
  },
  userBadge: {
    fontSize: 10,
    background: '#313244',
    border: '1px solid #89b4fa',
    color: '#89b4fa',
    borderRadius: 3,
    padding: '1px 5px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  btnCancel: {
    padding: '7px 16px',
    fontSize: 13,
    background: 'transparent',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#a6adc8',
    cursor: 'pointer',
  },
  btnCreate: {
    padding: '7px 20px',
    fontSize: 13,
    background: '#89b4fa',
    border: '1px solid #89b4fa',
    borderRadius: 4,
    color: '#1e1e2e',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
