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

import { useState, useEffect, useRef } from 'react'
import type { Component, Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'

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
// useCaption — bidirectional sync for component 'content' attribute
// ---------------------------------------------------------------------------

function getContent(component: Component): string {
  const raw = component.get('content')
  return typeof raw === 'string' ? raw : ''
}

function useCaption(component: Component): [string, (value: string) => void] {
  const [caption, setCaption] = useState<string>(() => getContent(component))
  const isLocalRef = useRef(false)

  useEffect(() => {
    setCaption(getContent(component))
    function onContentChange() {
      if (isLocalRef.current) { isLocalRef.current = false; return }
      setCaption(getContent(component))
    }
    component.on('change:content', onContentChange)
    return () => { component.off('change:content', onContentChange) }
  }, [component])

  function updateCaption(value: string) {
    isLocalRef.current = true  // Arm before component.set() — GrapesJS fires synchronously
    setCaption(value)
    component.set('content', value)
  }

  return [caption, updateCaption]
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

function BackgroundImageSection({ editor, component }: { editor: Editor; component: Component }) {
  const currentBg = (component.getStyle()['background-image'] as string | undefined) ?? ''

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
  const [caption, updateCaption] = useCaption(component)

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
//
// isLocalRef pattern applied per-child: arm BEFORE child.set() because
// GrapesJS Backbone.Events fires change:content synchronously.
// Also registers listeners so undo/redo syncs back to the form.
// ---------------------------------------------------------------------------

const NAV_BUTTON_DEFAULTS = {
  prevLabel: '← Previous',
  nextLabel: 'Next →',
} as const

function getNavChildContent(component: Component): { prevLabel: string; nextLabel: string } {
  const children = component.components()
  const raw0 = children.at(0)?.get('content')
  const raw1 = children.at(1)?.get('content')
  return {
    prevLabel: typeof raw0 === 'string' ? raw0 : NAV_BUTTON_DEFAULTS.prevLabel,
    nextLabel: typeof raw1 === 'string' ? raw1 : NAV_BUTTON_DEFAULTS.nextLabel,
  }
}

function NavButtonsPropertiesForm({ editor, component }: { editor: Editor; component: Component }) {
  const prevChild = component.components().at(0)
  const nextChild = component.components().at(1)

  const [prevLabel, setPrevLabel] = useState<string>(
    () => getNavChildContent(component).prevLabel,
  )
  const [nextLabel, setNextLabel] = useState<string>(
    () => getNavChildContent(component).nextLabel,
  )
  const isPrevLocalRef = useRef(false)
  const isNextLocalRef = useRef(false)

  useEffect(() => {
    const labels = getNavChildContent(component)
    setPrevLabel(labels.prevLabel)
    setNextLabel(labels.nextLabel)

    const prev = component.components().at(0)
    const next = component.components().at(1)

    function onPrevChange() {
      if (isPrevLocalRef.current) { isPrevLocalRef.current = false; return }
      const raw = component.components().at(0)?.get('content')
      setPrevLabel(typeof raw === 'string' ? raw : NAV_BUTTON_DEFAULTS.prevLabel)
    }
    function onNextChange() {
      if (isNextLocalRef.current) { isNextLocalRef.current = false; return }
      const raw = component.components().at(1)?.get('content')
      setNextLabel(typeof raw === 'string' ? raw : NAV_BUTTON_DEFAULTS.nextLabel)
    }

    prev?.on('change:content', onPrevChange)
    next?.on('change:content', onNextChange)
    return () => {
      prev?.off('change:content', onPrevChange)
      next?.off('change:content', onNextChange)
    }
  }, [component])

  function updatePrevLabel(value: string) {
    if (!prevChild) return
    isPrevLocalRef.current = true  // Arm before component.set() — GrapesJS fires synchronously
    setPrevLabel(value)
    prevChild.set('content', value)
  }

  function updateNextLabel(value: string) {
    if (!nextChild) return
    isNextLocalRef.current = true  // Arm before component.set() — GrapesJS fires synchronously
    setNextLabel(value)
    nextChild.set('content', value)
  }

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
        <label style={LABEL_STYLE}>Previous Button</label>
        <input
          type="text"
          value={prevLabel}
          onChange={e => updatePrevLabel(e.target.value)}
          style={{ ...FIELD_STYLE, marginBottom: 8 }}
          placeholder={NAV_BUTTON_DEFAULTS.prevLabel}
        />
        <label style={LABEL_STYLE}>Next Button</label>
        <input
          type="text"
          value={nextLabel}
          onChange={e => updateNextLabel(e.target.value)}
          style={FIELD_STYLE}
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
