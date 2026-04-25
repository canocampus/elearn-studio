/**
 * SimulationEditor — full-screen overlay panel for editing Screenshot Simulations.
 *
 * Layout:
 *   [Step List 220px] | [Screenshot + Hotspot Canvas] | [Step Form 260px]
 *
 * T024.2, T024.4, T024.5, T024.6, T024.7–9, T024.10
 */

import { useState } from 'react'
import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { useRecorderStore } from '../../store/recorderStore'
import { useToast } from '../ui/Toast'
import { HotspotCanvas } from './HotspotCanvas'
import { isDrawModeHotspot } from './hotspotDraw'
import { StepForm } from './StepForm'
import { RecorderLauncherDialog } from './RecorderLauncherDialog'
import { RecorderLiveView } from './RecorderLiveView'
import { SessionsPickerDialog } from './SessionsPickerDialog'
import {
  colors, fontSize, fontWeight, radius, gap, text, buttons, surfaces,
} from './simulationTheme'
import type { SimMode } from '../../types/simulation'

export function SimulationEditor() {
  const { config, panelOpen, selectedStepIndex, closePanel, selectStep,
          updateStep, reorderStep, deleteStep, updateMode, updatePassingScore } = useSimStore()
  const editor = useEditorStore(s => s.editor)
  // TD-014.3: disable async-unsafe controls while the editor is saving.
  // TD-014.9 will extend this to also check recorderStore.isBusy.
  const isSaving = useEditorStore(s => s.isSaving)
  // TD-014.32 (F11): surface handleSave errors via Toast so the user is not
  // stranded with a silently-failed save; `SaveErrorBanner` is also present
  // but the overlay covers the canvas, so the toast (z-index 9999) is the
  // reliable UI channel while this panel is open.
  const toast = useToast()

  // TD-014.7b — drag-drop reorder state (pattern mirrored from SlideList.tsx).
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // TD-014.13 — Record… / Import… modals + live recorder view.
  const [recorderLauncherOpen, setRecorderLauncherOpen] = useState(false)
  const [sessionsPickerOpen, setSessionsPickerOpen] = useState(false)
  const recorderRecording = useRecorderStore(s => s.recording)

  if (!panelOpen || !config) return null

  const step = config.steps[selectedStepIndex]

  async function handleSave() {
    // TD-014.32 (F11): `closePanel()` now runs ONLY on success. Prior to this
    // fix all three error paths (no editor / component disappeared / requestSave
    // reject) still closed the overlay, so a failed save looked identical to a
    // successful one from the user's POV. Errors surface via Toast; the overlay
    // stays open so the user can retry or copy-paste content out before Cancel.
    if (!editor) {
      // Defensive no-op: editor not mounted yet. Panel being open without an
      // editor is an invariant violation elsewhere — don't compound it by
      // calling closePanel with uncommitted state.
      return
    }

    const { editingComponentId } = useSimStore.getState()
    if (!editingComponentId) {
      // Same invariant: openPanel always sets this. If it's null here, the
      // simStore is in an inconsistent state — bail without side effects.
      return
    }

    const component = editor.getWrapper()?.find(`#${editingComponentId}`)[0]
    if (!component) {
      toast.error('Cannot save: widget no longer exists on canvas')
      return
    }

    component.set('extendedProperties', { ...component.get('extendedProperties'), simConfig: config })

    // T651.3: unified save — isSaving / saveError handled centrally via requestSave.
    const requestSave = useEditorStore.getState().requestSave
    try {
      // `requestSave` can be undefined during the brief window before
      // EditorCanvas Effect 1 wires it up; `await undefined` resolves to
      // undefined, matching the prior fire-and-forget semantics.
      await requestSave?.()
      closePanel()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      toast.error(`Save failed: ${msg}`)
    }
  }

  function handleModeChange(mode: SimMode) {
    updateMode(mode)
  }

  function handleAddStep() {
    useSimStore.getState().addStep()
  }

  // ── TD-014.7b — drag-drop reorder + Alt+↑/↓ keyboard fallback ────────────
  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (index !== dragIndex) setDropIndex(index)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    // After removing dragIndex, indices above it shift down by 1 — matches
    // the "insert before dropIndex" drag semantics already used by SlideList.
    const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex
    const from = dragIndex
    setDragIndex(null)
    setDropIndex(null)
    reorderStep(from, adjustedDropIndex)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleStepKeyDown(e: React.KeyboardEvent, index: number) {
    if (!e.altKey) return
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      reorderStep(index, index - 1)
    } else if (e.key === 'ArrowDown' && index < config.steps.length - 1) {
      e.preventDefault()
      reorderStep(index, index + 1)
    }
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
          {/* TD-014.13 — Record… / Import… entry points; disabled during an active recording. */}
          <button
            data-testid="sim-record-btn"
            style={{ ...styles.btnCancel, ...(recorderRecording ? buttons.disabled : null) }}
            onClick={() => setRecorderLauncherOpen(true)}
            disabled={recorderRecording}
          >
            Record…
          </button>
          <button
            data-testid="sim-import-btn"
            style={{ ...styles.btnCancel, ...(recorderRecording ? buttons.disabled : null) }}
            onClick={() => setSessionsPickerOpen(true)}
            disabled={recorderRecording}
          >
            Import…
          </button>
          <button style={styles.btnSave} onClick={handleSave}>Save &amp; Close</button>
          <button style={styles.btnCancel} onClick={closePanel}>Cancel</button>
        </div>
      </div>

      {/* TD-014.13 — Recorder UI (launcher + live view + sessions picker). */}
      <RecorderLauncherDialog
        open={recorderLauncherOpen}
        onClose={() => setRecorderLauncherOpen(false)}
      />
      <RecorderLiveView />
      <SessionsPickerDialog
        open={sessionsPickerOpen}
        onClose={() => setSessionsPickerOpen(false)}
      />

      {/* Body */}
      <div style={styles.body}>
        {/* ── Step list ── */}
        <div style={styles.stepList}>
          <div style={styles.stepListHeader}>Steps</div>

          {/* Scrollable items region — flex:1 so the footer stays pinned. */}
          <div style={styles.stepListScrollable} aria-label="Simulation steps">
            {config.steps.map((s, i) => (
              <div
                key={s.id}
                data-testid={`sim-step-item-${i}`}
                tabIndex={0}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onKeyDown={e => handleStepKeyDown(e, i)}
                style={{
                  ...styles.stepItem,
                  ...(i === selectedStepIndex ? styles.stepItemActive : {}),
                  ...(dropIndex === i && dragIndex !== null && dragIndex !== i
                    ? styles.stepItemDropTarget
                    : {}),
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

                {/* TD-014.30 (F5): data-field hook for E2E content-assertion. */}
                <div data-field="description" style={styles.stepDesc}>{s.description}</div>

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
                    style={{ ...styles.iconBtn, color: colors.accentRed }}
                    title="Delete step"
                    onClick={e => { e.stopPropagation(); deleteStep(i) }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* TD-014.3: sticky footer — always visible regardless of list length. */}
          <div style={styles.stepListFooter}>
            <button
              data-testid="sim-add-step-btn"
              style={{ ...styles.btnAddStep, ...(isSaving ? buttons.disabled : null) }}
              onClick={handleAddStep}
              disabled={isSaving}
            >
              + Add step
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={styles.canvasArea}>
          {step ? (
            <>
              <div style={styles.instruction}>
                {step.instruction || <em style={{ color: colors.textMuted }}>No instruction set</em>}
              </div>
              <HotspotCanvas
                step={step}
                onChange={hotspot => updateStep(selectedStepIndex, { hotspot })}
              />
              <div style={styles.canvasHint}>
                {isDrawModeHotspot(step.hotspot)
                  ? 'Drag on the screenshot to draw a hotspot'
                  : 'Drag the blue box to set the target hotspot'}
              </div>
            </>
          ) : (
            <div style={{ color: colors.textMuted, fontSize: 14 }}>No steps yet</div>
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
            <div style={{ color: colors.textMuted, fontSize: 13 }}>Select a step to edit</div>
          )}
        </div>
      </div>
    </div>
  )
}

// TD-014.24: theme-derived styles. Layout-specific values stay inline:
//   • overlay zIndex 1000 — base overlay; modals (RecorderLauncher /
//     SessionsPicker / RecorderLive) use 1100 to render above it.
//   • header height 48 — overlay-header pattern shared with RecorderLiveView
//   • stepList width 220 / stepFormPanel width 260 — three-pane layout
//   • thumbnail 48x32 — fixed thumbnail dimensions
//   • thumbOrder fontSize 9, fontWeight 700 — outliers (1 use each, badge)
//   • iconBtn padding '2px 4px', radius small (3), color textMuted — tiny
//     glyph button with its own density rules; not a primary/secondary variant
//   • btnAddStep — 100%-width "footer" variant (different shape from buttons.primary;
//     uses bgElevated fill with borderSubtle border, 12px font medium weight)
//   • canvasArea padding 24 — workspace gutter
// See `decisions/2026-04-25-simulation-style-consistency.md` sub-decisions
// 7 (typography hybrid: text.label composite for 5-prop label) and 10
// (pragmatic spacing: gap.default for 8-px gaps, gap.medium for 12-px).
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    ...surfaces.overlayBase,
    zIndex: 1000,
    background: colors.bgDeepest,
    flexDirection: 'column',
  },
  header: {
    height: 48,
    background: colors.bgBase,
    borderBottom: `1px solid ${colors.bgElevated}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: gap.medium,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: gap.default,
  },
  headerLabel: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  headerActions: {
    display: 'flex',
    gap: gap.default,
  },
  select: {
    background: colors.bgElevated,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.default,
    color: colors.textPrimary,
    fontSize: fontSize.caption,
    padding: '4px 8px',
    outline: 'none',
  },
  btnSave: {
    ...buttons.primary,
  },
  btnCancel: {
    ...buttons.secondary,
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  stepList: {
    width: 220,
    borderRight: `1px solid ${colors.bgElevated}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  stepListScrollable: {
    flex: 1,
    overflowY: 'auto',
  },
  stepListFooter: {
    padding: '8px 10px',
    borderTop: `1px solid ${colors.bgElevated}`,
    background: colors.bgBase,
    flexShrink: 0,
  },
  // Footer-style "Add step" button — full width, bgElevated fill (different
  // from buttons.primary blue or secondary transparent). Doesn't merit a
  // theme entry: only used here.
  btnAddStep: {
    width: '100%',
    padding: '6px 10px',
    background: colors.bgElevated,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.default,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
  },
  stepListHeader: {
    ...text.label,
    padding: '8px 12px',
    borderBottom: `1px solid ${colors.bgElevated}`,
    flexShrink: 0,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: gap.default,
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: `1px solid ${colors.bgBase}`,
    transition: 'background 0.1s',
  },
  stepItemActive: {
    background: colors.bgSelection,
  },
  stepItemDropTarget: {
    borderTop: `2px solid ${colors.accentBlue}`,
  },
  thumbnail: {
    width: 48,
    height: 32,
    background: colors.bgThumbnail,
    borderRadius: radius.small,
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
    color: colors.accentBlue,
    fontWeight: fontWeight.bold,
  },
  stepDesc: {
    fontSize: fontSize.small,
    color: colors.textPrimary,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stepControls: {
    display: 'flex',
    gap: gap.tight,
    flexShrink: 0,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.small,
    padding: '2px 4px',
    borderRadius: radius.small,
    lineHeight: 1,
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: gap.medium,
    padding: 24,
    overflow: 'auto',
  },
  instruction: {
    fontSize: fontSize.title,
    color: colors.textPrimary,
    maxWidth: 640,
    textAlign: 'center',
    minHeight: 20,
  },
  canvasHint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  stepFormPanel: {
    width: 260,
    borderLeft: `1px solid ${colors.bgElevated}`,
    padding: '12px 14px',
    overflowY: 'auto',
    flexShrink: 0,
  },
}
