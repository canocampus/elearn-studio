/**
 * EditorCanvas — component:selected widget-id resolution (TD-015)
 *
 * Regression: selecting a widget after a slide reload wiped its persisted
 * action sequences. The handler resolved the widget id via
 * `component.getId()` (the GrapesJS MODEL id, regenerated on every slide
 * reload) while the course document keys widgets by the id preserved in the
 * HTML `attributes.id` (converters.ts `widgetsFromGrapesjs`:
 * `attributes.id || c.getId()`). The missed lookup seeded the actions panel
 * with `[]`, which useActionsSave then persisted — erasing the widget's
 * saved actions on mere selection.
 *
 * These tests pin the id-resolution contract at the selection boundary:
 * attribute id wins when present; model id is the fallback for fresh,
 * never-persisted widgets.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { unsafeCast } from '@elearn-studio/shared-types'
import { useEditorStore } from '../store/editorStore'
import type { CourseDoc, Slide } from '../types/course'
import type { ActionSequence } from '../types/actions'

// ---------------------------------------------------------------------------
// Hoisted mock factories — must be declared before vi.mock() calls
// ---------------------------------------------------------------------------

const { mockInitEditor, mockSetEditorLoading, mockSetWidget, mockClearWidget } = vi.hoisted(() => ({
  mockInitEditor: vi.fn(),
  mockSetEditorLoading: vi.fn(),
  mockSetWidget: vi.fn(),
  mockClearWidget: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../editor/initEditor', () => ({
  initEditor: mockInitEditor,
  setEditorLoading: mockSetEditorLoading,
  getEditorLoading: vi.fn().mockReturnValue(false),
}))

vi.mock('../store/actionsStore', () => ({
  useActionsStore: {
    getState: () => ({ setWidget: mockSetWidget, clearWidget: mockClearWidget }),
  },
}))

// Sidebar type-guard mocks — none of our test components are special widget types
vi.mock('../components/sidebar/ButtonPropertiesPanel', () => ({ isButtonWidgetType: () => false }))
vi.mock('../components/sidebar/MediaPlayerPropertiesPanel', () => ({ isMediaPlayerWidgetType: () => false }))
vi.mock('../components/sidebar/AudioNarrationPropertiesPanel', () => ({ isAudioNarrationWidgetType: () => false }))
vi.mock('../components/sidebar/ProgressBarPropertiesPanel', () => ({ isProgressBarWidgetType: () => false }))
vi.mock('../components/sidebar/VolumeControlPropertiesPanel', () => ({ isVolumeControlWidgetType: () => false }))
vi.mock('../types/questions', () => ({ isQuestionWidgetType: () => false }))
vi.mock('../types/phaserSim', () => ({ isPhaserSimWidgetType: () => false }))

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { EditorCanvas } from '../components/editor/EditorCanvas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NAV_SEQUENCE: ActionSequence[] = [
  unsafeCast<ActionSequence>(
    { event: 'click', actions: [unsafeCast({ id: 'a1', type: 'navigate', params: { mode: 'next' } }, 'TD-015 nav action stub')] },
    'TD-015 sequence stub',
  ),
]

function makeMockEditor() {
  return {
    store: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    on: vi.fn(),
    Commands: { isActive: vi.fn().mockReturnValue(false) },
  }
}

function seedCourseWithPersistedWidget(): void {
  const slide = unsafeCast<Slide>(
    {
      id: 's1',
      title: 'Slide 1',
      widgets: [
        unsafeCast(
          { id: 'persisted-1', type: 'button', actions: NAV_SEQUENCE },
          'TD-015 widget stub — only id/type/actions are read by the selection handler',
        ),
      ],
    },
    'TD-015 slide stub',
  )
  useEditorStore.setState({
    course: unsafeCast<CourseDoc>({ _id: 'c1', title: 'Course', slides: [slide] }, 'TD-015 course stub'),
    currentSlideIndex: 0,
  })
}

/** Render EditorCanvas with a mock editor and return the captured component:selected handler. */
async function renderAndCaptureSelectionHandler(): Promise<(component: unknown) => void> {
  const mockEditor = makeMockEditor()
  mockInitEditor.mockImplementation(({ onReady }: { onReady: (ed: unknown) => void }) => {
    onReady(mockEditor)
    return {
      editor: mockEditor,
      cleanup: vi.fn(),
      hasPendingChanges: () => false,
      requestSave: vi.fn().mockResolvedValue(undefined),
    }
  })

  render(<EditorCanvas courseId="c1" slideId="s1" />)
  await waitFor(() => expect(mockEditor.load).toHaveBeenCalledOnce())

  const call = mockEditor.on.mock.calls.find((c) => c[0] === 'component:selected')
  expect(call).toBeDefined()
  return call![1] as (component: unknown) => void
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorCanvas — component:selected widget-id resolution (TD-015)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.setState({
      course: null,
      currentSlideIndex: 0,
      editor: null,
      requestSave: null,
      isSaving: false,
      saveError: null,
    })
  })

  it('TD-015 regression: resolves the PERSISTED id via attributes.id and loads the saved sequences (never [])', async () => {
    seedCourseWithPersistedWidget()
    const onSelected = await renderAndCaptureSelectionHandler()

    // Post-reload shape: GrapesJS regenerated the model id ('model-9') but the
    // persisted identity survives in attributes.id ('persisted-1').
    onSelected({
      get: (key: string) => (key === 'type' ? 'button' : undefined),
      getId: () => 'model-9',
      getAttributes: () => ({ id: 'persisted-1' }),
    })

    expect(mockSetWidget).toHaveBeenCalledTimes(1)
    expect(mockSetWidget).toHaveBeenCalledWith('persisted-1', NAV_SEQUENCE)
  })

  it('falls back to the model id for fresh, never-persisted widgets (no attributes.id)', async () => {
    seedCourseWithPersistedWidget()
    const onSelected = await renderAndCaptureSelectionHandler()

    onSelected({
      get: (key: string) => (key === 'type' ? 'button' : undefined),
      getId: () => 'model-7',
      getAttributes: () => ({}),
    })

    // Fresh widget: not in the course doc yet — empty sequences are correct.
    expect(mockSetWidget).toHaveBeenCalledTimes(1)
    expect(mockSetWidget).toHaveBeenCalledWith('model-7', [])
  })
})
