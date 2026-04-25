/**
 * RecorderLiveView — TD-014.11 / TD-014.34.
 *
 * Full-screen overlay (z-index 1100 — above SimulationEditor's 1000) shown
 * while `recorderStore.recording` is true. Poll-refreshes a live JPEG of the
 * headless browser and exposes three distinct exit paths (TD-014.34):
 *
 *   - Stop & import — primary success: stop → importSimulation → setConfig → reset
 *   - Stop         — secondary: stop → preserve in Garage → reset (re-importable
 *                    later from SessionsPickerDialog; count-aware toast)
 *   - Discard      — destructive: confirm → stop → deleteSession → reset
 *
 * Keyboard: C = capture; Esc = Discard (retains its own confirm via
 * handleDiscard — the existing "Esc throws away pending work" convention).
 *
 * See `decisions/2026-04-24-recorder-stop-semantics.md` for the full rationale
 * and the 4 implementation invariants codified below (stop-fail never resets;
 * DELETE 404 is silent success; Stop toast is count-aware; Discard is
 * leftmost, separated from the stop group).
 *
 * Import flow lives here (not in the store) because it crosses two stores
 * (recorderStore → simStore) and a REST call (courseApi.importSimulation).
 * Doing it inline keeps the store boundary clean.
 */

import { useEffect, useState } from 'react'
import { useRecorderStore } from '../../store/recorderStore'
import { useSimStore } from '../../store/simStore'
import { useEditorStore } from '../../store/editorStore'
import { useToast } from '../ui/Toast'
import { getLiveScreenshotUrl, deleteSession } from '../../api/recorderApi'
import { importSimulation } from '../../api/courseApi'
import {
  colors, fontSize, fontWeight, radius, gap, buttons, surfaces,
} from './simulationTheme'

const POLL_INTERVAL_MS = 500

export function RecorderLiveView() {
  const recording = useRecorderStore(s => s.recording)
  const activeSessionId = useRecorderStore(s => s.activeSessionId)
  const captures = useRecorderStore(s => s.captures)
  const isBusy = useRecorderStore(s => s.isBusy)
  const error = useRecorderStore(s => s.error)
  const capture = useRecorderStore(s => s.capture)
  const stop = useRecorderStore(s => s.stop)
  const reset = useRecorderStore(s => s.reset)

  const course = useEditorStore(s => s.course)
  const setConfig = useSimStore(s => s.setConfig)
  const toast = useToast()

  const [tick, setTick] = useState(0)

  // Poll the live JPEG URL via re-rendering the <img> with a cache-busting
  // query parameter. `Cache-Control: no-store` on the response is the real
  // guarantee; the query bump is belt-and-braces for intermediaries.
  useEffect(() => {
    if (!recording || !activeSessionId) return
    const id = setInterval(() => setTick(t => t + 1), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [recording, activeSessionId])

  // Keyboard: C = capture, Esc = Discard (the confirm lives inside
  // handleDiscard so keyboard + button share the destructive path).
  useEffect(() => {
    if (!recording) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        void capture()
      } else if (e.key === 'Escape') {
        void handleDiscard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, capture])

  if (!recording || !activeSessionId) return null

  async function handleCapture() {
    await capture()
  }

  async function handleStopAndImport() {
    const persisted = await stop()
    if (!persisted) return // error already in store.error
    if (!course) {
      toast.error('No active course — cannot import recording')
      return
    }
    try {
      const simConfig = await importSimulation(course.id, persisted.id)
      setConfig(simConfig)
      toast.success(`Simulation imported (${simConfig.steps.length} steps)`)
      reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Import failed: ${msg}`)
      // Keep the session state so the author can retry Import via SessionsPickerDialog.
    }
  }

  async function handleStopPreserve() {
    // TD-014.34 Implementation Note (a): stop() failure must NOT reset.
    // recorderStore.stop() deliberately keeps `recording: true` on failure so
    // the user can retry; calling reset() blindly would wipe activeSessionId
    // and orphan the backend session (zombie — frontend thinks it's done,
    // backend still thinks it's live, no path back to either Stop or Discard).
    const persisted = await stop()
    if (!persisted) {
      const msg = useRecorderStore.getState().error ?? 'unknown error'
      // TD-014.24 dec 12: unified error format `'X failed: ${msg}'`.
      toast.error(`Stop failed: ${msg}`)
      return
    }
    // TD-014.34 Implementation Note (c): count-aware copy. The zero-step case
    // ("author opened recorder, stopped without capturing") is truthfully
    // reported as "0 steps saved" — the user can decide whether to manually
    // delete from SessionsPicker. Not auto-discarding here on purpose: a Stop
    // button that silently destroys data is exactly the overloading Option C
    // was chosen to avoid.
    const count = persisted.steps.length
    toast.info(`Recording stopped — ${count} step${count === 1 ? '' : 's'} saved to Sessions`)
    reset()
  }

  async function handleDiscard() {
    if (!window.confirm('Discard this recording? This cannot be undone.')) return

    // Same stop-fail invariant as handleStopPreserve — see Implementation
    // Note (a). A failed stop leaves the backend in a retry-able state; reset
    // would create a zombie. The user stays in the overlay and can retry
    // Discard or fall back to Stop.
    const persisted = await stop()
    if (!persisted) {
      const msg = useRecorderStore.getState().error ?? 'unknown error'
      // TD-014.24 dec 12: unified error format `'X failed: ${msg}'`.
      toast.error(`Stop failed: ${msg}`)
      return
    }

    try {
      await deleteSession(persisted.id)
      toast.info('Recording discarded')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // TD-014.34 Implementation Note (b): DELETE 404 === functional success
      // (resource is already gone). Surface it as the happy-path toast so the
      // user doesn't see a misleading "cleanup failed: 404" warning.
      if (/404/.test(msg)) {
        toast.info('Recording discarded')
      } else {
        // Non-404 failure (500, network): the session survives in Garage but
        // the stop already succeeded — don't strand the user in the overlay.
        // Reset local state and point them at SessionsPicker for manual cleanup.
        toast.warning(`Recording stopped but cleanup failed: ${msg} — remove it from Sessions list.`)
      }
    }
    reset()
  }

  const liveUrl = `${getLiveScreenshotUrl(activeSessionId)}?t=${tick}`

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Recording in progress">
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          Recording — {captures.length} step{captures.length === 1 ? '' : 's'} captured
        </span>
        {/*
          TD-014.34 Implementation Note (d): visual hierarchy matters here.
          Discard is LEFTMOST, separated from the stop-group by a flex spacer.
          Western readers expect the rightmost button to be the "close /
          commit / final" action — putting Discard next to Stop turns it into
          a misclick target that the confirm only mitigates. Final left-to-
          right order: [Discard]  ·  [Capture] [Stop] [Stop & import].
        */}
        <div style={styles.headerActions}>
          <button
            type="button"
            data-testid="recorder-live-discard"
            style={{ ...buttons.danger, ...(isBusy ? buttons.disabled : null) }}
            onClick={handleDiscard}
            disabled={isBusy}
            title="Discard this recording (permanent)"
          >
            Discard
          </button>
          <div style={styles.actionSpacer} aria-hidden="true" />
          <button
            type="button"
            data-testid="recorder-live-capture"
            // TD-014.24 dec 4: green button is `buttons.success`, not `btnPrimary`
            // (which is BLUE everywhere else — naming collision resolved at theme).
            style={{ ...buttons.success, ...(isBusy ? buttons.disabled : null) }}
            onClick={handleCapture}
            disabled={isBusy}
            title="Capture step (C)"
          >
            Capture step
          </button>
          <button
            type="button"
            data-testid="recorder-live-preserve"
            style={{ ...buttons.secondary, ...(isBusy ? buttons.disabled : null) }}
            onClick={handleStopPreserve}
            disabled={isBusy}
            title="Stop recording; re-import later from Sessions list"
          >
            Stop
          </button>
          <button
            type="button"
            data-testid="recorder-live-stop"
            style={{ ...buttons.primary, ...(isBusy ? buttons.disabled : null) }}
            onClick={handleStopAndImport}
            disabled={isBusy}
          >
            Stop &amp; import
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" data-testid="recorder-live-error" style={styles.error}>{error}</div>
      )}

      <div style={styles.previewWrap}>
        <img
          src={liveUrl}
          alt="Live recording preview"
          data-testid="recorder-live-preview"
          style={styles.preview}
          onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
        />
      </div>
    </div>
  )
}

// TD-014.24: theme-derived styles. Button variants (primary/success/secondary/
// danger/disabled) now come from `simulationTheme.buttons` directly at the
// JSX call sites; local-keyed btnPrimary/btnSave/btnCancel/btnDanger/btnDisabled
// were removed. The migration of `btnDanger` to the shared theme delivers
// the commitment made in `decisions/2026-04-24-recorder-stop-semantics.md`
// § Implementation Note (a) Guardrails.
//
// Layout-specific values stay inline:
//   • header height 48 — overlay-header pattern shared with SimulationEditor
//   • headerActions flex:1 + marginLeft:24 — title-left / actions-right layout
//   • actionSpacer flex:1 + minWidth:32 — TD-014.34 (d) Discard separation
//   • previewWrap padding:16 — preview-area gutter
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    ...surfaces.overlayBase,
    zIndex: 1100,
    background: colors.bgDeepest,
    flexDirection: 'column',
  },
  header: {
    height: 48,
    background: colors.bgBase,
    borderBottom: `1px solid ${colors.bgElevated}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.medium,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: gap.default,
    // flex:1 so the actionSpacer below can consume remaining width and push
    // the stop-group away from Discard. Combined with the parent header's
    // `justifyContent: space-between`, this lets the title sit left and the
    // whole action row (Discard on its left edge, stop-group on its right
    // edge) occupy the remaining width.
    flex: 1,
    marginLeft: 24,
  },
  actionSpacer: {
    // TD-014.34 (d): negative space separating Discard from the stop-group.
    // flex:1 absorbs all unused width; minWidth guarantees visible separation
    // even on narrow headers. No background / no border — purely structural.
    flex: 1,
    minWidth: 32,
  },
  // Full-bleed banner variant (borderBottom across the overlay header).
  // Spreads errorBanner for consensus values; adds bottom border for
  // overlay-aligned visual treatment.
  error: {
    ...surfaces.errorBanner,
    borderBottom: `1px solid ${colors.accentRed}`,
  },
  previewWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    overflow: 'hidden',
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    background: colors.bgThumbnail,
    border: `1px solid ${colors.bgElevated}`,
    borderRadius: radius.default,
  },
}
