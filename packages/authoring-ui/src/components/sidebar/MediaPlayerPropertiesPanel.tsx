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

import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { useComponentProperty, useExtendedProperty } from '../../hooks/useComponentProperty'

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
// MediaSourceSection — URL input + Asset Manager picker
// ---------------------------------------------------------------------------

function openMediaPicker(
  editor: Editor,
  types: string[],
  onPick: (src: string) => void,
) {
  editor.AssetManager.open({
    types,
    select(asset: { getSrc: () => string }, complete: boolean) {
      const src = asset.getSrc()
      if (!src) return
      onPick(src)
      if (complete) editor.AssetManager.close()
    },
  })
}

function MediaSourceSection({ editor, component }: { editor: Editor; component: Component }) {
  const [src, setSrc] = useComponentProperty<string>(component, 'src', '')
  const [mediaType] = useComponentProperty<string>(component, 'mediaType', 'video')

  function handleChooseMedia() {
    // Filter by the current media type so the picker only shows relevant assets.
    // 'image' included as fallback for assets uploaded before type detection was added.
    const types = mediaType === 'audio' ? ['audio', 'image'] : ['video', 'image']
    openMediaPicker(editor, types, (picked) => {
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
  const [mediaType, setMediaType] = useComponentProperty<string>(component, 'mediaType', 'video')

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
  const [autoplay, setAutoplay] = useExtendedProperty<boolean>(component, 'autoplay', false)
  const [controls, setControls] = useExtendedProperty<boolean>(component, 'controls', true)
  const [loop, setLoop] = useExtendedProperty<boolean>(component, 'loop', false)

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

  // TD-010: return null so a single centralised empty-state in AppLayout
  // shows ONE message instead of stacked panel placeholders.
  if (!editor || !selectedComponentType || !isMediaPlayerWidgetType(selectedComponentType)) {
    return null
  }

  const selected = editor.getSelected()
  if (!selected) return null

  return (
    <div data-testid="media-player-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <MediaSourceSection editor={editor} component={selected} />
      <MediaTypeSection component={selected} />
      <PlaybackOptionsSection component={selected} />
    </div>
  )
}
