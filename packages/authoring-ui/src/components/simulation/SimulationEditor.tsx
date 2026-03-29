/**
 * SimulationEditor — full-screen overlay panel for editing Screenshot Simulations.
 *
 * Layout:
 *   [Step List 220px] | [Screenshot + Hotspot Canvas] | [Step Form 260px]
 *
 * T024.2, T024.4, T024.5, T024.6, T024.7–9, T024.10
 */

import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { HotspotCanvas } from './HotspotCanvas'
import { StepForm } from './StepForm'
import type { SimMode } from '../../types/simulation'

export function SimulationEditor() {
  const { config, panelOpen, selectedStepIndex, closePanel, selectStep,
          updateStep, reorderStep, deleteStep, updateMode, updatePassingScore } = useSimStore()
  const editor = useEditorStore(s => s.editor)

  if (!panelOpen || !config) return null

  const step = config.steps[selectedStepIndex]

  function handleSave() {
    // Persist updated config back to GrapesJS component extendedProperties
    const { editingComponentId } = useSimStore.getState()
    if (editor && editingComponentId) {
      const component = editor.getWrapper()?.find(`#${editingComponentId}`)[0]
      if (component) {
        component.set('extendedProperties', { ...component.get('extendedProperties'), simConfig: config })
        editor.store().catch(err => console.error('[SimulationEditor] store failed:', err))
      }
    }
    closePanel()
  }

  function handleModeChange(mode: SimMode) {
    updateMode(mode)
  }

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Simulation Editor — {config.steps.length} steps</span>

        <div style={styles.headerControls}>
          <label style={styles.headerLabel}>Mode:</label>
          <select
            style={styles.select}
            value={config.mode}
            onChange={e => handleModeChange(e.target.value as SimMode)}
          >
            <option value="demo">Demo</option>
            <option value="practice">Practice</option>
            <option value="assessment">Assessment</option>
          </select>

          <label style={styles.headerLabel}>Passing %:</label>
          <input
            style={{ ...styles.select, width: 60 }}
            type="number"
            min={0}
            max={100}
            value={config.passingScore}
            onChange={e => updatePassingScore(parseInt(e.target.value, 10) || 0)}
          />
        </div>

        <div style={styles.headerActions}>
          <button style={styles.btnSave} onClick={handleSave}>Save &amp; Close</button>
          <button style={styles.btnCancel} onClick={closePanel}>Cancel</button>
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* ── Step list ── */}
        <div style={styles.stepList}>
          <div style={styles.stepListHeader}>Steps</div>
          {config.steps.map((s, i) => (
            <div
              key={s.id}
              style={{
                ...styles.stepItem,
                ...(i === selectedStepIndex ? styles.stepItemActive : {}),
              }}
              onClick={() => selectStep(i)}
            >
              {/* Thumbnail */}
              <div style={styles.thumbnail}>
                <img
                  src={s.screenshotUrl}
                  alt=""
                  style={styles.thumbnailImg}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span style={styles.thumbOrder}>{i + 1}</span>
              </div>

              <div style={styles.stepDesc}>{s.description}</div>

              {/* Reorder/delete controls */}
              <div style={styles.stepControls}>
                {i > 0 && (
                  <button
                    style={styles.iconBtn}
                    title="Move up"
                    onClick={e => { e.stopPropagation(); reorderStep(i, i - 1) }}
                  >↑</button>
                )}
                {i < config.steps.length - 1 && (
                  <button
                    style={styles.iconBtn}
                    title="Move down"
                    onClick={e => { e.stopPropagation(); reorderStep(i, i + 1) }}
                  >↓</button>
                )}
                <button
                  style={{ ...styles.iconBtn, color: '#f38ba8' }}
                  title="Delete step"
                  onClick={e => { e.stopPropagation(); deleteStep(i) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Canvas ── */}
        <div style={styles.canvasArea}>
          {step ? (
            <>
              <div style={styles.instruction}>
                {step.instruction || <em style={{ color: '#6c7086' }}>No instruction set</em>}
              </div>
              <HotspotCanvas
                step={step}
                onChange={hotspot => updateStep(selectedStepIndex, { hotspot })}
              />
              <div style={styles.canvasHint}>Drag the blue box to set the target hotspot</div>
            </>
          ) : (
            <div style={{ color: '#6c7086', fontSize: 14 }}>No steps yet</div>
          )}
        </div>

        {/* ── Step form ── */}
        <div style={styles.stepFormPanel}>
          {step ? (
            <StepForm
              step={step}
              onChange={patch => updateStep(selectedStepIndex, patch)}
            />
          ) : (
            <div style={{ color: '#6c7086', fontSize: 13 }}>Select a step to edit</div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: '#181825',
    display: 'flex',
    flexDirection: 'column',
    color: '#cdd6f4',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    height: 48,
    background: '#1e1e2e',
    borderBottom: '1px solid #313244',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 12,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#cdd6f4',
    flex: 1,
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 12,
    color: '#a6adc8',
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  select: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 12,
    padding: '4px 8px',
    outline: 'none',
  },
  btnSave: {
    padding: '6px 14px',
    background: '#89b4fa',
    color: '#1e1e2e',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '6px 14px',
    background: 'transparent',
    color: '#a6adc8',
    border: '1px solid #45475a',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  stepList: {
    width: 220,
    borderRight: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
  },
  stepListHeader: {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: '#a6adc8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #313244',
    flexShrink: 0,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #1e1e2e',
    transition: 'background 0.1s',
  },
  stepItemActive: {
    background: '#2a2a3e',
  },
  thumbnail: {
    width: 48,
    height: 32,
    background: '#11111b',
    borderRadius: 3,
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbOrder: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    fontSize: 9,
    color: '#89b4fa',
    fontWeight: 700,
  },
  stepDesc: {
    fontSize: 11,
    color: '#cdd6f4',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stepControls: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 4px',
    borderRadius: 3,
    lineHeight: 1,
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    overflow: 'auto',
  },
  instruction: {
    fontSize: 14,
    color: '#cdd6f4',
    maxWidth: 640,
    textAlign: 'center',
    minHeight: 20,
  },
  canvasHint: {
    fontSize: 11,
    color: '#6c7086',
  },
  stepFormPanel: {
    width: 260,
    borderLeft: '1px solid #313244',
    padding: '12px 14px',
    overflowY: 'auto',
    flexShrink: 0,
  },
}
