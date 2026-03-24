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

function getExtendedProps(component: Component): PhaserSimExtendedProps {
  const raw = component.get('extendedProperties') as Partial<PhaserSimExtendedProps> | undefined
  return { ...PHASER_SIM_DEFAULT_EXTENDED, ...raw }
}

function setExtendedProps(component: Component, patch: Partial<PhaserSimExtendedProps>): void {
  const current = getExtendedProps(component)
  component.set('extendedProperties', { ...current, ...patch })
}

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

export function PhaserSimPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)
  const openPreview = usePhaserSimStore(s => s.openPreview)

  // Local state for the JSON textarea (to allow in-progress typing without re-parsing every keystroke)
  const [sceneDefJson, setSceneDefJson] = useState('')
  const [jsonError, setJsonError] = useState(false)

  if (!editor || selectedComponentType !== 'phaser-sim') {
    return null
  }

  const selected = editor.getSelected()
  // Guard against Zustand store lag: verify the live component type, not just the store value.
  // Matches the pattern used in QuestionPropertiesPanel.
  if (!selected || (selected.get('type') as string) !== 'phaser-sim') {
    return null
  }

  const ep = getExtendedProps(selected)

  // Handlers re-fetch the selected component at call time to guard against the case where
  // the GrapesJS selection changes between the render that opened this panel and the user
  // clicking a control (e.g., rapid select/deselect while the panel is still mounted).
  function handleSimTypeChange(simType: PhaserSimExtendedProps['simType']): void {
    const component = editor.getSelected()
    if (!component) return
    setExtendedProps(component, { simType })
  }

  function handleModeChange(mode: PhaserSimMode): void {
    const component = editor.getSelected()
    if (!component) return
    setExtendedProps(component, { mode })
  }

  function handlePassingScoreChange(passingScore: number): void {
    const component = editor.getSelected()
    if (!component) return
    const clamped = Math.max(0, Math.min(100, passingScore))
    setExtendedProps(component, { passingScore: clamped })
  }

  function handleWidthChange(width: number): void {
    const component = editor.getSelected()
    if (!component) return
    setExtendedProps(component, { width: Math.max(100, width) })
  }

  function handleHeightChange(height: number): void {
    const component = editor.getSelected()
    if (!component) return
    setExtendedProps(component, { height: Math.max(100, height) })
  }

  function handleSceneDefBlur(): void {
    const parsed = parseSceneDef(sceneDefJson)
    if (sceneDefJson.trim() && !parsed) {
      setJsonError(true)
    } else {
      const component = editor.getSelected()
      if (!component) return
      setJsonError(false)
      setExtendedProps(component, { sceneDef: parsed })
    }
  }

  function handleTypedSceneDefChange(
    newDef: ProcessFlowSceneDef | InteractiveDiagramSceneDef | GamifiedQuizSceneDef,
  ): void {
    const component = editor.getSelected()
    if (!component) return
    setJsonError(false)
    setSceneDefJson(JSON.stringify(newDef, null, 2))
    setExtendedProps(component, { sceneDef: newDef as Record<string, unknown> })
  }

  function handlePreview(): void {
    const component = editor.getSelected()
    if (!component) return
    const componentId = component.getId()
    if (!componentId) {
      console.warn('[PhaserSimPropertiesPanel] Cannot open preview: component lacks ID')
      return
    }
    const current = getExtendedProps(component)
    openPreview(current, componentId)
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
        <label style={LABEL_STYLE}>Type</label>
        <select
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
        <label style={LABEL_STYLE}>Mode</label>
        <select
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
          key={selected.getId() ?? selected.get('cid') as string}
          initialValue={sceneDefToJson(ep.sceneDef)}
          jsonError={jsonError}
          onJsonChange={setSceneDefJson}
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
  initialValue: string
  jsonError: boolean
  onJsonChange: (v: string) => void
  onBlur: () => void
}

function PhaserSimSceneDefEditor({ initialValue, jsonError, onJsonChange, onBlur }: SceneDefEditorProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <textarea
      value={value}
      onChange={e => {
        setValue(e.target.value)
        onJsonChange(e.target.value)
      }}
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
