/**
 * VariablePanel — T020.16
 *
 * Displays the list of course-level variable names defined by the author.
 * Allows adding new variable names used as references in set-variable / condition actions.
 */

import { useState } from 'react'
import { useActionsStore } from '../../store/actionsStore'

export function VariablePanel() {
  const variableNames = useActionsStore((s) => s.variableNames)
  const addVariableName = useActionsStore((s) => s.addVariableName)

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    if (!VALID_NAME.test(name)) {
      setError('Must start with a letter or _ and contain only letters, digits, _')
      return
    }
    setError(null)
    addVariableName(name)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Variables</div>

      {variableNames.length === 0 && (
        <div style={styles.empty}>No variables defined.</div>
      )}

      <div style={styles.list}>
        {variableNames.map((name) => (
          <div key={name} style={styles.varRow}>
            <span style={styles.varDollar}>$</span>
            <span style={styles.varName}>{name}</span>
          </div>
        ))}
      </div>

      <div style={styles.addRow}>
        <span style={styles.varDollar}>$</span>
        <input
          style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
          placeholder="variable_name"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.addBtn} onClick={handleAdd}>
          Add
        </button>
      </div>
      {error && <div style={styles.errorMsg}>{error}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '6px 8px',
    borderTop: '1px solid #313244',
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
    color: '#585b70',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 6,
  },
  varRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '2px 4px',
    background: '#11111b',
    border: '1px solid #313244',
    borderRadius: 3,
  },
  varDollar: {
    color: '#cba6f7',
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
  varName: {
    fontSize: 11,
    color: '#cdd6f4',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    flex: 1,
    padding: '3px 6px',
    fontSize: 11,
    background: '#11111b',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: 3,
    outline: 'none',
    minWidth: 0,
  },
  inputError: {
    borderColor: '#f38ba8',
  },
  errorMsg: {
    fontSize: 10,
    color: '#f38ba8',
    marginTop: 3,
  },
  addBtn: {
    padding: '3px 8px',
    fontSize: 11,
    background: '#313244',
    color: '#89b4fa',
    border: '1px solid #45475a',
    borderRadius: 3,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
