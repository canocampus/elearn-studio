/**
 * ActionSequenceEditor — T020.7–T020.15 + T020.5 (drag-to-insert)
 *
 * Renders the ordered list of actions for the selected event sequence.
 * Supports reorder (↑/↓), remove (×), nested editors for condition/loop,
 * and drag-and-drop from the ActionPalette to insert at a specific position.
 */

import { useState, useRef } from 'react'
import { useActionsStore } from '../../store/actionsStore'
import { ActionItemEditor } from './ActionItemEditor'
import { ActionPalette, defaultAction } from './ActionPalette'
import type { Action, ActionType } from '../../types/actions'

const DRAG_MIME = 'application/x-action-type'

export function ActionSequenceEditor() {
  const sequences = useActionsStore((s) => s.sequences)
  const selectedEvent = useActionsStore((s) => s.selectedEvent)
  const removeAction = useActionsStore((s) => s.removeAction)
  const updateAction = useActionsStore((s) => s.updateAction)
  const moveAction = useActionsStore((s) => s.moveAction)
  const insertAction = useActionsStore((s) => s.insertAction)

  const [dropSlot, setDropSlot] = useState<number | null>(null)
  const actionKeys = useRef(new WeakMap<object, string>())
  const keyCounter = useRef(0)
  function getActionKey(action: object): string {
    if (!actionKeys.current.has(action)) {
      actionKeys.current.set(action, String(++keyCounter.current))
    }
    return actionKeys.current.get(action)!
  }

  if (!selectedEvent) {
    return <div style={styles.empty}>No event selected</div>
  }

  const seq = sequences.find((s) => s.event === selectedEvent)

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDropSlot(null)
    const type = e.dataTransfer.getData(DRAG_MIME) as ActionType | ''
    if (!type) return
    insertAction(selectedEvent!, index, defaultAction(type))
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropSlot(index)
  }

  function handleDragLeave() {
    setDropSlot(null)
  }

  // Empty state — also acts as a drop zone (insert at 0)
  if (!seq || seq.actions.length === 0) {
    return (
      <div
        style={{
          ...styles.empty,
          ...(dropSlot === 0 ? styles.emptyDropActive : {}),
        }}
        onDragOver={(e) => handleDragOver(e, 0)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 0)}
      >
        No actions yet — drop or click from the palette below.
      </div>
    )
  }

  return (
    <div
      style={styles.list}
      data-testid="event-list"
      onDragLeave={handleDragLeave}
    >
      {/* Drop slot before first row */}
      <DropSlot
        active={dropSlot === 0}
        onDragOver={(e) => handleDragOver(e, 0)}
        onDrop={(e) => handleDrop(e, 0)}
      />

      {seq.actions.map((action, index) => (
        <div key={getActionKey(action)}>
          <ActionRow
            action={action}
            index={index}
            total={seq.actions.length}
            selectedEvent={selectedEvent}
            onMove={(from, to) => moveAction(selectedEvent, from, to)}
            onRemove={() => removeAction(selectedEvent, index)}
            onChange={(updated) => updateAction(selectedEvent, index, updated)}
          />
          {/* Drop slot after each row (insert at index + 1) */}
          <DropSlot
            active={dropSlot === index + 1}
            onDragOver={(e) => handleDragOver(e, index + 1)}
            onDrop={(e) => handleDrop(e, index + 1)}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Drop slot indicator ─────────────────────────────────────────────────────

interface DropSlotProps {
  active: boolean
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function DropSlot({ active, onDragOver, onDrop }: DropSlotProps) {
  return (
    <div
      style={{ ...styles.dropSlot, ...(active ? styles.dropSlotActive : {}) }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    />
  )
}

// ─── Single action row ──────────────────────────────────────────────────────

interface ActionRowProps {
  action: Action
  index: number
  total: number
  selectedEvent: string
  onMove: (from: number, to: number) => void
  onRemove: () => void
  onChange: (action: Action) => void
}

function ActionRow({
  action,
  index,
  total,
  selectedEvent,
  onMove,
  onRemove,
  onChange,
}: ActionRowProps) {
  return (
    <div style={styles.row} data-testid="action-item">
      {/* Reorder controls */}
      <div style={styles.orderBtns}>
        <button
          style={styles.orderBtn}
          disabled={index === 0}
          title="Move up"
          onClick={() => onMove(index, index - 1)}
        >
          ▲
        </button>
        <button
          style={styles.orderBtn}
          disabled={index === total - 1}
          title="Move down"
          onClick={() => onMove(index, index + 1)}
        >
          ▼
        </button>
      </div>

      {/* Action content */}
      <div style={styles.content}>
        <ActionItemEditor action={action} onChange={onChange} />

        {/* Nested panels for condition/loop */}
        {action.type === 'condition' && (
          <NestedBranches
            action={action}
            actionIndex={index}
            selectedEvent={selectedEvent}
          />
        )}
        {action.type === 'loop' && (
          <NestedBody
            action={action}
            actionIndex={index}
            selectedEvent={selectedEvent}
          />
        )}
      </div>

      {/* Remove button */}
      <button
        style={styles.removeBtn}
        title="Remove action"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

// ─── Nested condition branches (then / else) ─────────────────────────────────

interface NestedBranchesProps {
  action: Extract<Action, { type: 'condition' }>
  actionIndex: number
  selectedEvent: string
}

function NestedBranches({ action, actionIndex, selectedEvent }: NestedBranchesProps) {
  const updateAction = useActionsStore((s) => s.updateAction)

  function insertThen(nested: Action) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, then: [...action.params.then, nested] },
    })
  }

  function insertElse(nested: Action) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, else: [...(action.params.else ?? []), nested] },
    })
  }

  function removeThen(i: number) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: {
        ...action.params,
        then: action.params.then.filter((_, idx) => idx !== i),
      },
    })
  }

  function removeElse(i: number) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: {
        ...action.params,
        else: (action.params.else ?? []).filter((_, idx) => idx !== i),
      },
    })
  }

  function updateThen(i: number, updated: Action) {
    const then = [...action.params.then]
    then[i] = updated
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, then },
    })
  }

  function updateElse(i: number, updated: Action) {
    const elseActions = [...(action.params.else ?? [])]
    elseActions[i] = updated
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, else: elseActions },
    })
  }

  return (
    <div style={styles.nested}>
      <NestedList
        label="Then"
        keyPrefix={`then-${actionIndex}`}
        actions={action.params.then}
        onUpdate={updateThen}
        onRemove={removeThen}
        onInsert={insertThen}
      />
      <NestedList
        label="Else"
        keyPrefix={`else-${actionIndex}`}
        actions={action.params.else ?? []}
        onUpdate={updateElse}
        onRemove={removeElse}
        onInsert={insertElse}
      />
    </div>
  )
}

// ─── Nested loop body ─────────────────────────────────────────────────────────

interface NestedBodyProps {
  action: Extract<Action, { type: 'loop' }>
  actionIndex: number
  selectedEvent: string
}

function NestedBody({ action, actionIndex, selectedEvent }: NestedBodyProps) {
  const updateAction = useActionsStore((s) => s.updateAction)

  function insertBody(nested: Action) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, body: [...action.params.body, nested] },
    })
  }

  function removeBody(i: number) {
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: {
        ...action.params,
        body: action.params.body.filter((_, idx) => idx !== i),
      },
    })
  }

  function updateBody(i: number, updated: Action) {
    const body = [...action.params.body]
    body[i] = updated
    updateAction(selectedEvent, actionIndex, {
      ...action,
      params: { ...action.params, body },
    })
  }

  return (
    <div style={styles.nested}>
      <NestedList
        label="Body"
        keyPrefix={`body-${actionIndex}`}
        actions={action.params.body}
        onUpdate={updateBody}
        onRemove={removeBody}
        onInsert={insertBody}
      />
    </div>
  )
}

// ─── Generic nested list ──────────────────────────────────────────────────────

interface NestedListProps {
  label: string
  keyPrefix: string
  actions: Action[]
  onUpdate: (index: number, action: Action) => void
  onRemove: (index: number) => void
  onInsert: (action: Action) => void
}

function NestedList({ label, keyPrefix: _keyPrefix, actions, onUpdate, onRemove, onInsert }: NestedListProps) {
  const nestedKeys = useRef(new WeakMap<object, string>())
  const nestedCounter = useRef(0)
  function getKey(action: object): string {
    if (!nestedKeys.current.has(action)) {
      nestedKeys.current.set(action, String(++nestedCounter.current))
    }
    return nestedKeys.current.get(action)!
  }

  return (
    <div style={styles.nestedSection}>
      <div style={styles.nestedLabel}>{label}</div>
      {actions.length === 0 && (
        <div style={styles.nestedEmpty}>empty</div>
      )}
      {actions.map((a, i) => (
        <div key={getKey(a)} style={styles.nestedRow}>
          <div style={styles.nestedContent}>
            <ActionItemEditor
              action={a}
              onChange={(updated) => onUpdate(i, updated)}
            />
          </div>
          <button
            style={styles.removeBtn}
            title="Remove"
            onClick={() => onRemove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <div style={styles.nestedPalette}>
        <ActionPalette
          allowedCategories={['Navigation', 'Object', 'Media', 'Scoring', 'Variables']}
          onInsert={onInsert}
        />
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    padding: '4px 6px',
  },
  empty: {
    padding: '16px 12px',
    color: '#6c7086',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    borderRadius: 4,
    border: '2px dashed transparent',
    transition: 'border-color 0.1s',
  },
  emptyDropActive: {
    borderColor: '#89b4fa',
    color: '#89b4fa',
    background: 'rgba(137, 180, 250, 0.06)',
  },
  dropSlot: {
    height: 6,
    borderRadius: 2,
    margin: '1px 0',
    transition: 'height 0.1s, background 0.1s',
  },
  dropSlotActive: {
    height: 8,
    background: '#89b4fa',
    boxShadow: '0 0 4px rgba(137, 180, 250, 0.5)',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    background: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 4,
    padding: '5px 6px',
  },
  orderBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    flexShrink: 0,
  },
  orderBtn: {
    width: 18,
    height: 14,
    padding: 0,
    fontSize: 8,
    lineHeight: 1,
    background: '#313244',
    color: '#6c7086',
    border: '1px solid #45475a',
    borderRadius: 2,
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    flexShrink: 0,
    width: 18,
    height: 18,
    padding: 0,
    fontSize: 13,
    lineHeight: '16px',
    background: 'transparent',
    color: '#6c7086',
    border: '1px solid #45475a',
    borderRadius: 3,
    cursor: 'pointer',
  },
  nested: {
    marginTop: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nestedSection: {
    background: '#11111b',
    border: '1px solid #313244',
    borderRadius: 3,
    padding: '4px 6px',
  },
  nestedLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#a6e3a1',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  nestedEmpty: {
    fontSize: 10,
    color: '#585b70',
    fontStyle: 'italic',
    padding: '2px 0 4px',
  },
  nestedRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 3,
  },
  nestedContent: {
    flex: 1,
    minWidth: 0,
  },
  nestedPalette: {
    borderTop: '1px solid #313244',
    marginTop: 4,
    paddingTop: 4,
  },
}
