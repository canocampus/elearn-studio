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

import { useState, useEffect, useRef } from 'react'
import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'

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
// Extended properties helpers
// ---------------------------------------------------------------------------

interface VolumeExtendedProperties {
  defaultVolume?: number
  showMute?: boolean
  [key: string]: unknown
}

function getExtended(component: Component): VolumeExtendedProperties {
  const raw = component.get('extendedProperties' as 'type')
  return (raw && typeof raw === 'object' ? raw : {}) as VolumeExtendedProperties
}

function useExtendedNum(
  component: Component,
  key: keyof VolumeExtendedProperties,
  defaultValue: number,
): [number, (v: number) => void] {
  const [value, setValue] = useState<number>(() => {
    const ext = getExtended(component)
    return typeof ext[key] === 'number' ? (ext[key] as number) : defaultValue
  })
  const isLocalRef = useRef(false)

  useEffect(() => {
    const ext = getExtended(component)
    setValue(typeof ext[key] === 'number' ? (ext[key] as number) : defaultValue)

    function onChange() {
      if (isLocalRef.current) { isLocalRef.current = false; return }
      const updated = getExtended(component)
      setValue(typeof updated[key] === 'number' ? (updated[key] as number) : defaultValue)
    }

    component.on('change:extendedProperties', onChange)
    return () => { component.off('change:extendedProperties', onChange) }
  }, [component, key, defaultValue])

  function update(v: number) {
    isLocalRef.current = true
    setValue(v)
    const current = getExtended(component)
    component.set('extendedProperties', { ...current, [key]: v })
  }

  return [value, update]
}

function useExtendedBool(
  component: Component,
  key: keyof VolumeExtendedProperties,
  defaultValue: boolean,
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const ext = getExtended(component)
    return key in ext ? Boolean(ext[key]) : defaultValue
  })
  const isLocalRef = useRef(false)

  useEffect(() => {
    const ext = getExtended(component)
    setValue(key in ext ? Boolean(ext[key]) : defaultValue)

    function onChange() {
      if (isLocalRef.current) { isLocalRef.current = false; return }
      const updated = getExtended(component)
      setValue(key in updated ? Boolean(updated[key]) : defaultValue)
    }

    component.on('change:extendedProperties', onChange)
    return () => { component.off('change:extendedProperties', onChange) }
  }, [component, key, defaultValue])

  function update(v: boolean) {
    isLocalRef.current = true
    setValue(v)
    const current = getExtended(component)
    component.set('extendedProperties', { ...current, [key]: v })
  }

  return [value, update]
}

// ---------------------------------------------------------------------------
// Volume options section
// ---------------------------------------------------------------------------

function VolumeOptionsSection({ component }: { component: Component }) {
  const [defaultVolume, setDefaultVolume] = useExtendedNum(component, 'defaultVolume', 80)
  const [showMute, setShowMute] = useExtendedBool(component, 'showMute', true)

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

  if (!editor || !selectedComponentType || !isVolumeControlWidgetType(selectedComponentType)) {
    return (
      <div
        style={{
          padding: 16,
          color: '#6c7086',
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Select a volume control widget to edit its properties.
      </div>
    )
  }

  const selected = editor.getSelected()
  if (!selected) {
    return (
      <div style={{ padding: 16, color: '#6c7086', fontSize: 12, textAlign: 'center' }}>
        No component selected.
      </div>
    )
  }

  return (
    <div data-testid="volume-control-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <VolumeOptionsSection component={selected} />
    </div>
  )
}
