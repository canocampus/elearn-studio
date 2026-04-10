/**
 * AnimationPropertiesPanel — T028.2 / T028.3
 *
 * Right-sidebar panel shown when any widget is selected.
 * Lets authors manage AnimationPath objects stored in
 *   widget.extendedProperties.animations: AnimationPath[]
 *
 * Features:
 *  - List all animations on the widget
 *  - Add / duplicate / delete an animation
 *  - Edit name, duration, easing, loop, delay, fill inline
 *  - "Edit Path" button opens PathEditorCanvas overlay (T028.1)
 *
 * Persists changes via GrapesJS component.set('extendedProperties', {...}).
 */

import { useState } from 'react'
import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { PathEditorCanvas } from '../konva/PathEditorCanvas'
import { useComponentProperty } from '../../hooks/useComponentProperty'

// ─── Types (mirrored from runtime-player/src/animations/animator.ts) ────────

export interface AnimationKeypoint {
  x: number
  y: number
  t?: number
}

export type AnimationFill = 'none' | 'forwards' | 'backwards' | 'both' | 'auto'

export interface AnimationPath {
  id: string
  name: string
  keypoints: AnimationKeypoint[]
  duration: number
  easing: string
  loop: number
  delay?: number
  fill?: AnimationFill
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EASING_OPTIONS = [
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
] as const

function newAnimation(): AnimationPath {
  return {
    id: `anim-${Date.now()}`,
    name: 'New Animation',
    keypoints: [{ x: 0, y: 0 }],
    duration: 1000,
    easing: 'ease',
    loop: 1,
    delay: 0,
    fill: 'none',
  }
}

// ─── Inner panel — only rendered when component is guaranteed non-null ────────

const EMPTY_EP: Record<string, unknown> = {}

function AnimationPanelContent({ component }: { component: Component }) {
  const [ep, setEp, getLatestEp] = useComponentProperty<Record<string, unknown>>(
    component,
    'extendedProperties',
    EMPTY_EP,
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pathEditorOpen, setPathEditorOpen] = useState(false)

  const animations: AnimationPath[] = Array.isArray(ep.animations)
    ? (ep.animations as AnimationPath[])
    : []

  const resolvedSelectedId = animations.some(a => a.id === selectedId)
    ? selectedId
    : (animations[0]?.id ?? null)
  const selected = animations.find(a => a.id === resolvedSelectedId) ?? null

  // ── Persistence helper ──────────────────────────────────────────────────
  // setEp writes to component.set('extendedProperties', ...) which triggers
  // the debounced autosave in initEditor.ts. Never call editor.store() directly.
  function save(updated: AnimationPath[]) {
    setEp({ ...getLatestEp(), animations: updated })
  }

  // ── CRUD ────────────────────────────────────────────────────────────────
  function addAnimation() {
    const anim = newAnimation()
    save([...animations, anim])
    setSelectedId(anim.id)
  }

  function deleteAnimation(id: string) {
    const next = animations.filter(a => a.id !== id)
    save(next)
    setSelectedId(next[0]?.id ?? null)
  }

  function updateAnimation(updated: AnimationPath) {
    save(animations.map(a => (a.id === updated.id ? updated : a)))
  }

  function handleKeypointsSave(keypoints: AnimationKeypoint[]) {
    if (selected) updateAnimation({ ...selected, keypoints })
    setPathEditorOpen(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Animations</span>
        <button style={styles.addBtn} onClick={addAnimation} title="Add animation">+</button>
      </div>

      {/* Animation list */}
      <div style={styles.list}>
        {animations.length === 0 && (
          <div style={styles.empty}>No animations. Click + to add one.</div>
        )}
        {animations.map(anim => (
          <div
            key={anim.id}
            style={{
              ...styles.listItem,
              ...(anim.id === resolvedSelectedId ? styles.listItemSelected : {}),
            }}
            onClick={() => setSelectedId(anim.id)}
          >
            <span style={styles.listItemName}>{anim.name}</span>
            <button
              style={styles.deleteBtn}
              onClick={(e) => { e.stopPropagation(); deleteAnimation(anim.id) }}
              title="Delete animation"
            >×</button>
          </div>
        ))}
      </div>

      {/* Edit form */}
      {selected && (
        <div style={styles.form}>
          {/* Name */}
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={selected.name}
            onChange={e => updateAnimation({ ...selected, name: e.target.value })}
          />

          {/* Duration */}
          <label style={styles.label}>Duration (ms)</label>
          <input
            style={styles.input}
            type="number"
            min={0}
            step={100}
            value={selected.duration}
            onChange={e => updateAnimation({ ...selected, duration: parseInt(e.target.value, 10) || 0 })}
          />

          {/* Easing */}
          <label style={styles.label}>Easing</label>
          <select
            style={styles.select}
            value={EASING_OPTIONS.includes(selected.easing as typeof EASING_OPTIONS[number]) ? selected.easing : 'linear'}
            onChange={e => updateAnimation({ ...selected, easing: e.target.value })}
          >
            {EASING_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            {!EASING_OPTIONS.includes(selected.easing as typeof EASING_OPTIONS[number]) && (
              <option value={selected.easing}>{selected.easing} (custom)</option>
            )}
          </select>

          {/* Loop */}
          <label style={styles.label}>Loop (–1 = infinite, 1+ = count)</label>
          <input
            style={styles.input}
            type="number"
            min={-1}
            step={1}
            value={selected.loop}
            onChange={e => updateAnimation({ ...selected, loop: parseInt(e.target.value, 10) || 1 })}
          />

          {/* Delay */}
          <label style={styles.label}>Delay (ms)</label>
          <input
            style={styles.input}
            type="number"
            min={0}
            step={50}
            value={selected.delay ?? 0}
            onChange={e => updateAnimation({ ...selected, delay: parseInt(e.target.value, 10) || 0 })}
          />

          {/* Fill */}
          <label style={styles.label}>Fill</label>
          <select
            style={styles.select}
            value={selected.fill ?? 'none'}
            onChange={e => updateAnimation({ ...selected, fill: e.target.value as AnimationFill })}
          >
            <option value="none">none</option>
            <option value="forwards">forwards</option>
            <option value="backwards">backwards</option>
            <option value="both">both</option>
            <option value="auto">auto</option>
          </select>

          {/* Path editor */}
          <div style={styles.pathRow}>
            <span style={styles.pathInfo}>
              {selected.keypoints.length} waypoint{selected.keypoints.length !== 1 ? 's' : ''}
            </span>
            <button style={styles.editPathBtn} onClick={() => setPathEditorOpen(true)}>
              Edit Path…
            </button>
          </div>
        </div>
      )}

      {/* Konva path editor overlay */}
      {pathEditorOpen && selected && (
        <PathEditorCanvas
          keypoints={selected.keypoints}
          onSave={handleKeypointsSave}
          onCancel={() => setPathEditorOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Outer component — null checks only ──────────────────────────────────────

const emptyState = (
  <div style={{ padding: 16, color: '#6c7086', fontSize: 12, textAlign: 'center' }}>
    Select a widget to manage its animations.
  </div>
)

export function AnimationPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType) return emptyState

  const component = editor.getSelected()
  if (!component) return emptyState

  return <AnimationPanelContent component={component} />
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
    borderTop: '1px solid #313244',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #313244',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#cdd6f4',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  addBtn: {
    background: '#45475a',
    color: '#cdd6f4',
    border: 'none',
    borderRadius: 3,
    width: 20,
    height: 20,
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: '20px',
    padding: 0,
    textAlign: 'center',
  },
  list: {
    maxHeight: 120,
    overflowY: 'auto',
    borderBottom: '1px solid #313244',
  },
  empty: {
    padding: '10px 12px',
    fontSize: 11,
    color: '#6c7086',
    fontStyle: 'italic',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 11,
    color: '#cdd6f4',
  },
  listItemSelected: {
    background: '#313244',
  },
  listItemName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    overflowY: 'auto',
    maxHeight: 360,
  },
  label: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  input: {
    width: '100%',
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 3,
    color: '#cdd6f4',
    fontSize: 11,
    padding: '3px 6px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 3,
    color: '#cdd6f4',
    fontSize: 11,
    padding: '3px 4px',
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pathInfo: {
    fontSize: 11,
    color: '#6c7086',
  },
  editPathBtn: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 3,
    color: '#89b4fa',
    fontSize: 11,
    padding: '3px 8px',
    cursor: 'pointer',
  },
}
