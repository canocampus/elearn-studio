/**
 * SharedSequenceLibrary — T020.17
 *
 * Panel for managing course-level shared action sequences (macros).
 * Lists sequences by name, allows creating, renaming, and deleting them.
 * Rendered inside ActionsPanel below the VariablePanel.
 */

import { useState } from 'react'
import { useActionsStore } from '../../store/actionsStore'

export function SharedSequenceLibrary() {
  const sharedSequences    = useActionsStore((s) => s.sharedSequences)
  const addSharedSequence  = useActionsStore((s) => s.addSharedSequence)
  const removeSharedSequence = useActionsStore((s) => s.removeSharedSequence)
  const renameSharedSequence = useActionsStore((s) => s.renameSharedSequence)

  const [newName, setNewName]       = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue]   = useState('')

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    addSharedSequence(name)
    setNewName('')
  }

  function startRename(name: string) {
    setEditingName(name)
    setEditValue(name)
  }

  function commitRename(oldName: string) {
    const next = editValue.trim()
    if (next && next !== oldName) {
      renameSharedSequence(oldName, next)
    }
    setEditingName(null)
  }

  return (
    <div style={styles.container} data-testid="shared-sequence-library">
      <div style={styles.header}>Shared Sequences</div>

      {sharedSequences.length === 0 && (
        <div style={styles.empty}>No shared sequences yet.</div>
      )}

      {sharedSequences.map((seq) => (
        <div key={seq.name} style={styles.row}>
          {editingName === seq.name ? (
            <input
              autoFocus
              style={styles.input}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitRename(seq.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(seq.name)
                if (e.key === 'Escape') setEditingName(null)
              }}
            />
          ) : (
            <span
              style={styles.name}
              title="Double-click to rename"
              onDoubleClick={() => startRename(seq.name)}
            >
              {seq.name}
            </span>
          )}
          <span style={styles.count}>{seq.actions.length} action{seq.actions.length !== 1 ? 's' : ''}</span>
          <button
            style={styles.removeBtn}
            title="Delete sequence"
            onClick={() => removeSharedSequence(seq.name)}
          >
            ✕
          </button>
        </div>
      ))}

      <div style={styles.addRow}>
        <input
          style={styles.input}
          placeholder="New sequence name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <button style={styles.addBtn} onClick={handleAdd} disabled={!newName.trim()}>
          + Add
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: '1px solid #313244',
    padding: '8px 8px 4px',
    flexShrink: 0,
  },
  header: {
    fontSize: 10,
    fontWeight: 600,
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 6,
  },
  empty: {
    fontSize: 11,
    color: '#45475a',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 11,
    color: '#a6e3a1',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: {
    fontSize: 10,
    color: '#6c7086',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#f38ba8',
    cursor: 'pointer',
    fontSize: 11,
    lineHeight: 1,
    padding: '0 2px',
    flexShrink: 0,
  },
  addRow: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '3px 6px',
    fontSize: 11,
    background: '#11111b',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 3,
    outline: 'none',
  },
  addBtn: {
    padding: '3px 8px',
    fontSize: 11,
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 3,
    cursor: 'pointer',
    flexShrink: 0,
  },
}
