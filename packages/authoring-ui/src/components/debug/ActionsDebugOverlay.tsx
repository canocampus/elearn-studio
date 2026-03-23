/**
 * ActionsDebugOverlay — T165.3
 *
 * Listens to elearn:action:start / end / error DOM events emitted by
 * the ActionExecutor and shows the last 20 executions with timing.
 * Activated via ?debug=1 or localStorage.setItem('debug','1').
 * Rendered only in DEV builds (guarded in AppLayout).
 */

import { useEffect, useReducer } from 'react'

interface ActionEntry {
  id: number
  type: string
  timestamp: number
  status: 'running' | 'done' | 'error'
  duration?: number
  error?: string
}

type OverlayAction =
  | { kind: 'start'; type: string; timestamp: number }
  | { kind: 'end'; type: string; timestamp: number; duration: number }
  | { kind: 'error'; type: string; timestamp: number; error: string }

let nextId = 0

function reducer(entries: ActionEntry[], action: OverlayAction): ActionEntry[] {
  const MAX = 20
  switch (action.kind) {
    case 'start': {
      const entry: ActionEntry = {
        id: nextId++,
        type: action.type,
        timestamp: action.timestamp,
        status: 'running',
      }
      return [entry, ...entries].slice(0, MAX)
    }
    case 'end': {
      return entries.map(e =>
        e.type === action.type && e.status === 'running'
          ? { ...e, status: 'done', duration: action.duration }
          : e,
      )
    }
    case 'error': {
      return entries.map(e =>
        e.type === action.type && e.status === 'running'
          ? { ...e, status: 'error', error: action.error }
          : e,
      )
    }
  }
}

export function ActionsDebugOverlay() {
  const [entries, dispatch] = useReducer(reducer, [])

  useEffect(() => {
    function onStart(e: Event) {
      const { type, timestamp } = (e as CustomEvent).detail
      dispatch({ kind: 'start', type, timestamp })
    }
    function onEnd(e: Event) {
      const { type, timestamp, duration } = (e as CustomEvent).detail
      dispatch({ kind: 'end', type, timestamp, duration })
    }
    function onError(e: Event) {
      const { type, timestamp, error } = (e as CustomEvent).detail
      dispatch({ kind: 'error', type, timestamp, error })
    }

    window.addEventListener('elearn:action:start', onStart)
    window.addEventListener('elearn:action:end', onEnd)
    window.addEventListener('elearn:action:error', onError)
    return () => {
      window.removeEventListener('elearn:action:start', onStart)
      window.removeEventListener('elearn:action:end', onEnd)
      window.removeEventListener('elearn:action:error', onError)
    }
  }, [])

  if (entries.length === 0) return null

  return (
    <div style={styles.overlay} data-testid="actions-debug-overlay">
      <div style={styles.header}>Actions Log</div>
      <div style={styles.list}>
        {entries.map(entry => (
          <div key={entry.id} style={{ ...styles.row, ...rowStyle(entry.status) }}>
            <span style={styles.actionType}>{entry.type}</span>
            <span style={styles.status}>{statusLabel(entry)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function statusLabel(entry: ActionEntry): string {
  if (entry.status === 'running') return '⋯'
  if (entry.status === 'error') return `✕ ${entry.error ?? ''}`
  return `✓ ${entry.duration}ms`
}

function rowStyle(status: ActionEntry['status']): React.CSSProperties {
  if (status === 'error') return { color: '#f38ba8' }
  if (status === 'done') return { color: '#a6e3a1' }
  return { color: '#89b4fa' }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    zIndex: 9998,
    width: 320,
    maxHeight: '40vh',
    background: '#1e1e2e',
    border: '1px solid #45475a',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  header: {
    padding: '5px 10px',
    background: '#313244',
    borderBottom: '1px solid #45475a',
    color: '#89dceb',
    fontWeight: 600,
    fontSize: 11,
    flexShrink: 0,
  },
  list: {
    overflow: 'auto',
    flex: 1,
    padding: '4px 0',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 10px',
    gap: 8,
  },
  actionType: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  status: {
    flexShrink: 0,
    color: '#6c7086',
  },
}
