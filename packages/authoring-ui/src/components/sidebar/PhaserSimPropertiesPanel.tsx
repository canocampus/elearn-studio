/**
 * Phaser Simulation Properties Panel — right sidebar panel rendered outside the GrapesJS canvas.
 *
 * T034 — Opens when a phaser-sim widget is selected; auto-shown by EditorCanvas component:selected hook.
 * T031.10-12 — ProcessFlowBuilderSection (nodes/edges/steps)
 * T032.6     — DiagramBuilderSection (background image + hotspots)
 * T033.9     — GamifiedQuizRulesSection (timer, lives, combo, questions)
 *
 * Fields:
 *   - Sim Type (process-flow | interactive-diagram | gamified-quiz | physics-demo | concept-animator)
 *   - Mode (demo | practice | assessment)
 *   - Passing Score (0–100)
 *   - Canvas dimensions (width × height)
 *   - Sim-type-specific structured editor (T031/T032/T033)
 *   - Scene Definition (raw JSON textarea — always available as fallback)
 *   - Preview button → opens PhaserSimPreviewModal
 *
 * Writes directly to GrapesJS component via model.set('extendedProperties', {...}).
 */

import { useState, useEffect } from 'react'
import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { usePhaserSimStore } from '../../store/phaserSimStore'
import { useComponentProperty } from '../../hooks/useComponentProperty'
import {
  PHASER_SIM_DEFAULT_EXTENDED,
  PHASER_SIM_TYPES,
} from '../../types/phaserSim'
import type {
  PhaserSimExtendedProps,
  PhaserSimMode,
  ProcessFlowSceneDef,
  InteractiveDiagramSceneDef,
  GamifiedQuizSceneDef,
} from '../../types/phaserSim'
import { ProcessFlowBuilderSection } from './ProcessFlowBuilderSection'
import { DiagramBuilderSection } from './DiagramBuilderSection'
import { GamifiedQuizRulesSection } from './GamifiedQuizRulesSection'

// ---------------------------------------------------------------------------
// Shared styles (mirrors QuestionPropertiesPanel style)
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
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sceneDefToJson(sceneDef: Record<string, unknown> | null): string {
  if (!sceneDef) return ''
  try {
    return JSON.stringify(sceneDef, null, 2)
  } catch {
    return ''
  }
}

function parseSceneDef(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Outer shell — null-checks only, no hooks that depend on editor state
// ---------------------------------------------------------------------------

export function PhaserSimPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)
  const openPreview = usePhaserSimStore(s => s.openPreview)

  if (!editor || selectedComponentType !== 'phaser-sim') return null

  const selected = editor.getSelected()
  // Guard against Zustand store lag: verify the live component type, not just the store value.
  if (!selected || (selected.get('type') as string) !== 'phaser-sim') return null

  return (
    <PhaserSimPropertiesPanelInner
      selected={selected}
      openPreview={openPreview}
    />
  )
}

// ---------------------------------------------------------------------------
// Inner component — subscribes to extendedProperties via useComponentProperty
// so that undo/redo and any external Backbone mutation re-render the panel.
// ---------------------------------------------------------------------------

interface InnerProps {
  selected: Component
  openPreview: (props: PhaserSimExtendedProps, id: string) => void
}

function PhaserSimPropertiesPanelInner({ selected, openPreview }: InnerProps) {
  const [ep, updateEp, getLatest] = useComponentProperty<PhaserSimExtendedProps>(
    selected,
    'extendedProperties',
    PHASER_SIM_DEFAULT_EXTENDED,
  )

  const [sceneDefJson, setSceneDefJson] = useState(() => sceneDefToJson(ep.sceneDef))
  const [jsonError, setJsonError] = useState(false)

  // Sync textarea parse-buffer whenever ep.sceneDef changes externally (undo/redo, remote mutation).
  // Safe during typing: ep.sceneDef only changes after blur commits the value via update().
  useEffect(() => {
    setSceneDefJson(sceneDefToJson(ep.sceneDef))
    setJsonError(false)
  }, [ep.sceneDef])

  function update(patch: Partial<PhaserSimExtendedProps>) {
    const current = getLatest()
    updateEp({ ...current, ...patch })
  }

  function handleSimTypeChange(simType: PhaserSimExtendedProps['simType']): void {
    update({ simType })
  }

  function handleModeChange(mode: PhaserSimMode): void {
    update({ mode })
  }

  function handlePassingScoreChange(passingScore: number): void {
    const clamped = Math.max(0, Math.min(100, passingScore))
    update({ passingScore: clamped })
  }

  function handleWidthChange(width: number): void {
    update({ width: Math.max(100, width) })
  }

  function handleHeightChange(height: number): void {
    update({ height: Math.max(100, height) })
  }

  function handleSceneDefBlur(): void {
    const parsed = parseSceneDef(sceneDefJson)
    if (sceneDefJson.trim() && !parsed) {
      setJsonError(true)
    } else {
      setJsonError(false)
      update({ sceneDef: parsed })
    }
  }

  function handleTypedSceneDefChange(
    newDef: ProcessFlowSceneDef | InteractiveDiagramSceneDef | GamifiedQuizSceneDef,
  ): void {
    setJsonError(false)
    setSceneDefJson(JSON.stringify(newDef, null, 2))
    update({ sceneDef: newDef as unknown as Record<string, unknown> })
  }

  function handlePreview(): void {
    const componentId = selected.getId()
    if (!componentId) return
    openPreview(getLatest(), componentId)
  }

  return (
    <div
      data-testid="phaser-sim-properties-panel"
      style={{ overflowY: 'auto', flex: 1 }}
    >
      {/* Header */}
      <div style={{ ...SECTION_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>Phaser Simulation</div>
        <button
          onClick={handlePreview}
          style={{
            background: '#313244',
            border: '1px solid #45475a',
            borderRadius: 4,
            color: '#a6e3a1',
            fontSize: 11,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          ▶ Preview
        </button>
      </div>

      {/* Sim Type */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Simulation Type</div>
        <label htmlFor="phaser-sim-type" style={LABEL_STYLE}>Type</label>
        <select
          id="phaser-sim-type"
          value={ep.simType}
          onChange={e => handleSimTypeChange(e.target.value as PhaserSimExtendedProps['simType'])}
          style={FIELD_STYLE}
        >
          {PHASER_SIM_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Mode & Scoring */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Mode & Scoring</div>
        <label htmlFor="phaser-sim-mode" style={LABEL_STYLE}>Mode</label>
        <select
          id="phaser-sim-mode"
          value={ep.mode}
          onChange={e => handleModeChange(e.target.value as PhaserSimMode)}
          style={{ ...FIELD_STYLE, marginBottom: 8 }}
        >
          <option value="demo">Demo</option>
          <option value="practice">Practice</option>
          <option value="assessment">Assessment</option>
        </select>
        <label style={LABEL_STYLE}>Passing Score (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={ep.passingScore}
          onChange={e => handlePassingScoreChange(Number(e.target.value))}
          style={FIELD_STYLE}
        />
      </div>

      {/* Canvas Size */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Canvas Size</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Width (px)</label>
            <input
              type="number"
              min={100}
              value={ep.width ?? 800}
              onChange={e => handleWidthChange(Number(e.target.value))}
              style={FIELD_STYLE}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Height (px)</label>
            <input
              type="number"
              min={100}
              value={ep.height ?? 500}
              onChange={e => handleHeightChange(Number(e.target.value))}
              style={FIELD_STYLE}
            />
          </div>
        </div>
      </div>

      {/* Structured sim-type editors — T031.10-12, T032.6, T033.9 */}
      {ep.simType === 'process-flow' && (
        <ProcessFlowBuilderSection
          sceneDef={ep.sceneDef}
          onSceneDefChange={handleTypedSceneDefChange}
        />
      )}
      {ep.simType === 'interactive-diagram' && (
        <DiagramBuilderSection
          sceneDef={ep.sceneDef}
          onSceneDefChange={handleTypedSceneDefChange}
        />
      )}
      {ep.simType === 'gamified-quiz' && (
        <GamifiedQuizRulesSection
          sceneDef={ep.sceneDef}
          onSceneDefChange={handleTypedSceneDefChange}
        />
      )}

      {/* Scene Definition (raw JSON fallback — always available) */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Scene Definition (JSON)</div>
        <PhaserSimSceneDefEditor
          key={selected.getId() ?? String(selected.get('cid') ?? '')}
          value={sceneDefJson}
          jsonError={jsonError}
          onChange={setSceneDefJson}
          onBlur={handleSceneDefBlur}
        />
        {jsonError && (
          <div style={{ color: '#f38ba8', fontSize: 10, marginTop: 4 }}>
            Invalid JSON — changes not saved
          </div>
        )}
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>
          Leave empty to configure programmatically.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Controlled JSON textarea (sub-component so key-reset works on selection change)
// ---------------------------------------------------------------------------

interface SceneDefEditorProps {
  value: string
  jsonError: boolean
  onChange: (v: string) => void
  onBlur: () => void
}

function PhaserSimSceneDefEditor({ value, jsonError, onChange, onBlur }: SceneDefEditorProps) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      rows={8}
      spellCheck={false}
      placeholder={'{\n  "simType": "process-flow",\n  "nodes": [...]\n}'}
      style={{
        ...FIELD_STYLE,
        resize: 'vertical',
        fontFamily: 'monospace',
        lineHeight: 1.4,
        border: jsonError ? '1px solid #f38ba8' : '1px solid #45475a',
      }}
    />
  )
}
