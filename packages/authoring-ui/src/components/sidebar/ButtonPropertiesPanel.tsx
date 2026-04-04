/**
 * Button Properties Panel — T603
 *
 * Shown in the "Props" tab when a button, done-button, or nav-buttons widget is selected.
 * Fixes BETA-04 (button caption), BETA-05 (background image), BETA-11 (nav button captions).
 *
 * - button / done-button: caption text field + background image picker
 * - nav-buttons: prev label + next label fields + background image picker
 *
 * Caption is read/written via component.get/set('content') — GrapesJS's built-in
 * mechanism for a component's inner text/HTML; triggers canvas re-render.
 *
 * Background image is applied via component.setStyle({ 'background-image': 'url(...)' })
 * using the GrapesJS Asset Manager, same pattern as the image widget (registerBlocks.ts).
 */

import { useState, useEffect } from 'react'
import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { useComponentProperty } from '../../hooks/useComponentProperty'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUTTON_WIDGET_TYPES = ['button', 'done-button', 'nav-buttons'] as const
type ButtonWidgetType = (typeof BUTTON_WIDGET_TYPES)[number]

export function isButtonWidgetType(type: string): type is ButtonWidgetType {
  return (BUTTON_WIDGET_TYPES as readonly string[]).includes(type)
}

// ---------------------------------------------------------------------------
// Shared styles (mirrors QuestionPropertiesPanel)
// ---------------------------------------------------------------------------

const FIELD_STYLE: React.CSSProperties = {
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
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
}

const SECTION_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #313244',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#6c7086',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  marginBottom: 8,
}

const BUTTON_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#89b4fa',
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
}

// ---------------------------------------------------------------------------
// Background image picker
// ---------------------------------------------------------------------------

function openBackgroundImagePicker(editor: Editor, component: Component) {
  editor.AssetManager.open({
    types: ['image'],
    select(asset: { getSrc: () => string }, complete: boolean) {
      const src = asset.getSrc()
      if (!src) return
      component.setStyle({ 'background-image': `url("${src}")` })
      if (complete) editor.AssetManager.close()
    },
  })
}

// T603 M-02 — Subscribe to change:style so undo/redo and external style mutations
// update the "Current" display without requiring a parent re-render.
// T603 L-02 — typeof guard instead of unsafe `as string | undefined` cast.
function getBgStyle(component: Component): string {
  const raw = component.getStyle()['background-image']
  return typeof raw === 'string' ? raw : ''
}

function BackgroundImageSection({ editor, component }: { editor: Editor; component: Component }) {
  const [currentBg, setCurrentBg] = useState<string>(() => getBgStyle(component))

  useEffect(() => {
    setCurrentBg(getBgStyle(component))
    function onStyleChange() { setCurrentBg(getBgStyle(component)) }
    component.on('change:style', onStyleChange)
    return () => { component.off('change:style', onStyleChange) }
  }, [component])

  return (
    <div style={SECTION_STYLE}>
      <div style={SECTION_TITLE_STYLE}>Background Image</div>
      <button
        style={BUTTON_STYLE}
        onClick={() => openBackgroundImagePicker(editor, component)}
      >
        Choose Image…
      </button>
      {currentBg && (
        <>
          <div style={{ ...LABEL_STYLE, marginTop: 6 }}>Current</div>
          <div
            style={{
              fontSize: 10,
              color: '#6c7086',
              wordBreak: 'break-all',
              marginTop: 2,
            }}
          >
            {currentBg}
          </div>
          <button
            style={{ ...BUTTON_STYLE, marginTop: 6, color: '#f38ba8' }}
            onClick={() => {
              const { 'background-image': _removed, ...remaining } = component.getStyle()
              component.setStyle(remaining)
            }}
          >
            Remove Image
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ButtonPropertiesForm — for 'button' and 'done-button'
// ---------------------------------------------------------------------------

function ButtonPropertiesForm({ editor, component }: { editor: Editor; component: Component }) {
  const [caption, updateCaption] = useComponentProperty<string>(component, 'content', '')

  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Caption</div>
        <label style={LABEL_STYLE}>Button Label</label>
        <input
          type="text"
          value={caption}
          onChange={e => updateCaption(e.target.value)}
          style={FIELD_STYLE}
          placeholder="Button text"
        />
      </div>
      <BackgroundImageSection editor={editor} component={component} />
    </>
  )
}

// ---------------------------------------------------------------------------
// NavButtonsPropertiesForm — for 'nav-buttons'
// Reads/writes prev and next labels from the first two child components.
// Each child gets its own useComponentProperty hook instance.
// ---------------------------------------------------------------------------

const NAV_BUTTON_DEFAULTS = {
  prevLabel: '← Previous',
  nextLabel: 'Next →',
} as const

function NavButtonChildLabel({
  child,
  label,
  placeholder,
}: {
  child: Component
  label: string
  placeholder: string
}) {
  const [value, setValue] = useComponentProperty<string>(child, 'content', placeholder)

  return (
    <>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ ...FIELD_STYLE, marginBottom: 8 }}
        placeholder={placeholder}
      />
    </>
  )
}

function NavButtonsPropertiesForm({ editor, component }: { editor: Editor; component: Component }) {
  const prevChild = component.components().at(0)
  const nextChild = component.components().at(1)

  if (!prevChild || !nextChild) {
    return (
      <div style={{ padding: 16, color: '#f38ba8', fontSize: 12 }}>
        Nav Buttons component is missing child buttons. This component may be corrupted.
      </div>
    )
  }

  return (
    <>
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Button Labels</div>
        <NavButtonChildLabel
          child={prevChild}
          label="Previous Button"
          placeholder={NAV_BUTTON_DEFAULTS.prevLabel}
        />
        <NavButtonChildLabel
          child={nextChild}
          label="Next Button"
          placeholder={NAV_BUTTON_DEFAULTS.nextLabel}
        />
      </div>
      <BackgroundImageSection editor={editor} component={component} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

export function ButtonPropertiesPanel() {
  const editor = useEditorStore(s => s.editor)
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)

  if (!editor || !selectedComponentType || !isButtonWidgetType(selectedComponentType)) {
    return (
      <div
        style={{
          padding: 16,
          color: '#6c7086',
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Select a button widget to edit its properties.
      </div>
    )
  }

  const selected = editor.getSelected()
  if (!selected) {
    return (
      <div style={{ padding: 16, color: '#6c7086', fontSize: 12, textAlign: 'center' }}>
        No component selected.
      </div>
    )
  }

  const type = (selected.get('type') as string) || selectedComponentType

  return (
    <div data-testid="button-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>
      {(type === 'button' || type === 'done-button') && (
        <ButtonPropertiesForm editor={editor} component={selected} />
      )}
      {type === 'nav-buttons' && (
        <NavButtonsPropertiesForm editor={editor} component={selected} />
      )}
    </div>
  )
}
