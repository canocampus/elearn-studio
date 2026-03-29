/**
 * ActionPalette — T020.4/T020.5
 *
 * Categorised grid of action types.  Clicking an action inserts a new item
 * with default params into the currently-selected event sequence.
 * Buttons are also draggable — drag onto the sequence list to insert at position.
 */

import { useActionsStore } from '../../store/actionsStore'
import { ACTION_PALETTE, type Action, type ActionType } from '../../types/actions'

interface ActionPaletteProps {
  /** If provided, restrict which actions appear (used by nested editors) */
  allowedCategories?: string[]
  /** Called when an action is inserted (instead of dispatching to store) */
  onInsert?: (action: Action) => void
}

export function ActionPalette({ allowedCategories, onInsert }: ActionPaletteProps) {
  const selectedEvent = useActionsStore((s) => s.selectedEvent)
  const addAction = useActionsStore((s) => s.addAction)

  const filtered = allowedCategories
    ? ACTION_PALETTE.filter((a) => allowedCategories.includes(a.category))
    : ACTION_PALETTE

  const categories = [...new Set(filtered.map((a) => a.category))]

  function handleInsert(type: ActionType) {
    const action = defaultAction(type)
    if (onInsert) {
      onInsert(action)
    } else if (selectedEvent) {
      addAction(selectedEvent, action)
    } else {
      console.warn('[ActionPalette] No event selected — action dropped:', type)
    }
  }

  return (
    <div style={styles.container}>
      {categories.map((cat) => (
        <div key={cat} style={styles.category}>
          <div style={styles.categoryLabel}>{cat}</div>
          <div style={styles.grid}>
            {filtered
              .filter((a) => a.category === cat)
              .map((a) => (
                <button
                  key={a.type}
                  draggable
                  style={styles.actionBtn}
                  title={a.description}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-action-type', a.type)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => handleInsert(a.type)}
                >
                  {a.label}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Default action params ────────────────────────────────────────────────────

export function defaultAction(type: ActionType): Action {
  switch (type) {
    case 'navigate':
      return { type: 'navigate', params: { target: 'next' } }
    case 'show':
      return { type: 'show', params: { widgetId: '' } }
    case 'hide':
      return { type: 'hide', params: { widgetId: '' } }
    case 'bring-to-front':
      return { type: 'bring-to-front', params: { widgetId: '' } }
    case 'set-variable':
      return { type: 'set-variable', params: { name: '', value: '', valueType: 'literal' } }
    case 'display-message':
      return { type: 'display-message', params: { message: '', title: '' } }
    case 'play-media':
      return { type: 'play-media', params: { widgetId: '' } }
    case 'stop-media':
      return { type: 'stop-media', params: { widgetId: '' } }
    case 'score-question':
      return { type: 'score-question', params: { widgetId: '' } }
    case 'score-quiz':
      return { type: 'score-quiz' }
    case 'send-to-lms':
      return { type: 'send-to-lms' }
    case 'suspend-lesson':
      return { type: 'suspend-lesson' }
    case 'condition':
      return { type: 'condition', params: { expression: '', then: [], else: [] } }
    case 'loop':
      return { type: 'loop', params: { mode: 'count', count: 1, body: [] } }
    case 'play-animation':
      return { type: 'play-animation', params: { widgetId: '' } }
    case 'call-sequence':
      return { type: 'call-sequence', params: { sequenceName: '' } }
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 0',
    overflowY: 'auto',
  },
  category: {
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '2px 8px 4px',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '0 8px',
  },
  actionBtn: {
    padding: '4px 8px',
    fontSize: 11,
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.1s',
  },
}
