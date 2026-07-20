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

import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { useComponentProperty, useExtendedProperty } from '../../hooks/useComponentProperty'

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
// AudioSourceSection — URL input + Asset Manager picker
// ---------------------------------------------------------------------------

/**
 * Known audio file extensions. Extension check is a defense-in-depth guard
 * in case a non-audio asset passes through the AM type filter.
 */
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.webm'])

function isAudioUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase()
    return AUDIO_EXTENSIONS.has(ext)
  } catch {
    // Relative or malformed URL — check the raw string
    const ext = url.substring(url.lastIndexOf('.')).toLowerCase().split('?')[0]
    return AUDIO_EXTENSIONS.has(ext)
  }
}

function openAudioPicker(editor: Editor, onPick: (src: string) => void) {
  editor.AssetManager.open({
    // 'image' included as fallback for assets uploaded before type detection was added.
    types: ['audio', 'image'],
    select(asset: { getSrc: () => string }, complete: boolean) {
      const src = asset.getSrc()
      if (!src) return
      if (!isAudioUrl(src)) {
        // Warn the user — do not set a non-audio file as the narration source
        alert('Please select an audio file (.mp3, .wav, .ogg, .m4a, .aac, .flac, .opus, .webm).')
        return
      }
      onPick(src)
      if (complete) editor.AssetManager.close()
    },
  })
}

function AudioSourceSection({ editor, component }: { editor: Editor; component: Component }) {
  const [src, setSrc] = useComponentProperty<string>(component, 'src', '')

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
  const [autoplay, setAutoplay] = useExtendedProperty<boolean>(component, 'autoplay', false)
  const [controls, setControls] = useExtendedProperty<boolean>(component, 'controls', true)

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

  // TD-010: return null; centralised empty-state lives in AppLayout.
  if (!editor || !selectedComponentType || !isAudioNarrationWidgetType(selectedComponentType)) {
    return null
  }

  const selected = editor.getSelected()
  if (!selected) return null
  // TD-022: Backbone double-check (T648). Zustand routing can lag the real
  // selection by a render — without this gate the sections below mount their
  // hooks on whatever getSelected() returns, editing the wrong widget.
  if ((selected.get('type') as string) !== 'audio-narration') return null

  return (
    <div data-testid="audio-narration-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      <AudioSourceSection editor={editor} component={selected} />
      <PlaybackOptionsSection component={selected} />
    </div>
  )
}
