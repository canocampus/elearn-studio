/**
 * Volume Control Properties Panel — T609
 *
 * Shown in the "Props" tab when a volume-control widget is selected.
 * Implements MISSING-02 (Global Volume Control).
 *
 * Fields:
 *   - Default volume (0–100, number input) — stored in extendedProperties
 *   - Show mute button (checkbox) — stored in extendedProperties
 */

import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { useExtendedProperty } from '../../hooks/useComponentProperty'

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isVolumeControlWidgetType(type: string): boolean {
  return type === 'volume-control'
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#cdd6f4',
  fontSize: 12,
  padding: '5px 8px',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
}

const SECTION_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #313244',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#6c7086',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  marginBottom: 8,
}

const CHECKBOX_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// Volume options section
// ---------------------------------------------------------------------------

function VolumeOptionsSection({ component }: { component: Component }) {
  const [defaultVolume, setDefaultVolume] = useExtendedProperty<number>(component, 'defaultVolume', 80)
  const [showMute, setShowMute] = useExtendedProperty<boolean>(component, 'showMute', true)

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Volume Options</div>

      <label style={LABEL_STYLE}>Default Volume (0–100)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={100}
          value={defaultVolume}
          onChange={e => setDefaultVolume(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={defaultVolume}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= 0 && n <= 100) setDefaultVolume(n)
          }}
          style={{ ...FIELD_STYLE, width: 52, marginBottom: 0, flexShrink: 0 }}
        />
      </div>

      <label style={CHECKBOX_ROW_STYLE}>
        <input
          type="checkbox"
          checked={showMute}
          onChange={e => setShowMute(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Show mute button</span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export function VolumeControlPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  // TD-010: return null; centralised empty-state lives in AppLayout.
  if (!editor || !selectedComponentType || !isVolumeControlWidgetType(selectedComponentType)) {
    return null
  }

  const selected = editor.getSelected()
  if (!selected) return null
  // TD-022: Backbone double-check (T648). Zustand routing can lag the real
  // selection by a render — without this gate the sections below mount their
  // hooks on whatever getSelected() returns, editing the wrong widget.
  if ((selected.get('type') as string) !== 'volume-control') return null

  return (
    <div data-testid="volume-control-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <VolumeOptionsSection component={selected} />
    </div>
  )
}
