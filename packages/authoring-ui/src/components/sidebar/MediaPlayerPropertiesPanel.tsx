/**
 * Media Player Properties Panel — T604
 *
 * Shown in the "Props" tab when a media-player widget is selected.
 * Fixes BETA-10 (Media Player properties panel not implemented).
 *
 * Fields:
 *   - Media URL (text input + Asset Manager picker for audio/video)
 *   - Media Type (video / audio select)
 *   - Autoplay (checkbox) — stored in extendedProperties
 *   - Show Controls (checkbox) — stored in extendedProperties
 *   - Loop (checkbox) — stored in extendedProperties
 *
 * src and mediaType are read/written via component.get/set() on named traits.
 * Playback options (autoplay, controls, loop) live in extendedProperties to
 * match the widget data model used by PhaserSim and other rich widget types.
 */

import { useState, useEffect, useRef } from 'react'
import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isMediaPlayerWidgetType(type: string): boolean {
  return type === 'media-player'
}

// ---------------------------------------------------------------------------
// Shared styles (mirrors ButtonPropertiesPanel)
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

interface ExtendedProperties {
  autoplay?: boolean
  controls?: boolean
  loop?: boolean
  [key: string]: unknown
}

function getExtended(component: Component): ExtendedProperties {
  const raw = component.get('extendedProperties' as 'type')
  return (raw && typeof raw === 'object' ? raw : {}) as ExtendedProperties
}

function useExtendedBool(
  component: Component,
  key: keyof ExtendedProperties,
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
// MediaSourceSection — URL input + Asset Manager picker
// ---------------------------------------------------------------------------

function openMediaPicker(editor: Editor, component: Component, onPick: (src: string) => void) {
  editor.AssetManager.open({
    types: ['image'],  // GrapesJS AM; we accept any uploaded asset
    select(asset: { getSrc: () => string }, complete: boolean) {
      const src = asset.getSrc()
      if (!src) return
      onPick(src)
      if (complete) editor.AssetManager.close()
    },
  })
}

function MediaSourceSection({ editor, component }: { editor: Editor; component: Component }) {
  const [src, setSrc] = useTrait(component, 'src', '')

  function handleChooseMedia() {
    openMediaPicker(editor, component, (picked) => {
      setSrc(picked)
    })
  }

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Media Source</div>
      <label style={LABEL_STYLE}>Media URL</label>
      <input
        type="text"
        value={src}
        onChange={e => setSrc(e.target.value)}
        style={{ ...FIELD_STYLE, marginBottom: 6 }}
        placeholder="https://example.com/video.mp4"
      />
      <button style={BUTTON_STYLE} onClick={handleChooseMedia}>
        Choose from Asset Library…
      </button>
      {src && (
        <button
          style={{ ...BUTTON_STYLE, marginTop: 6, color: '#f38ba8' }}
          onClick={() => setSrc('')}
        >
          Clear Source
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MediaTypeSection — video / audio selector
// ---------------------------------------------------------------------------

function MediaTypeSection({ component }: { component: Component }) {
  const [mediaType, setMediaType] = useTrait(component, 'mediaType', 'video')

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Media Type</div>
      <label style={LABEL_STYLE}>Type</label>
      <select
        value={mediaType}
        onChange={e => setMediaType(e.target.value)}
        style={FIELD_STYLE}
      >
        <option value="video">Video</option>
        <option value="audio">Audio</option>
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlaybackOptionsSection — autoplay / controls / loop
// ---------------------------------------------------------------------------

function PlaybackOptionsSection({ component }: { component: Component }) {
  const [autoplay, setAutoplay] = useExtendedBool(component, 'autoplay', false)
  const [controls, setControls] = useExtendedBool(component, 'controls', true)
  const [loop, setLoop] = useExtendedBool(component, 'loop', false)

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
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Autoplay</span>
      </label>
      <label style={CHECKBOX_ROW_STYLE}>
        <input
          type="checkbox"
          checked={loop}
          onChange={e => setLoop(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: '#cdd6f4' }}>Loop</span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export function MediaPlayerPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType || !isMediaPlayerWidgetType(selectedComponentType)) {
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
        Select a media player widget to edit its properties.
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
    <div data-testid="media-player-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <MediaSourceSection editor={editor} component={selected} />
      <MediaTypeSection component={selected} />
      <PlaybackOptionsSection component={selected} />
    </div>
  )
}
