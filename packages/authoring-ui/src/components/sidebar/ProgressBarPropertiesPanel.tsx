/**
 * Progress Bar Properties Panel — T608
 *
 * Shown in the "Props" tab when a progress-bar widget is selected.
 * Implements MISSING-03 (Course Progress Bar).
 *
 * Fields:
 *   - Bar color (color picker)
 *   - Bar height in px (number input, 4–40)
 *   - Show percentage text (checkbox) — stored in extendedProperties
 */

import { useState, useEffect, useRef } from 'react'
import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isProgressBarWidgetType(type: string): boolean {
  return type === 'progress-bar'
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

interface ProgressBarExtendedProperties {
  color?: string
  height?: number
  showPercent?: boolean
  [key: string]: unknown
}

function getExtended(component: Component): ProgressBarExtendedProperties {
  const raw = component.get('extendedProperties' as 'type')
  return (raw && typeof raw === 'object' ? raw : {}) as ProgressBarExtendedProperties
}

function useExtendedString(
  component: Component,
  key: keyof ProgressBarExtendedProperties,
  defaultValue: string,
): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    const ext = getExtended(component)
    return typeof ext[key] === 'string' ? (ext[key] as string) : defaultValue
  })
  const isLocalRef = useRef(false)

  useEffect(() => {
    const ext = getExtended(component)
    setValue(typeof ext[key] === 'string' ? (ext[key] as string) : defaultValue)

    function onChange() {
      if (isLocalRef.current) { isLocalRef.current = false; return }
      const updated = getExtended(component)
      setValue(typeof updated[key] === 'string' ? (updated[key] as string) : defaultValue)
    }

    component.on('change:extendedProperties', onChange)
    return () => { component.off('change:extendedProperties', onChange) }
  }, [component, key, defaultValue])

  function update(v: string) {
    isLocalRef.current = true
    setValue(v)
    const current = getExtended(component)
    component.set('extendedProperties', { ...current, [key]: v })
  }

  return [value, update]
}

function useExtendedNum(
  component: Component,
  key: keyof ProgressBarExtendedProperties,
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
  key: keyof ProgressBarExtendedProperties,
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
// Appearance section
// ---------------------------------------------------------------------------

function AppearanceSection({ component }: { component: Component }) {
  const [color, setColor] = useExtendedString(component, 'color', '#4f46e5')
  const [height, setHeight] = useExtendedNum(component, 'height', 12)
  const [showPercent, setShowPercent] = useExtendedBool(component, 'showPercent', true)

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Appearance</div>

      <label style={LABEL_STYLE}>Bar Color</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ width: 36, height: 28, padding: 2, border: '1px solid #45475a', borderRadius: 4, background: '#313244', cursor: 'pointer' }}
        />
        <input
          type="text"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ ...FIELD_STYLE, flex: 1, marginBottom: 0 }}
          placeholder="#4f46e5"
        />
      </div>

      <label style={LABEL_STYLE}>Bar Height (px)</label>
      <input
        type="number"
        min={4}
        max={40}
        value={height}
        onChange={e => {
          const n = parseInt(e.target.value, 10)
          setHeight(isNaN(n) ? height : Math.max(4, Math.min(40, n)))
        }}
        style={{ ...FIELD_STYLE, marginBottom: 10 }}
      />

      <label style={CHECKBOX_ROW_STYLE}>
        <input
          type="checkbox"
          checked={showPercent}
          onChange={e => setShowPercent(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Show percentage text</span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export function ProgressBarPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType || !isProgressBarWidgetType(selectedComponentType)) {
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
        Select a progress bar widget to edit its properties.
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
    <div data-testid="progress-bar-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <AppearanceSection component={selected} />
    </div>
  )
}
