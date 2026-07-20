/**
 * TD-022 — dual-gate regression tests for the four panels the structural
 * audit (AUDIT.md finding 1) flagged as missing the T648 Backbone
 * double-check.
 *
 * The bug class: sidebar routing runs on Zustand `selectedComponentType`,
 * which can lag the Backbone selection by a render. In that window
 * `editor.getSelected()` already returns the NEXT component — of a
 * different type — and a panel gated only on Zustand mounts its
 * useComponentProperty hooks on (and can edit) the wrong widget.
 *
 * These tests pin BOTH states deliberately misaligned — the state no other
 * test exercises. `PhaserSimPropertiesPanel` is the shipped reference for
 * the correct dual gate.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudioNarrationPropertiesPanel } from '../../components/sidebar/AudioNarrationPropertiesPanel'
import { ButtonPropertiesPanel } from '../../components/sidebar/ButtonPropertiesPanel'
import { QuestionPropertiesPanel } from '../../components/sidebar/QuestionPropertiesPanel'
import { MediaPlayerPropertiesPanel } from '../../components/sidebar/MediaPlayerPropertiesPanel'
import { ProgressBarPropertiesPanel } from '../../components/sidebar/ProgressBarPropertiesPanel'
import { VolumeControlPropertiesPanel } from '../../components/sidebar/VolumeControlPropertiesPanel'
import { useEditorStore } from '../../store/editorStore'

// ── Minimal Backbone-style component mock ────────────────────────────────────

interface ComponentMock {
  get(key: string): unknown
  set: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getId: ReturnType<typeof vi.fn>
}

function makeComponent(type: string): ComponentMock {
  const props: Record<string, unknown> = { type }
  return {
    get: (key: string) => props[key],
    set: vi.fn((key: string, value: unknown) => { props[key] = value }),
    on: vi.fn(),
    off: vi.fn(),
    getId: vi.fn().mockReturnValue(`comp-${type}-1`),
  }
}

function setStore(zustandType: string, backboneComp: ComponentMock): void {
  useEditorStore.setState({
    editor: { getSelected: vi.fn().mockReturnValue(backboneComp) } as never,
    selectedComponentType: zustandType,
  })
}

afterEach(() => {
  vi.clearAllMocks()
  useEditorStore.setState({ editor: null, selectedComponentType: null })
})

// ── Panel matrix ─────────────────────────────────────────────────────────────

const PANELS = [
  {
    name: 'AudioNarrationPropertiesPanel',
    type: 'audio-narration',
    testId: 'audio-narration-properties-panel',
    Panel: AudioNarrationPropertiesPanel,
  },
  {
    name: 'MediaPlayerPropertiesPanel',
    type: 'media-player',
    testId: 'media-player-properties-panel',
    Panel: MediaPlayerPropertiesPanel,
  },
  {
    name: 'ProgressBarPropertiesPanel',
    type: 'progress-bar',
    testId: 'progress-bar-properties-panel',
    Panel: ProgressBarPropertiesPanel,
  },
  {
    name: 'VolumeControlPropertiesPanel',
    type: 'volume-control',
    testId: 'volume-control-properties-panel',
    Panel: VolumeControlPropertiesPanel,
  },
] as const

describe.each(PANELS)('TD-022 dual gate — $name', ({ type, testId, Panel }) => {
  it('renders when Zustand and Backbone agree on the type (control)', () => {
    setStore(type, makeComponent(type))
    render(<Panel />)
    expect(screen.getByTestId(testId)).toBeTruthy()
  })

  it('renders null when Backbone already selected a component of another type', () => {
    // The Zustand→Backbone lag window: routing still says this panel's type,
    // but getSelected() returns the next widget (a button).
    const wrongComp = makeComponent('button')
    setStore(type, wrongComp)
    const { container } = render(<Panel />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId(testId)).toBeNull()
  })

  it('never subscribes hooks on the wrong-type component', () => {
    const wrongComp = makeComponent('button')
    setStore(type, wrongComp)
    render(<Panel />)
    // useComponentProperty subscribes via component.on('change:<key>') —
    // mounting it on the mismatched component IS the TD-022 bug.
    expect(wrongComp.on).not.toHaveBeenCalled()
    expect(wrongComp.set).not.toHaveBeenCalled()
  })
})

// Button/Question already gate every sub-form on the Backbone type, so no
// hooks could mount on a mismatched component — but they rendered an empty
// panel shell in the lag window. TD-022 makes the invariant explicit: null.
const SHELL_PANELS = [
  {
    name: 'ButtonPropertiesPanel',
    zustandType: 'button',
    testId: 'button-properties-panel',
    Panel: ButtonPropertiesPanel,
  },
  {
    name: 'QuestionPropertiesPanel',
    zustandType: 'question-mc',
    testId: 'question-properties-panel',
    Panel: QuestionPropertiesPanel,
  },
] as const

describe.each(SHELL_PANELS)('TD-022 explicit invariant — $name', ({ zustandType, testId, Panel }) => {
  it('renders no empty shell when Backbone selected a component of another type', () => {
    setStore(zustandType, makeComponent('text'))
    const { container } = render(<Panel />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId(testId)).toBeNull()
  })
})
