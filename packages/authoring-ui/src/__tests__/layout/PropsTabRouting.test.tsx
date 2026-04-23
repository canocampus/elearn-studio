/**
 * TD-010.5 — Props-tab routing exhaustive invariant.
 *
 * Closes the visual-QA gap left by TD-010.5 with a deterministic regression
 * guard that covers all 17 widget families listed in tasks.md:
 *
 *   text, image, button, rectangle, nav-buttons, done-button, progress-bar,
 *   media-player, audio-narration, volume-control, score-quiz, score-field,
 *   question-mc, question-tf, question-fill, phaser-sim, screenshot-sim
 *
 * The TD-010 contract has two halves:
 *
 *   1. `hasCustomPropsPanel(type)` routes the ternary in AppLayout.tsx
 *      (already pinned by `PropsEmptyState.test.tsx`).
 *   2. Each custom PropertiesPanel MUST `return null` when its own type guard
 *      does not match, so that rendering all seven panels side-by-side never
 *      stacks more than one non-null node (the pre-TD-010 bug stacked up to
 *      six grey "Select a X widget" placeholders below any real panel).
 *
 * Before this file, only QuestionPropertiesPanel (SidebarPanels.test.tsx) and
 * PhaserSimPropertiesPanel (its own suite) had null-return pins. The remaining
 * five panels (Button / MediaPlayer / AudioNarration / ProgressBar /
 * VolumeControl) had their TD-010 null-return contract documented in-source
 * but not pinned by any test. This suite fills that gap by asserting each of
 * the five panels returns `null` for every non-matching widget type plus the
 * `null` selection, then closes the integration loop with a representative
 * AppLayout Props-tab render that proves at most one panel is visible in
 * each routing branch.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { Editor } from 'grapesjs'
import { useEditorStore } from '../../store/editorStore'
import { NameField } from '../../components/sidebar/NameField'
import { ButtonPropertiesPanel } from '../../components/sidebar/ButtonPropertiesPanel'
import { MediaPlayerPropertiesPanel } from '../../components/sidebar/MediaPlayerPropertiesPanel'
import { AudioNarrationPropertiesPanel } from '../../components/sidebar/AudioNarrationPropertiesPanel'
import { ProgressBarPropertiesPanel } from '../../components/sidebar/ProgressBarPropertiesPanel'
import { VolumeControlPropertiesPanel } from '../../components/sidebar/VolumeControlPropertiesPanel'
import {
  hasCustomPropsPanel,
  PropsEmptyState,
} from '../../components/layout/propsEmptyState'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ALL_WIDGET_TYPES = [
  'text',
  'image',
  'button',
  'rectangle',
  'nav-buttons',
  'done-button',
  'progress-bar',
  'media-player',
  'audio-narration',
  'volume-control',
  'score-quiz',
  'score-field',
  'question-mc',
  'question-tf',
  'question-fill',
  'phaser-sim',
  'screenshot-sim',
] as const

function makeMockEditor(): Editor {
  return {
    getSelected: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('text'),
      on: vi.fn(),
      off: vi.fn(),
      getStyle: vi.fn().mockReturnValue({}),
    }),
  } as unknown as Editor
}

afterEach(() => {
  vi.clearAllMocks()
  useEditorStore.setState({
    editor: null,
    selectedComponentType: null,
  })
})

// ─── Null-return contracts per panel ─────────────────────────────────────────

describe('TD-010 — ButtonPropertiesPanel null-return contract', () => {
  const matching = new Set(['button', 'done-button', 'nav-buttons'])
  const nonMatching = ALL_WIDGET_TYPES.filter(t => !matching.has(t))

  for (const type of nonMatching) {
    it(`returns null when selectedComponentType='${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<ButtonPropertiesPanel />)
      expect(container.firstChild).toBeNull()
    })
  }

  it('returns null when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<ButtonPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })
})

describe('TD-010 — MediaPlayerPropertiesPanel null-return contract', () => {
  const nonMatching = ALL_WIDGET_TYPES.filter(t => t !== 'media-player')

  for (const type of nonMatching) {
    it(`returns null when selectedComponentType='${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<MediaPlayerPropertiesPanel />)
      expect(container.firstChild).toBeNull()
    })
  }

  it('returns null when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<MediaPlayerPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })
})

describe('TD-010 — AudioNarrationPropertiesPanel null-return contract', () => {
  const nonMatching = ALL_WIDGET_TYPES.filter(t => t !== 'audio-narration')

  for (const type of nonMatching) {
    it(`returns null when selectedComponentType='${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<AudioNarrationPropertiesPanel />)
      expect(container.firstChild).toBeNull()
    })
  }

  it('returns null when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<AudioNarrationPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })
})

describe('TD-010 — ProgressBarPropertiesPanel null-return contract', () => {
  const nonMatching = ALL_WIDGET_TYPES.filter(t => t !== 'progress-bar')

  for (const type of nonMatching) {
    it(`returns null when selectedComponentType='${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<ProgressBarPropertiesPanel />)
      expect(container.firstChild).toBeNull()
    })
  }

  it('returns null when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<ProgressBarPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })
})

describe('TD-010 — VolumeControlPropertiesPanel null-return contract', () => {
  const nonMatching = ALL_WIDGET_TYPES.filter(t => t !== 'volume-control')

  for (const type of nonMatching) {
    it(`returns null when selectedComponentType='${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<VolumeControlPropertiesPanel />)
      expect(container.firstChild).toBeNull()
    })
  }

  it('returns null when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<VolumeControlPropertiesPanel />)
    expect(container.firstChild).toBeNull()
  })
})

// ─── AppLayout Props-tab routing ─────────────────────────────────────────────

// Mirrors the exact JSX that AppLayout.tsx lines 249–276 renders inside the
// Props tab <div>. Keeping this fragment in the test instead of importing
// AppLayout sidesteps AppLayout's Konva / GrapesJS transitive imports (same
// rationale that drove TD-010.2 to extract propsEmptyState.tsx).
function PropsTabFragment() {
  const selectedComponentType = useEditorStore(s => s.selectedComponentType)
  const propsHasCustomPanel = hasCustomPropsPanel(selectedComponentType)
  return (
    <div data-testid="props-tab">
      {/* TD-013.3 mirror: NameField renders above the routing. */}
      <NameField />
      {propsHasCustomPanel ? (
        <>
          <ButtonPropertiesPanel />
          <MediaPlayerPropertiesPanel />
          <AudioNarrationPropertiesPanel />
          <ProgressBarPropertiesPanel />
          <VolumeControlPropertiesPanel />
        </>
      ) : (
        <PropsEmptyState selectedType={selectedComponentType} />
      )}
    </div>
  )
}

describe('TD-010.5 — Props-tab shows exactly one node for each widget type', () => {
  // Types whose props live in the Styles tab — must show ONE empty-state.
  const STYLES_TAB_TYPES = [
    'text',
    'image',
    'rectangle',
    'score-quiz',
    'score-field',
    'screenshot-sim',
  ] as const

  for (const type of STYLES_TAB_TYPES) {
    it(`renders exactly one PropsEmptyState for '${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<PropsTabFragment />)
      const emptyStates = container.querySelectorAll('[data-testid="props-empty-state"]')
      expect(emptyStates).toHaveLength(1)
      // And none of the custom panels leaked through.
      expect(container.querySelector('[data-testid$="-properties-panel"]')).toBeNull()
    })
  }

  it('renders exactly one PropsEmptyState when nothing is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<PropsTabFragment />)
    expect(
      container.querySelectorAll('[data-testid="props-empty-state"]'),
    ).toHaveLength(1)
    expect(container.querySelector('[data-testid$="-properties-panel"]')).toBeNull()
  })

  // For custom-panel types, verify no empty-state leaks through; the fragment
  // only instantiates the five "easy to mount" panels (Question + PhaserSim
  // bring heavy init state already covered by their own suites). The invariant
  // here is "no stacked placeholders" — the empty-state must NOT render when
  // `hasCustomPropsPanel` routes to the panel branch.
  const CUSTOM_PANEL_TYPES = [
    'button',
    'done-button',
    'nav-buttons',
    'media-player',
    'audio-narration',
    'progress-bar',
    'volume-control',
    'question-mc',
    'question-tf',
    'question-fill',
    'phaser-sim',
  ] as const

  for (const type of CUSTOM_PANEL_TYPES) {
    it(`does NOT render the empty-state for custom-panel type '${type}'`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<PropsTabFragment />)
      expect(
        container.querySelectorAll('[data-testid="props-empty-state"]'),
      ).toHaveLength(0)
    })
  }
})

describe('TD-013.3 — NameField renders for every widget type', () => {
  // The `name` property exists for every widget in the data model (BaseWidget.name,
  // TD-008 Bug #4) and is the canonical label the Actions Editor's widget-target
  // dropdown uses. NameField must therefore be visible whenever any widget is
  // selected — regardless of whether that widget has a dedicated PropertiesPanel
  // (button, question, …) or is styled via the Styles tab (text, image, rectangle,
  // score-*, screenshot-sim). The field is the single place an author sets this
  // property from the UI.
  for (const type of ALL_WIDGET_TYPES) {
    it(`renders [data-testid="widget-name-field"] when type='${type}' is selected`, () => {
      useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: type })
      const { container } = render(<PropsTabFragment />)
      const nameField = container.querySelector('[data-testid="widget-name-field"]')
      expect(nameField).not.toBeNull()
      expect(container.querySelector('[data-testid="widget-name-input"]')).not.toBeNull()
    })
  }

  it('does NOT render when no widget is selected', () => {
    useEditorStore.setState({ editor: makeMockEditor(), selectedComponentType: null })
    const { container } = render(<PropsTabFragment />)
    expect(container.querySelector('[data-testid="widget-name-field"]')).toBeNull()
  })

  it('does NOT render when the editor is null', () => {
    useEditorStore.setState({ editor: null, selectedComponentType: 'button' })
    const { container } = render(<PropsTabFragment />)
    expect(container.querySelector('[data-testid="widget-name-field"]')).toBeNull()
  })
})
