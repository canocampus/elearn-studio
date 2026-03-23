/**
 * PublishDialog — T204
 * Shows suspend data usage estimate before packaging SCORM.
 * Color coding: green <75%, amber 75–90%, red >90%
 */

import { useMemo, useEffect, useRef } from 'react'
import LZString from 'lz-string'
import type { CourseDoc } from '../../types/course'

const SUSPEND_DATA_MAX = 4096
const QUESTION_TYPES = new Set([
  'question-mc',
  'question-tf',
  'question-fill',
  'question-match',
  'question-drag',
  'question-hotspot',
])

function estimateSuspendSize(questionWidgetIds: string[]): { compressed: number; percentage: number } {
  const payload = {
    v: 1,
    slide: 0,
    scores: questionWidgetIds.map((id) => [id, { s: 0.5, w: 100, a: true }]),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
  const size = compressed.length
  const percentage = Math.round((size / SUSPEND_DATA_MAX) * 100)
  return { compressed: size, percentage }
}

function getQuestionWidgetIds(course: CourseDoc): string[] {
  const ids: string[] = []
  for (const slide of course.slides) {
    for (const widget of slide.widgets) {
      if (QUESTION_TYPES.has(widget.type)) {
        ids.push(widget.id)
      }
    }
  }
  return ids
}

function getMeterColor(percentage: number): string {
  if (percentage >= 90) return '#f38ba8' // red
  if (percentage >= 75) return '#fab387' // amber
  return '#a6e3a1'                       // green
}

interface PublishDialogProps {
  course: CourseDoc
  onConfirm: () => void
  onCancel: () => void
  publishing: boolean
}

export function PublishDialog({ course, onConfirm, onCancel, publishing }: PublishDialogProps) {
  const { compressed, percentage } = useMemo(() => {
    const ids = getQuestionWidgetIds(course)
    return estimateSuspendSize(ids)
  }, [course])

  const meterColor = getMeterColor(percentage)
  const questionCount = useMemo(() => getQuestionWidgetIds(course).length, [course])
  const titleId = 'publish-dialog-title'
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstFocusRef.current?.focus()
  }, [])

  function handleBackdropKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={styles.backdrop} onKeyDown={handleBackdropKeyDown}>
      <div style={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} style={styles.title}>Publish SCORM Package</h2>

        <section style={styles.section}>
          <div style={styles.sectionLabel}>Suspend Data Estimate</div>
          <div style={styles.statRow}>
            <span style={styles.statKey}>Questions tracked</span>
            <span style={styles.statValue}>{questionCount}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statKey}>Estimated size</span>
            <span style={{ ...styles.statValue, color: meterColor }}>
              {compressed} / {SUSPEND_DATA_MAX} chars ({percentage}%)
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={styles.meterTrack}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Suspend data usage"
          >
            <div
              style={{
                ...styles.meterFill,
                width: `${Math.min(percentage, 100)}%`,
                background: meterColor,
              }}
            />
          </div>

          {percentage >= 90 && (
            <p role="alert" style={styles.warning}>
              Warning: suspend data is near the SCORM 1.2 limit (4096 chars). Some LMS
              implementations may truncate it, causing score loss. Consider splitting the
              course into smaller modules.
            </p>
          )}
          {percentage >= 75 && percentage < 90 && (
            <p role="alert" style={styles.caution}>
              Caution: suspend data is at {percentage}% capacity. Monitor after publishing.
            </p>
          )}
        </section>

        <div style={styles.actions}>
          <button ref={firstFocusRef} style={{ ...styles.btn, ...styles.btnCancel }} onClick={onCancel} disabled={publishing}>
            Cancel
          </button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onConfirm} disabled={publishing} aria-busy={publishing}>
            {publishing ? 'Packaging…' : 'Publish SCORM 1.2'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  dialog: {
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 8,
    padding: 24,
    width: 420,
    maxWidth: '90vw',
    color: '#cdd6f4',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: {
    margin: '0 0 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#cdd6f4',
  },
  section: {
    background: '#181825',
    border: '1px solid #313244',
    borderRadius: 6,
    padding: '14px 16px',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 10,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    fontSize: 13,
  },
  statKey: {
    color: '#a6adc8',
  },
  statValue: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
    color: '#cdd6f4',
  },
  meterTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    background: '#313244',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  warning: {
    margin: '10px 0 0',
    fontSize: 12,
    color: '#f38ba8',
    lineHeight: 1.5,
  },
  caution: {
    margin: '10px 0 0',
    fontSize: 12,
    color: '#fab387',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    padding: '7px 18px',
    fontSize: 13,
    borderRadius: 5,
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnCancel: {
    background: 'transparent',
    border: '1px solid #45475a',
    color: '#a6adc8',
  },
  btnPrimary: {
    background: '#89b4fa',
    border: '1px solid #89b4fa',
    color: '#1e1e2e',
    fontWeight: 600,
  },
}
