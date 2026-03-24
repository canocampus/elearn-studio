/**
 * DiagramBuilderSection — T032.6
 *
 * Shown inside PhaserSimPropertiesPanel when simType === 'interactive-diagram'.
 * Provides:
 *   - Background image URL input (paste Garage asset URL or use asset picker)
 *   - Hotspot list editor: add, delete, and edit each DiagramHotspot
 *     (id, x, y, radius, label, description, isCorrect for assessment mode)
 *
 * Writes directly to sceneDef via the onSceneDefChange callback.
 */

import { useState } from 'react'
import type { InteractiveDiagramSceneDef, DiagramHotspot } from '../../types/phaserSim'

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const FIELD: React.CSSProperties = {
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

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
}

const SECTION: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #313244',
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#6c7086',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

const BTN_SMALL: React.CSSProperties = {
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#cdd6f4',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN_SMALL,
  color: '#f38ba8',
  borderColor: '#f38ba8',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _hotspotSeq = 0

function toDiagramDef(raw: Record<string, unknown> | null): InteractiveDiagramSceneDef {
  return {
    simType: 'interactive-diagram',
    backgroundImageUrl: typeof raw?.backgroundImageUrl === 'string' ? raw.backgroundImageUrl : '',
    // H3: validate each hotspot element is a non-null object with required fields
    hotspots: Array.isArray(raw?.hotspots)
      ? (raw.hotspots as unknown[]).filter((h): h is DiagramHotspot =>
          typeof h === 'object' && h !== null && !Array.isArray(h) &&
          typeof (h as DiagramHotspot).id === 'string',
        )
      : [],
    width: typeof raw?.width === 'number' ? raw.width : undefined,
    height: typeof raw?.height === 'number' ? raw.height : undefined,
  }
}

function makeHotspot(): DiagramHotspot {
  return {
    id: `hs-${++_hotspotSeq}-${Date.now()}`,
    x: 100,
    y: 100,
    radius: 20,
    label: '',
    description: '',
    isCorrect: false,
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  sceneDef: Record<string, unknown> | null
  onSceneDefChange: (def: InteractiveDiagramSceneDef) => void
}

// ---------------------------------------------------------------------------
// Hotspot editor sub-component
// ---------------------------------------------------------------------------

interface HotspotEditorProps {
  hotspot: DiagramHotspot
  index: number
  onChange: (patch: Partial<DiagramHotspot>) => void
  onDelete: () => void
}

function HotspotEditor({ hotspot, index, onChange, onDelete }: HotspotEditorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #45475a', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          background: '#1e1e2e',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: 11, color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {index + 1}. {hotspot.label || '(unlabelled)'} ({hotspot.x}, {hotspot.y})
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#6c7086' }}>{expanded ? '▲' : '▼'}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={BTN_DANGER}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: 8, background: '#181825' }}>
          <label style={LABEL}>Label</label>
          <input
            type="text"
            value={hotspot.label}
            onChange={e => onChange({ label: e.target.value })}
            style={{ ...FIELD, marginBottom: 8 }}
            placeholder="Hotspot label"
          />

          <label style={LABEL}>Description</label>
          <textarea
            value={hotspot.description}
            onChange={e => onChange({ description: e.target.value })}
            rows={2}
            style={{ ...FIELD, resize: 'vertical', marginBottom: 8 }}
            placeholder="Popup description text"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LABEL}>X (px)</label>
              <input
                type="number"
                min={0}
                value={hotspot.x}
                onChange={e => onChange({ x: Math.max(0, Number(e.target.value)) })}
                style={FIELD}
              />
            </div>
            <div>
              <label style={LABEL}>Y (px)</label>
              <input
                type="number"
                min={0}
                value={hotspot.y}
                onChange={e => onChange({ y: Math.max(0, Number(e.target.value)) })}
                style={FIELD}
              />
            </div>
            <div>
              <label style={LABEL}>Radius</label>
              <input
                type="number"
                min={5}
                value={hotspot.radius}
                onChange={e => onChange({ radius: Math.max(5, Number(e.target.value)) })}
                style={FIELD}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              id={`correct-${hotspot.id}`}
              checked={hotspot.isCorrect ?? false}
              onChange={e => onChange({ isCorrect: e.target.checked })}
            />
            <label htmlFor={`correct-${hotspot.id}`} style={{ ...LABEL, marginBottom: 0, cursor: 'pointer' }}>
              Correct answer (assessment mode)
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiagramBuilderSection({ sceneDef, onSceneDefChange }: Props) {
  const def = toDiagramDef(sceneDef)
  const [imgLoadError, setImgLoadError] = useState(false)

  function patch(changes: Partial<InteractiveDiagramSceneDef>): void {
    onSceneDefChange({ ...def, ...changes })
  }

  function addHotspot(): void {
    patch({ hotspots: [...def.hotspots, makeHotspot()] })
  }

  function deleteHotspot(index: number): void {
    patch({ hotspots: def.hotspots.filter((_, i) => i !== index) })
  }

  function updateHotspot(index: number, hsPatch: Partial<DiagramHotspot>): void {
    patch({
      hotspots: def.hotspots.map((hs, i) => (i === index ? { ...hs, ...hsPatch } : hs)),
    })
  }

  return (
    <>
      {/* Background image */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Background Image</div>
        <label style={LABEL}>Image URL</label>
        <input
          type="url"
          value={def.backgroundImageUrl}
          onChange={e => { patch({ backgroundImageUrl: e.target.value }); setImgLoadError(false) }}
          style={FIELD}
          placeholder="https://storage.example.com/assets/diagram.png"
        />
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>
          Paste a URL from the Asset Manager (Garage storage).
        </div>
        {def.backgroundImageUrl && !imgLoadError && (
          <img
            src={def.backgroundImageUrl}
            alt="Background preview"
            style={{ marginTop: 8, maxWidth: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid #45475a' }}
            onError={() => setImgLoadError(true)}
          />
        )}
        {imgLoadError && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#f38ba8' }}>
            Image failed to load — check the URL or asset permissions.
          </div>
        )}
      </div>

      {/* Hotspots */}
      <div style={SECTION}>
        <div style={{ ...SECTION_TITLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Hotspots ({def.hotspots.length})</span>
          <button onClick={addHotspot} style={BTN_SMALL}>+ Add</button>
        </div>

        {def.hotspots.length === 0 && (
          <div style={{ fontSize: 11, color: '#6c7086' }}>
            No hotspots yet. Add hotspots and enter coordinates manually,
            or use the sceneDef JSON editor for bulk import.
          </div>
        )}

        {def.hotspots.map((hs, i) => (
          <HotspotEditor
            key={hs.id}
            hotspot={hs}
            index={i}
            onChange={patch => updateHotspot(i, patch)}
            onDelete={() => deleteHotspot(i)}
          />
        ))}
      </div>
    </>
  )
}
