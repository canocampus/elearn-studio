/**
 * SessionsPickerDialog — TD-014.12.
 *
 * Modal listing persisted recorder sessions from `GET /recorder/sessions`.
 * Per-row Import button → `courseApi.importSimulation(courseId, sessionId)` →
 * on success, `simStore.setConfig(result)` (NOT `openPanel` — that would
 * reset `selectedStepIndex` and is semantically the "double-click a widget"
 * entry point; see audit R-02 in docs/issues/issues-TD-014.md).
 */

import { useCallback, useEffect, useState } from 'react'
import { listSessions } from '../../api/recorderApi'
import { importSimulation } from '../../api/courseApi'
import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { useToast } from '../ui/Toast'
import {
  colors, fontSize, fontWeight, gap, buttons, surfaces, withDisabled,
} from './simulationTheme'
import type { SessionSummary } from '../../types/recorder'

interface SessionsPickerDialogProps {
  open: boolean
  onClose: () => void
}

export function SessionsPickerDialog({ open, onClose }: SessionsPickerDialogProps) {
  const course = useEditorStore(s => s.course)
  const setConfig = useSimStore(s => s.setConfig)
  const toast = useToast()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { sessions } = await listSessions()
      setSessions(sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  async function handleImport(id: string) {
    if (!course) {
      toast.error('No active course — cannot import recording')
      return
    }
    setImportingId(id)
    try {
      const simConfig = await importSimulation(course._id, id)
      setConfig(simConfig)
      toast.success(`Simulation imported (${simConfig.steps.length} steps)`)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Import failed: ${msg}`)
    } finally {
      setImportingId(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div
      style={styles.overlay}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div role="dialog" aria-modal="true" aria-label="Import recorded simulation" style={styles.dialog}>
        <div style={styles.header}>
          <h2 style={styles.heading}>Import recorded simulation</h2>
          <div style={styles.headerActions}>
            <button
              type="button"
              data-testid="sessions-picker-refresh"
              // TD-014.24 dec 11 + `decisions/2026-04-25-button-label-change-convention.md`:
              // app-chrome buttons do NOT take label-change. Disabled-only is the
              // complete state signal.
              style={withDisabled(styles.btnSecondary, loading)}
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              data-testid="sessions-picker-close"
              style={styles.btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" data-testid="sessions-picker-error" style={styles.error}>{error}</div>
        )}

        <div style={styles.body}>
          {!loading && sessions.length === 0 && !error && (
            <div data-testid="sessions-picker-empty" style={styles.empty}>
              No recordings yet. Use <strong>Record…</strong> to start one.
            </div>
          )}

          {sessions.map(s => (
            <div key={s.id} data-testid={`sessions-picker-row-${s.id}`} style={styles.row}>
              <div style={styles.rowInfo}>
                <div style={styles.rowTitle}>{s.title || '(untitled)'}</div>
                <div style={styles.rowMeta}>
                  <span>{s.url}</span>
                  <span>·</span>
                  <span>{s.stepCount} step{s.stepCount === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{formatDate(s.startedAt)}</span>
                  <span>·</span>
                  <span style={statusStyle(s.status)}>{s.status}</span>
                </div>
              </div>
              <button
                type="button"
                data-testid={`sessions-picker-import-${s.id}`}
                // TD-014.24 dec 11 + `decisions/2026-04-25-button-label-change-convention.md`:
                // app-chrome → no label-change; disabled-only is the state signal.
                style={withDisabled(styles.btnImport, importingId === s.id)}
                onClick={() => handleImport(s.id)}
                disabled={importingId === s.id}
              >
                Import
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString()
  } catch {
    return iso
  }
}

// TD-014.24: theme-derived styles. Layout-specific values stay inline:
//   • dialog width 640 / maxWidth 92vw / maxHeight 80vh — modal dimensions
//   • header padding '14px 18px', row padding '12px 18px', empty '24px 18px'
//     — surface-specific tuning (different from any other dialog padding)
//   • headerActions gap: 6 (between gap.tight=2 and gap.default=8 — outlier)
//   • row borderBottom uses bgDeepest (#181825) as a subtle row divider —
//     intentional: matches the bgDeepest backdrop colour to "fade out"
//     between rows rather than imposing a strong border
// See `decisions/2026-04-25-simulation-style-consistency.md` sub-decision
// 5 (heading 15 → 16) and 8 (button padding 6/7 unified to 6 via theme).
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    ...surfaces.overlayBase,
    zIndex: 1100,
    background: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    ...surfaces.dialog,
    width: 640,
    maxWidth: '92vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: `1px solid ${colors.bgElevated}`,
  },
  heading: {
    margin: 0,
    fontSize: fontSize.heading, // dec 5: 15 → 16
    fontWeight: fontWeight.medium,
  },
  headerActions: {
    display: 'flex',
    gap: 6, // outlier — see file-top comment
  },
  body: {
    overflowY: 'auto',
    flex: 1,
  },
  // Full-bleed banner variant (borderBottom across the dialog width).
  // Spreads errorBanner for consensus values (padding 8x16, bg, color,
  // fontSize); adds the bottom border for full-bleed treatment.
  error: {
    ...surfaces.errorBanner,
    borderBottom: `1px solid ${colors.accentRed}`,
  },
  empty: {
    padding: '24px 18px',
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: gap.medium,
    padding: '12px 18px',
    borderBottom: `1px solid ${colors.bgDeepest}`,
  },
  rowInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: gap.tight,
    overflow: 'hidden',
  },
  rowTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    gap: 6,
    fontSize: fontSize.small,
    color: colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Smaller variant of secondary button (panel-density: 11px / '5px 10px'
  // padding). Spreads buttons.secondary for the visual base + overrides
  // the two density-specific properties.
  btnSecondary: {
    ...buttons.secondary,
    padding: '5px 10px',
    fontSize: fontSize.small,
  },
  btnImport: {
    ...buttons.primary,
  },
}

/**
 * Status-token colour mapping (kept as a local helper rather than a styles
 * key because it's a function, not a static CSSProperties value).
 *   finished → accentGreen
 *   error    → accentRed
 *   other    → accentYellow (in-flight / unknown state)
 */
function statusStyle(s: string): React.CSSProperties {
  return {
    color:
      s === 'finished' ? colors.accentGreen :
      s === 'error'    ? colors.accentRed :
                         colors.accentYellow,
  }
}
