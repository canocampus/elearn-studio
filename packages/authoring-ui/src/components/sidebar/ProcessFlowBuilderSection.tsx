/**
 * ProcessFlowBuilderSection — T031.10, T031.11, T031.12
 *
 * Shown inside PhaserSimPropertiesPanel when simType === 'process-flow'.
 * Provides structured editors for:
 *   T031.10/11 — Nodes (id, x, y, label, type) and Edges (from, to, label)
 *   T031.12    — Steps (nodeId, instruction, correctAction per node)
 *
 * Writes directly to sceneDef via the onSceneDefChange callback.
 */

import { useState } from 'react'
import type {
  ProcessFlowSceneDef,
  ProcessFlowNode,
  ProcessFlowEdge,
  ProcessFlowStep,
} from '../../types/phaserSim'

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

const NODE_TYPES: Array<ProcessFlowNode['type']> = ['start', 'step', 'decision', 'end']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toProcessFlowDef(raw: Record<string, unknown> | null): ProcessFlowSceneDef {
  // Validate each array element is a non-null object before casting (H3)
  const rawNodes = Array.isArray(raw?.nodes)
    ? (raw.nodes as unknown[]).filter((n): n is ProcessFlowNode =>
        typeof n === 'object' && n !== null && !Array.isArray(n) &&
        typeof (n as ProcessFlowNode).id === 'string',
      )
    : []
  const rawEdges = Array.isArray(raw?.edges)
    ? (raw.edges as unknown[]).filter((e): e is Record<string, unknown> =>
        typeof e === 'object' && e !== null && !Array.isArray(e),
      )
    : []
  const rawSteps = Array.isArray(raw?.steps)
    ? (raw.steps as unknown[]).filter((s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && !Array.isArray(s),
      )
    : []
  return {
    simType: 'process-flow',
    nodes: rawNodes,
    // Backfill missing IDs from pre-existing data (H1)
    edges: rawEdges.map((e, i) => ({
      id: typeof e.id === 'string' && e.id ? e.id : `edge-${i}-${Date.now()}`,
      from: typeof e.from === 'string' ? e.from : '',
      to: typeof e.to === 'string' ? e.to : '',
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
    steps: rawSteps.map((s, i) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `step-${i}-${Date.now()}`,
      nodeId: typeof s.nodeId === 'string' ? s.nodeId : '',
      instruction: typeof s.instruction === 'string' ? s.instruction : '',
      correctAction: (s.correctAction === 'click' || s.correctAction === 'hover') ? s.correctAction : 'click',
    })),
    autoAdvanceDelayMs: typeof raw?.autoAdvanceDelayMs === 'number' ? raw.autoAdvanceDelayMs : 2000,
  }
}

let _nodeSeq = 0
function makeNode(existingCount: number): ProcessFlowNode {
  _nodeSeq++
  return {
    id: `node-${_nodeSeq}`,
    x: 100 + (existingCount % 5) * 160,
    y: 200 + Math.floor(existingCount / 5) * 100,
    label: `Step ${existingCount + 1}`,
    type: existingCount === 0 ? 'start' : 'step',
  }
}

function makeEdge(nodes: ProcessFlowNode[]): ProcessFlowEdge {
  const from = nodes[nodes.length - 2]?.id ?? ''
  const to = nodes[nodes.length - 1]?.id ?? ''
  return { id: `edge-${Date.now()}`, from, to, label: '' }
}

function makeStep(nodes: ProcessFlowNode[]): ProcessFlowStep {
  return {
    id: `step-${Date.now()}`,
    nodeId: nodes[0]?.id ?? '',
    instruction: '',
    correctAction: 'click',
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  sceneDef: Record<string, unknown> | null
  onSceneDefChange: (def: ProcessFlowSceneDef) => void
}

// ---------------------------------------------------------------------------
// NodeEditor sub-component — T031.11
// ---------------------------------------------------------------------------

interface NodeEditorProps {
  node: ProcessFlowNode
  index: number
  onChange: (patch: Partial<ProcessFlowNode>) => void
  onDelete: () => void
}

function NodeEditor({ node, index, onChange, onDelete }: NodeEditorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #45475a', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: '#1e1e2e', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: 11, color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {index + 1}. [{node.type}] {node.label || '(unlabelled)'} ({node.x},{node.y})
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#6c7086' }}>{expanded ? '▲' : '▼'}</span>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={BTN_DANGER}>✕</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: 8, background: '#181825' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LABEL}>Label</label>
              <input
                type="text"
                value={node.label}
                onChange={e => onChange({ label: e.target.value })}
                style={FIELD}
                placeholder="Node label"
              />
            </div>
            <div>
              <label style={LABEL}>Type</label>
              <select
                value={node.type}
                onChange={e => onChange({ type: e.target.value as ProcessFlowNode['type'] })}
                style={FIELD}
              >
                {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={LABEL}>ID</label>
              <input
                type="text"
                value={node.id}
                onChange={e => onChange({ id: e.target.value })}
                style={FIELD}
                placeholder="node-1"
              />
            </div>
            <div>
              <label style={LABEL}>X (px)</label>
              <input type="number" min={0} value={node.x} onChange={e => onChange({ x: Math.max(0, Number(e.target.value)) })} style={FIELD} />
            </div>
            <div>
              <label style={LABEL}>Y (px)</label>
              <input type="number" min={0} value={node.y} onChange={e => onChange({ y: Math.max(0, Number(e.target.value)) })} style={FIELD} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EdgeEditor sub-component — T031.11
// ---------------------------------------------------------------------------

interface EdgeEditorProps {
  edge: ProcessFlowEdge
  index: number
  nodeIds: string[]
  onChange: (patch: Partial<ProcessFlowEdge>) => void
  onDelete: () => void
}

function EdgeEditor({ edge, index, nodeIds, onChange, onDelete }: EdgeEditorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #45475a', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: '#1e1e2e', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: 11, color: '#cdd6f4', flex: 1 }}>
          {index + 1}. {edge.from || '?'} → {edge.to || '?'}{edge.label ? ` (${edge.label})` : ''}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#6c7086' }}>{expanded ? '▲' : '▼'}</span>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={BTN_DANGER}>✕</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: 8, background: '#181825' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LABEL}>From</label>
              <select value={edge.from} onChange={e => onChange({ from: e.target.value })} style={FIELD}>
                <option value="">— select —</option>
                {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>To</label>
              <select value={edge.to} onChange={e => onChange({ to: e.target.value })} style={FIELD}>
                <option value="">— select —</option>
                {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
          </div>
          <label style={LABEL}>Label (optional)</label>
          <input
            type="text"
            value={edge.label ?? ''}
            onChange={e => onChange({ label: e.target.value || undefined })}
            style={FIELD}
            placeholder="e.g. Yes / No"
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepEditor sub-component — T031.12
// ---------------------------------------------------------------------------

interface StepEditorProps {
  step: ProcessFlowStep
  index: number
  nodeIds: string[]
  onChange: (patch: Partial<ProcessFlowStep>) => void
  onDelete: () => void
}

function StepEditor({ step, index, nodeIds, onChange, onDelete }: StepEditorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #45475a', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: '#1e1e2e', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: 11, color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Step {index + 1}: {step.nodeId || '?'} — {step.instruction || '(no instruction)'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#6c7086' }}>{expanded ? '▲' : '▼'}</span>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={BTN_DANGER}>✕</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: 8, background: '#181825' }}>
          <label style={LABEL}>Target Node</label>
          <select
            value={step.nodeId}
            onChange={e => onChange({ nodeId: e.target.value })}
            style={{ ...FIELD, marginBottom: 8 }}
          >
            <option value="">— select —</option>
            {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>

          <label style={LABEL}>Instruction</label>
          <input
            type="text"
            value={step.instruction}
            onChange={e => onChange({ instruction: e.target.value })}
            style={{ ...FIELD, marginBottom: 8 }}
            placeholder="What should the learner do?"
          />

          <label style={LABEL}>Expected Action</label>
          <select
            value={step.correctAction}
            onChange={e => onChange({ correctAction: e.target.value as ProcessFlowStep['correctAction'] })}
            style={FIELD}
          >
            <option value="click">Click</option>
            <option value="hover">Hover</option>
          </select>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProcessFlowBuilderSection({ sceneDef, onSceneDefChange }: Props) {
  const def = toProcessFlowDef(sceneDef)
  const nodeIds = def.nodes.map(n => n.id)

  function patch(changes: Partial<ProcessFlowSceneDef>): void {
    onSceneDefChange({ ...def, ...changes })
  }

  // --- Nodes ----------------------------------------------------------------

  function addNode(): void {
    const node = makeNode(def.nodes.length)
    patch({ nodes: [...def.nodes, node] })
  }

  function deleteNode(index: number): void {
    const removedId = def.nodes[index]?.id
    const nodes = def.nodes.filter((_, i) => i !== index)
    // Remove edges and steps that reference the deleted node
    const edges = def.edges.filter(e => e.from !== removedId && e.to !== removedId)
    const steps = def.steps.filter(s => s.nodeId !== removedId)
    patch({ nodes, edges, steps })
  }

  function updateNode(index: number, nPatch: Partial<ProcessFlowNode>): void {
    const oldId = def.nodes[index]?.id
    // C1: reject empty ID — silently ignore the ID portion of the patch
    const sanitizedPatch: Partial<ProcessFlowNode> = { ...nPatch }
    if (typeof sanitizedPatch.id === 'string' && sanitizedPatch.id.trim() === '') {
      delete sanitizedPatch.id
    }
    const newId = sanitizedPatch.id ?? oldId
    const nodes = def.nodes.map((n, i) => (i === index ? { ...n, ...sanitizedPatch } : n))
    // Keep edges/steps in sync if id changed
    if (oldId !== newId) {
      const edges = def.edges.map(e => ({
        ...e,
        from: e.from === oldId ? (newId ?? e.from) : e.from,
        to: e.to === oldId ? (newId ?? e.to) : e.to,
      }))
      const steps = def.steps.map(s => ({
        ...s,
        nodeId: s.nodeId === oldId ? (newId ?? s.nodeId) : s.nodeId,
      }))
      patch({ nodes, edges, steps })
    } else {
      patch({ nodes })
    }
  }

  // --- Edges ----------------------------------------------------------------

  function addEdge(): void {
    patch({ edges: [...def.edges, makeEdge(def.nodes)] })
  }

  function deleteEdge(index: number): void {
    patch({ edges: def.edges.filter((_, i) => i !== index) })
  }

  function updateEdge(index: number, ePatch: Partial<ProcessFlowEdge>): void {
    patch({ edges: def.edges.map((e, i) => (i === index ? { ...e, ...ePatch } : e)) })
  }

  // --- Steps ----------------------------------------------------------------

  function addStep(): void {
    patch({ steps: [...def.steps, makeStep(def.nodes)] })
  }

  function deleteStep(index: number): void {
    patch({ steps: def.steps.filter((_, i) => i !== index) })
  }

  function updateStep(index: number, sPatch: Partial<ProcessFlowStep>): void {
    patch({ steps: def.steps.map((s, i) => (i === index ? { ...s, ...sPatch } : s)) })
  }

  return (
    <>
      {/* Demo delay */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Demo Settings</div>
        <label style={LABEL}>Auto-advance delay (ms)</label>
        <input
          type="number"
          min={500}
          step={100}
          value={def.autoAdvanceDelayMs ?? 2000}
          onChange={e => patch({ autoAdvanceDelayMs: Math.max(500, Number(e.target.value)) })}
          style={FIELD}
        />
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>Used in demo mode only.</div>
      </div>

      {/* Nodes — T031.10/11 */}
      <div style={SECTION}>
        <div style={{ ...SECTION_TITLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Nodes ({def.nodes.length})</span>
          <button onClick={addNode} style={BTN_SMALL}>+ Add</button>
        </div>
        {def.nodes.length === 0 && (
          <div style={{ fontSize: 11, color: '#6c7086' }}>No nodes yet. Add a start node first.</div>
        )}
        {def.nodes.map((node, i) => (
          <NodeEditor
            key={node.id}
            node={node}
            index={i}
            onChange={p => updateNode(i, p)}
            onDelete={() => deleteNode(i)}
          />
        ))}
      </div>

      {/* Edges — T031.11 */}
      <div style={SECTION}>
        <div style={{ ...SECTION_TITLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Edges ({def.edges.length})</span>
          <button onClick={addEdge} style={BTN_SMALL} disabled={def.nodes.length < 2}>+ Add</button>
        </div>
        {def.nodes.length < 2 && (
          <div style={{ fontSize: 11, color: '#6c7086' }}>Add at least 2 nodes first.</div>
        )}
        {def.edges.map((edge, i) => (
          <EdgeEditor
            key={edge.id}
            edge={edge}
            index={i}
            nodeIds={nodeIds}
            onChange={p => updateEdge(i, p)}
            onDelete={() => deleteEdge(i)}
          />
        ))}
      </div>

      {/* Steps — T031.12 */}
      <div style={SECTION}>
        <div style={{ ...SECTION_TITLE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Steps — Practice/Assessment ({def.steps.length})</span>
          <button onClick={addStep} style={BTN_SMALL} disabled={def.nodes.length === 0}>+ Add</button>
        </div>
        {def.nodes.length === 0 && (
          <div style={{ fontSize: 11, color: '#6c7086' }}>Add nodes before defining steps.</div>
        )}
        {def.steps.map((step, i) => (
          <StepEditor
            key={step.id}
            step={step}
            index={i}
            nodeIds={nodeIds}
            onChange={p => updateStep(i, p)}
            onDelete={() => deleteStep(i)}
          />
        ))}
        <div style={{ fontSize: 10, color: '#6c7086', marginTop: 4 }}>
          Steps define the expected interaction sequence in practice and assessment modes. Ignored in demo mode.
        </div>
      </div>
    </>
  )
}
