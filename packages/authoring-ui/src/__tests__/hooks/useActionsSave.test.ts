/**
 * useActionsSave — load-echo suppression (TD-015)
 *
 * Regression context: `actionsStore.setWidget()` fires on every widget
 * SELECTION to load the persisted sequences into the panel. The hook's
 * subscription used to treat that load event like an edit — it reset its
 * comparison ref to `null`, saw "sequences changed", and re-saved whatever
 * setWidget had just loaded. Combined with the selection-boundary id bug
 * (see EditorCanvas.selection.test.tsx) the loaded value was `[]`, so mere
 * selection PERSISTED an empty array — wiping the widget's saved actions.
 *
 * Contract pinned here:
 *   1. Loading a widget's sequences (setWidget) must NEVER trigger a save.
 *   2. A real edit after the load (addSequence, …) must still save.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Editor } from 'grapesjs'
import { unsafeCast, unsafeCoerce } from '@elearn-studio/shared-types'
import { useActionsStore } from '../../store/actionsStore'
import { useEditorStore } from '../../store/editorStore'
import { useActionsSave } from '../../hooks/useActionsSave'
import type { CourseDoc, Slide } from '../../types/course'
import type { ActionSequence } from '../../types/actions'

vi.mock('../../api/courseApi', () => ({
  updateCourse: vi.fn().mockResolvedValue({}),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WIDGET_ID = 'persisted-1'

const SAVED_SEQUENCES: ActionSequence[] = [
  unsafeCast<ActionSequence>(
    { event: 'click', actions: [unsafeCast({ id: 'a1', type: 'navigate', params: { mode: 'next' } }, 'TD-015 nav stub')] },
    'TD-015 sequence stub',
  ),
]

function seedStores() {
  const componentSet = vi.fn()
  const fakeComponent = { set: componentSet, getAttributes: () => ({ id: WIDGET_ID }) }
  const requestSave = vi.fn().mockResolvedValue(undefined)

  const slide = unsafeCast<Slide>(
    {
      id: 's1',
      title: 'Slide 1',
      widgets: [unsafeCast({ id: WIDGET_ID, type: 'button', actions: SAVED_SEQUENCES }, 'TD-015 widget stub')],
    },
    'TD-015 slide stub',
  )

  useEditorStore.setState({
    course: unsafeCast<CourseDoc>({ _id: 'c1', title: 'Course', slides: [slide] }, 'TD-015 course stub'),
    currentSlideIndex: 0,
    editor: unsafeCoerce<Editor>(
      {
        Components: { getById: vi.fn().mockReturnValue(fakeComponent) },
        getComponents: () => ({ toArray: () => [fakeComponent] }),
      },
      'minimal editor double — the hook only touches Components.getById / getComponents().toArray()',
    ),
    requestSave,
  })

  return { componentSet, requestSave }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useActionsSave — load-echo suppression (TD-015)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useActionsStore.setState({ widgetId: null, sequences: [], selectedEvent: null })
  })

  afterEach(() => {
    useActionsStore.setState({ widgetId: null, sequences: [], selectedEvent: null })
    useEditorStore.setState({ course: null, editor: null, requestSave: null })
  })

  it('TD-015 regression: setWidget (loading persisted sequences on selection) does NOT trigger a save', () => {
    const { componentSet, requestSave } = seedStores()
    renderHook(() => useActionsSave())

    // Selection loads the persisted sequences into the panel.
    useActionsStore.getState().setWidget(WIDGET_ID, SAVED_SEQUENCES)

    expect(requestSave).not.toHaveBeenCalled()
    expect(componentSet).not.toHaveBeenCalled()
  })

  it('TD-015 regression: setWidget with [] (missed lookup / fresh widget) does NOT persist the empty array', () => {
    const { componentSet, requestSave } = seedStores()
    renderHook(() => useActionsSave())

    // The pre-fix wipe vector: a missed course-doc lookup seeded [] and the
    // hook persisted it. Loading [] must be as save-inert as loading content.
    useActionsStore.getState().setWidget(WIDGET_ID, [])

    expect(requestSave).not.toHaveBeenCalled()
    expect(componentSet).not.toHaveBeenCalled()
  })

  it('a real edit after the load still saves (no over-suppression)', () => {
    const { componentSet, requestSave } = seedStores()
    renderHook(() => useActionsSave())

    useActionsStore.getState().setWidget(WIDGET_ID, SAVED_SEQUENCES)
    // Real author edit — a new event sequence.
    useActionsStore.getState().addSequence('enterSlide')

    expect(requestSave).toHaveBeenCalled()
    expect(componentSet).toHaveBeenCalledWith(
      'elearnActions',
      expect.arrayContaining([expect.objectContaining({ event: 'enterSlide' })]),
    )
  })
})
