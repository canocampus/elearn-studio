/**
 * NameField — TD-013.3
 *
 * Single Name input rendered at the top of the Props tab whenever a widget is
 * selected, regardless of whether that widget has a dedicated PropertiesPanel
 * below. Edits the `name` trait that widgetsFromGrapesjs persists as
 * `widget.name` (TD-008 Bug #4) — the human-readable label used by the Actions
 * Editor widget-target dropdown.
 *
 * Before TD-013.3 this trait was only editable through GrapesJS's built-in
 * Trait Manager, which AppLayout does not mount. Authors could set widget
 * names only by dropping down into dev-tools. Now the field sits above the
 * type-specific panel so every widget (even those styled via the Styles tab)
 * can be named from one consistent place.
 */

import type { Component } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { useComponentProperty } from '../../hooks/useComponentProperty'

export function NameField() {
  const editor = useEditorStore((s) => s.editor)
  const selectedComponentType = useEditorStore((s) => s.selectedComponentType)
  const selected: Component | null = editor?.getSelected() ?? null

  const [name, updateName] = useComponentProperty<string>(selected, 'name', '')

  if (!editor || !selected || !selectedComponentType) return null

  return (
    <div data-testid="widget-name-field" style={styles.container}>
      <label htmlFor="widget-name-input" style={styles.label}>
        Name
      </label>
      <input
        id="widget-name-input"
        data-testid="widget-name-input"
        type="text"
        value={name}
        onChange={(e) => updateName(e.target.value)}
        placeholder="Used by the Actions Editor widget-target dropdown"
        style={styles.input}
        autoComplete="off"
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px 12px',
    borderBottom: '1px solid #313244',
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 3,
    display: 'block',
  },
  input: {
    width: '100%',
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: 4,
    color: '#cdd6f4',
    fontSize: 12,
    padding: '5px 8px',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
  },
}
