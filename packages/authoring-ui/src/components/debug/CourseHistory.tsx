/**
 * CourseHistory — T167
 *
 * Floating panel showing the audit trail for the current course.
 * Activated via the debug toggle in TopToolbar; renders only when courseId is set.
 */

import { useState, useEffect, useCallback } from 'react'
import { getCourseHistory, type AuditLogEntry } from '../../api/courseApi'

interface CourseHistoryProps {
  courseId: string
  onClose: () => void
}

const ACTION_LABELS: Record<string, string> = {
  'course.create':  'Created course',
  'course.update':  'Updated course',
  'course.delete':  'Deleted course',
  'slide.create':   'Added slide',
  'slide.update':   'Updated slide',
  'slide.delete':   'Deleted slide',
  'slide.reorder':  'Reordered slides',
}

const ACTION_COLOR: Record<string, string> = {
  'course.create': '#a6e3a1',
  'course.update': '#89b4fa',
  'course.delete': '#f38ba8',
  'slide.create':  '#a6e3a1',
  'slide.update':  '#89b4fa',
  'slide.delete':  '#f38ba8',
  'slide.reorder': '#f9e2af',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function DetailBadge({ detail }: { detail?: Record<string, unknown> }) {
  if (!detail) return null
  const parts: string[] = []
  if (typeof detail.slideId === 'string') parts.push(`slide: ${detail.slideId.slice(0, 8)}…`)
  if (Array.isArray(detail.fields) && detail.fields.length > 0) parts.push(detail.fields.join(', '))
  if (typeof detail.title === 'string') parts.push(`"${detail.title.slice(0, 30)}"`)
  if (!parts.length) return null
  return <span style={styles.detail}>{parts.join(' · ')}</span>
}

export function CourseHistory({ courseId, onClose }: CourseHistoryProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skip, setSkip] = useState(0)
  const limit = 20

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCourseHistory(courseId, { limit, skip: offset })
      setEntries(result.entries)
      setTotal(result.total)
      setSkip(offset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void load(0)
  }, [load])

  const hasPrev = skip > 0
  const hasNext = skip + limit < total

  return (
    <div style={styles.overlay} data-testid="course-history-panel">
      <div style={styles.header}>
        <span style={styles.title}>Course History</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={styles.count}>{total} events</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close history">✕</button>
        </div>
      </div>

      <div style={styles.body}>
        {loading && <div style={styles.status}>Loading…</div>}
        {error && <div style={{ ...styles.status, color: '#f38ba8' }}>{error}</div>}
        {!loading && !error && entries.length === 0 && (
          <div style={styles.status}>No history yet.</div>
        )}
        {!loading && entries.map(entry => (
          <div key={entry._id} style={styles.row} data-testid="history-entry">
            <span
              style={{ ...styles.actionBadge, color: ACTION_COLOR[entry.action] ?? '#cdd6f4' }}
            >
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <DetailBadge detail={entry.detail} />
            <div style={styles.meta}>
              <span style={styles.actor}>{entry.actorEmail}</span>
              <span style={styles.time}>{formatTime(entry.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {(hasPrev || hasNext) && (
        <div style={styles.pagination}>
          <button
            style={{ ...styles.pageBtn, opacity: hasPrev ? 1 : 0.4 }}
            disabled={!hasPrev}
            onClick={() => void load(Math.max(0, skip - limit))}
          >
            ← Prev
          </button>
          <span style={styles.pageInfo}>
            {skip + 1}–{Math.min(skip + limit, total)} of {total}
          </span>
          <button
            style={{ ...styles.pageBtn, opacity: hasNext ? 1 : 0.4 }}
            disabled={!hasNext}
            onClick={() => void load(skip + limit)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    bottom: 16,
    right: 500,          // offset left of CourseInspector (which sits at right:16, width:480)
    zIndex: 9998,
    width: 420,
    maxHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #45475a',
    background: '#1e1e2e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#313244',
    borderBottom: '1px solid #45475a',
    flexShrink: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f9e2af',
    fontFamily: 'monospace',
  },
  count: {
    fontSize: 11,
    color: '#6c7086',
    fontFamily: 'monospace',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 4px',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  status: {
    padding: '12px 16px',
    fontSize: 12,
    color: '#6c7086',
    fontFamily: 'monospace',
  },
  row: {
    padding: '8px 12px',
    borderBottom: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  actionBadge: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  detail: {
    fontSize: 11,
    color: '#6c7086',
    fontFamily: 'monospace',
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  actor: {
    fontSize: 11,
    color: '#89dceb',
    fontFamily: 'monospace',
  },
  time: {
    fontSize: 11,
    color: '#585b70',
    fontFamily: 'monospace',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderTop: '1px solid #313244',
    background: '#181825',
    flexShrink: 0,
  },
  pageBtn: {
    background: 'transparent',
    border: '1px solid #45475a',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  pageInfo: {
    fontSize: 11,
    color: '#6c7086',
    fontFamily: 'monospace',
  },
}
