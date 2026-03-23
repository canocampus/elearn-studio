/**
 * ActionsPanel — T020.2
 *
 * Top-level panel for the Actions Editor tab in the right sidebar.
 * Integrates: EventSelector (tabs) + ActionSequenceEditor (ordered list)
 *             + ActionPalette (insert new action) + VariablePanel (variables)
 */

import { useActionsStore } from '../../store/actionsStore'
import { useEditorStore } from '../../store/editorStore'
import { useActionsSave } from '../../hooks/useActionsSave'
import { EventSelector } from './EventSelector'
import { ActionSequenceEditor } from './ActionSequenceEditor'
import { ActionPalette } from './ActionPalette'
import { VariablePanel } from './VariablePanel'
import { SharedSequenceLibrary } from './SharedSequenceLibrary'
import { validateAllSequences } from '../../utils/validateSequence'

export function ActionsPanel() {
  useActionsSave()
  const widgetId        = useActionsStore((s) => s.widgetId)
  const selectedEvent   = useActionsStore((s) => s.selectedEvent)
  const sequences       = useActionsStore((s) => s.sequences)
  const sharedSequences = useActionsStore((s) => s.sharedSequences)
  const widgets         = useEditorStore((s) => s.course?.slides[s.currentSlideIndex]?.widgets ?? [])

  const warnings = widgetId
    ? validateAllSequences(
        sequences,
        widgets.map((w) => w.id),
        sharedSequences,
      )
    : []

  if (!widgetId) {
    return (
      <div style={styles.empty}>
        Select a widget to edit its actions.
      </div>
    )
  }

  return (
    <div style={styles.container} data-testid="actions-panel">
      {/* Validation warnings (T020.18) */}
      {warnings.length > 0 && (
        <div style={styles.warnings}>
          {warnings.map((w, i) => (
            <div key={i} style={styles.warning}>
              ⚠ [{w.event}] {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Event selector tabs */}
      <EventSelector />

      {/* Action list for the selected event */}
      <div style={styles.sequenceArea}>
        <ActionSequenceEditor />
      </div>

      {/* Action palette — only shown when an event is selected */}
      {selectedEvent && (
        <div style={styles.paletteArea}>
          <div style={styles.paletteHeader}>Add Action</div>
          <ActionPalette />
        </div>
      )}

      {/* Variable definitions */}
      <VariablePanel />

      {/* Shared sequence library (course-level macros) */}
      <SharedSequenceLibrary />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  warnings: {
    background: '#2a1f0f',
    borderBottom: '1px solid #fab387',
    padding: '6px 8px',
    flexShrink: 0,
  },
  warning: {
    fontSize: 10,
    color: '#fab387',
    lineHeight: 1.4,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    fontSize: 12,
    color: '#cdd6f4',
    background: '#181825',
  },
  empty: {
    padding: 16,
    color: '#6c7086',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sequenceArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  paletteArea: {
    borderTop: '1px solid #313244',
    flexShrink: 0,
    maxHeight: 180,
    overflowY: 'auto',
  },
  paletteHeader: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '6px 8px 0',
  },
}
