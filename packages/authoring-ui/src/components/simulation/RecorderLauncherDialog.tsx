/**
 * RecorderLauncherDialog — TD-014.10.
 *
 * Modal shown when the author clicks "Record…" in the SimulationEditor header
 * (TD-014.13). Collects a URL + optional title, validates client-side against
 * the same SSRF rules the recorder backend enforces, and calls
 * `recorderStore.start(url, title)`. On success the parent unmounts the dialog
 * and the `RecorderLiveView` (TD-014.11) takes over via `recorderStore.recording`.
 *
 * Error UX: inline banner inside the dialog (no Toast — dialog-local per
 * audit decision). Distinguishes two sources: (a) client-side validation
 * errors flagged BEFORE submit, (b) backend errors surfaced via
 * `recorderStore.error` after submit.
 */

import { useEffect, useRef, useState } from 'react'
import { useRecorderStore } from '../../store/recorderStore'
import {
  validateRecordingUrl,
  MAX_RECORDER_URL_LENGTH,
  MAX_RECORDER_TITLE_LENGTH,
} from '../../lib/urlValidation'
import {
  colors, fontSize, fontWeight, radius, gap, text, buttons, surfaces, withDisabled,
} from './simulationTheme'

interface RecorderLauncherDialogProps {
  open: boolean
  onClose: () => void
  /** Fired after a successful start — parent unmounts this dialog. */
  onStarted?: () => void
}

export function RecorderLauncherDialog({ open, onClose, onStarted }: RecorderLauncherDialogProps) {
  const start = useRecorderStore(s => s.start)
  const isBusy = useRecorderStore(s => s.isBusy)
  const storeError = useRecorderStore(s => s.error)

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Focus the URL field whenever the dialog opens + reset state on close.
  useEffect(() => {
    if (open) {
      setUrl('')
      setTitle('')
      setClientError(null)
      // Timeout 0 — let the overlay mount before focusing.
      setTimeout(() => urlInputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientError(null)

    if (url.length === 0) {
      setClientError('url is required')
      return
    }
    if (url.length > MAX_RECORDER_URL_LENGTH) {
      setClientError(`url must not exceed ${MAX_RECORDER_URL_LENGTH} characters`)
      return
    }
    if (title.length > MAX_RECORDER_TITLE_LENGTH) {
      setClientError(`title must not exceed ${MAX_RECORDER_TITLE_LENGTH} characters`)
      return
    }
    const urlErr = validateRecordingUrl(url)
    if (urlErr) {
      setClientError(urlErr)
      return
    }

    await start(url, title || undefined)
    // If the store reports no error after start, the call succeeded —
    // `recording` is now true; notify parent + close.
    if (!useRecorderStore.getState().error) {
      onStarted?.()
      onClose()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !isBusy) onClose()
  }

  const displayError = clientError ?? storeError

  return (
    <div
      style={styles.overlay}
      onMouseDown={e => { if (e.target === e.currentTarget && !isBusy) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Record simulation from a real application"
        style={styles.dialog}
        onSubmit={handleSubmit}
        noValidate
      >
        <h2 style={styles.heading}>Record simulation</h2>
        <p style={styles.hint}>
          Opens the URL in a browser we control and captures every click / input as a step.
        </p>

        <label style={styles.label} htmlFor="rec-url">URL</label>
        <input
          id="rec-url"
          ref={urlInputRef}
          type="url"
          data-testid="recorder-url-input"
          placeholder="https://example.com/app/login"
          style={styles.input}
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={isBusy}
          autoComplete="off"
        />

        <label style={styles.label} htmlFor="rec-title">Title <span style={styles.optional}>(optional)</span></label>
        <input
          id="rec-title"
          type="text"
          data-testid="recorder-title-input"
          placeholder="Short description for the recording"
          maxLength={MAX_RECORDER_TITLE_LENGTH}
          style={styles.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={isBusy}
        />

        {displayError && (
          <div role="alert" data-testid="recorder-dialog-error" style={styles.error}>
            {displayError}
          </div>
        )}

        <div style={styles.actions}>
          <button
            type="button"
            data-testid="recorder-dialog-cancel"
            style={styles.btnCancel}
            onClick={onClose}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="recorder-dialog-start"
            // TD-014.24 dec 11 + `decisions/2026-04-25-button-label-change-convention.md`:
            // app-chrome buttons do NOT take label-change. Disabled-only is the
            // complete state signal — previously rendered `Starting…` was an
            // accidental label-change drift, removed here.
            style={withDisabled(styles.btnStart, isBusy)}
            disabled={isBusy}
          >
            Start recording
          </button>
        </div>
      </form>
    </div>
  )
}

// TD-014.24: theme-derived styles. Layout-specific values stay inline:
//   • dialog padding '20px 22px' — RecorderLauncher's interior tuning
//   • dialog minWidth/maxWidth — modal-specific dimensions
//   • overlay zIndex 1100 (above the SimulationEditor overlay at 1000)
//   • input padding '7px 10px' — modal-density input chrome (StepForm uses '5px 8px'
//     for its denser side-panel layout, both intentional per surface)
// See `decisions/2026-04-25-simulation-style-consistency.md` sub-decisions
// 6 (input fontSize unified to 12), 8 (button vertical padding unified to
// 6px via buttons.{primary,secondary}), 9 (error banner padding 8x16).
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
    padding: '20px 22px',
    minWidth: 420,
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column',
    gap: gap.default,
  },
  heading: {
    margin: 0,
    fontSize: fontSize.heading,
    fontWeight: fontWeight.medium,
  },
  hint: {
    margin: '0 0 8px 0',
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  label: {
    ...text.label,
    marginTop: 4,
  },
  optional: {
    fontSize: fontSize.tiny,
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: fontWeight.normal,
    marginLeft: 4,
  },
  input: {
    background: colors.bgDeepest,
    border: `1px solid ${colors.bgElevated}`,
    borderRadius: radius.default,
    color: colors.textPrimary,
    fontSize: fontSize.caption, // dec 6: 13→12
    padding: '7px 10px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  // Compact inline alert variant (border + radius). RecorderLauncher's error
  // sits inside the dialog body; differs visually from the full-bleed banner
  // pattern in RecorderLiveView / SessionsPickerDialog. Spreads errorBanner
  // for consensus values (padding, bg, color, fontSize), adds inset chrome.
  error: {
    ...surfaces.errorBanner,
    marginTop: 4,
    border: `1px solid ${colors.accentRed}`,
    borderRadius: radius.default,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: gap.default,
    marginTop: 10,
  },
  btnCancel: {
    ...buttons.secondary,
  },
  btnStart: {
    ...buttons.primary,
  },
}
