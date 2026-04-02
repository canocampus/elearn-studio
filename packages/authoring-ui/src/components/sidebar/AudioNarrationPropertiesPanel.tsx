/**
 * Audio Narration Properties Panel — T607
 *
 * Shown in the "Props" tab when an audio-narration widget is selected.
 * Implements MISSING-01 (Audio narration component).
 *
 * Fields:
 *   - Audio URL (text input + Asset Manager picker)
 *   - Autoplay (checkbox) — stored in extendedProperties
 *   - Show Controls (checkbox) — stored in extendedProperties
 *
 * src is read/written via component.get/set() on the named trait.
 * Playback options live in extendedProperties to match the widget data model.
 */

import { useState, useEffect, useRef } from 'react'
import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isAudioNarrationWidgetType(type: string): boolean {
  return type === 'audio-narration'
}

// ---------------------------------------------------------------------------
// Shared styles (mirrors MediaPlayerPropertiesPanel)
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

const BUTTON_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#89b4fa',
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
}

const CHECKBOX_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// useTrait — bidirectional sync for a named trait on the component
// ---------------------------------------------------------------------------

function useTrait(component: Component, traitName: string, defaultValue: string): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    const raw = component.get(traitName as 'type')
    return typeof raw === 'string' && raw ? raw : defaultValue
  })
  const isLocalRef = useRef(false)

  useEffect(() => {
    const raw = component.get(traitName as 'type')
    setValue(typeof raw === 'string' && raw ? raw : defaultValue)

    function onChange() {
      if (isLocalRef.current) { isLocalRef.current = false; return }
      const updated = component.get(traitName as 'type')
      setValue(typeof updated === 'string' && updated ? updated : defaultValue)
    }

    component.on(`change:${traitName}`, onChange)
    return () => { component.off(`change:${traitName}`, onChange) }
  }, [component, traitName, defaultValue])

  function update(v: string) {
    isLocalRef.current = true
    setValue(v)
    component.set(traitName as 'type', v)
  }

  return [value, update]
}

// ---------------------------------------------------------------------------
// useExtendedBool — bidirectional sync for a boolean flag in extendedProperties
// ---------------------------------------------------------------------------

interface AudioExtendedProperties {
  autoplay?: boolean
  controls?: boolean
  [key: string]: unknown
}

function getExtended(component: Component): AudioExtendedProperties {
  const raw = component.get('extendedProperties' as 'type')
  return (raw && typeof raw === 'object' ? raw : {}) as AudioExtendedProperties
}

function useExtendedBool(
  component: Component,
  key: keyof AudioExtendedProperties,
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
    component.set('extendedProperties' as 'type', { ...current, [key]: v })
  }

  return [value, update]
}

// ---------------------------------------------------------------------------
// AudioSourceSection — URL input + Asset Manager picker
// ---------------------------------------------------------------------------

function openAudioPicker(editor: Editor, onPick: (src: string) => void) {
  editor.AssetManager.open({
    types: ['image'],  // GrapesJS AM uses 'image' type for all assets
    select(asset: { getSrc: () => string }, complete: boolean) {
      const src = asset.getSrc()
      if (!src) return
      onPick(src)
      if (complete) editor.AssetManager.close()
    },
  })
}

function AudioSourceSection({ editor, component }: { editor: Editor; component: Component }) {
  const [src, setSrc] = useTrait(component, 'src', '')

  function handleChooseAudio() {
    openAudioPicker(editor, (picked) => {
      setSrc(picked)
    })
  }

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Audio Source</div>
      <label style={LABEL_STYLE}>Audio URL</label>
      <input
        type="text"
        value={src}
        onChange={e => setSrc(e.target.value)}
        style={{ ...FIELD_STYLE, marginBottom: 6 }}
        placeholder="https://example.com/narration.mp3"
      />
      <button style={BUTTON_STYLE} onClick={handleChooseAudio}>
        Choose from Asset Library…
      </button>
      {src && (
        <button
          style={{ ...BUTTON_STYLE, marginTop: 6, color: '#f38ba8' }}
          onClick={() => setSrc('')}
        >
          Clear Audio
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlaybackOptionsSection — autoplay / controls
// ---------------------------------------------------------------------------

function PlaybackOptionsSection({ component }: { component: Component }) {
  const [autoplay, setAutoplay] = useExtendedBool(component, 'autoplay', false)
  const [controls, setControls] = useExtendedBool(component, 'controls', true)

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Playback Options</div>
      <label style={CHECKBOX_ROW_STYLE}>
        <input
          type="checkbox"
          checked={controls}
          onChange={e => setControls(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Show controls</span>
      </label>
      <label style={CHECKBOX_ROW_STYLE}>
        <input
          type="checkbox"
          checked={autoplay}
          onChange={e => setAutoplay(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Autoplay on slide load</span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export function AudioNarrationPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType || !isAudioNarrationWidgetType(selectedComponentType)) {
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
        Select an audio narration widget to edit its properties.
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
    <div data-testid="audio-narration-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <AudioSourceSection editor={editor} component={selected} />
      <PlaybackOptionsSection component={selected} />
    </div>
  )
}
