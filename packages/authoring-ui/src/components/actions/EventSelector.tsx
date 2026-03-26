/**
 * EventSelector — T020.3
 *
 * Dropdown + tabs that let the author select which event to attach actions to.
 * Shows existing event tabs and a "Add event" button to add new ones.
 */

import { useState } from 'react'
import { useActionsStore } from '../../store/actionsStore'
import { WIDGET_EVENTS, SLIDE_EVENTS } from '../../types/actions'

const ALL_EVENTS: string[] = [...WIDGET_EVENTS, ...SLIDE_EVENTS]

export function EventSelector() {
  const sequences = useActionsStore((s) => s.sequences)
  const selectedEvent = useActionsStore((s) => s.selectedEvent)
  const selectEvent = useActionsStore((s) => s.selectEvent)
  const addSequence = useActionsStore((s) => s.addSequence)
  const removeSequence = useActionsStore((s) => s.removeSequence)

  const [showAdd, setShowAdd] = useState(false)
  const usedEvents = sequences.map((s) => s.event)
  const availableEvents = ALL_EVENTS.filter((e) => !usedEvents.includes(e))

  function handleAdd(event: string) {
    addSequence(event)
    setShowAdd(false)
  }

  return (
    <div style={styles.container}>
      {/* Event tabs — toolbar with toggle buttons + per-tab remove buttons */}
      <div style={styles.tabRow} role="toolbar" aria-label="Event handlers">
        {sequences.map((seq) => (
          <div key={seq.event} role="group" aria-label={formatEvent(seq.event)} style={styles.tab}>
            <button
              style={{
                ...styles.tabLabel,
                ...(selectedEvent === seq.event ? styles.tabLabelActive : {}),
              }}
              aria-pressed={selectedEvent === seq.event}
              onClick={() => selectEvent(seq.event)}
            >
              {formatEvent(seq.event)}
            </button>
            <button
              style={styles.tabRemove}
              title={`Remove ${formatEvent(seq.event)} event`}
              aria-label={`Remove ${formatEvent(seq.event)} event`}
              onClick={() => removeSequence(seq.event)}
            >
              ×
            </button>
          </div>
        ))}

        {availableEvents.length > 0 && (
          <button
            style={styles.addBtn}
            onClick={() => setShowAdd((v) => !v)}
            title="Add event"
            aria-haspopup="menu"
            aria-expanded={showAdd}
          >
            + Event
          </button>
        )}
      </div>

      {/* Add event dropdown */}
      {showAdd && (
        <div style={styles.dropdown} role="menu" aria-label="Available events">
          {availableEvents.map((event) => (
            <button
              key={event}
              role="menuitem"
              style={styles.dropdownItem}
              onClick={() => handleAdd(event)}
            >
              {formatEvent(event)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatEvent(event: string): string {
  // camelCase → spaced Title Case
  return event.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    flexShrink: 0,
  },
  tabRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '6px 8px',
    borderBottom: '1px solid #313244',
    background: '#1e1e2e',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    background: '#313244',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tabLabel: {
    padding: '3px 8px',
    fontSize: 11,
    color: '#cdd6f4',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabLabelActive: {
    background: '#45475a',
    outline: '1px solid #89b4fa',
    outlineOffset: '-1px',
  },
  tabRemove: {
    padding: '3px 5px 3px 0',
    fontSize: 12,
    color: '#6c7086',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  },
  addBtn: {
    padding: '3px 8px',
    fontSize: 11,
    color: '#89b4fa',
    background: 'transparent',
    border: '1px dashed #45475a',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 8,
    zIndex: 50,
    background: '#181825',
    border: '1px solid #313244',
    borderRadius: 6,
    minWidth: 160,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
  },
  dropdownItem: {
    padding: '7px 12px',
    fontSize: 12,
    color: '#cdd6f4',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  },
}
