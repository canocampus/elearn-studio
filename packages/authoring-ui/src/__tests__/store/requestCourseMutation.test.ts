/**
 * TD-007 — editorStore.requestCourseMutation integration tests.
 *
 * `requestCourseMutation` is a plain Zustand store action (always available,
 * no editor dependency). It wires `performCourseMutation` into the store's
 * setIsSaving / setSaveError / bumpCacheVersion actions.
 *
 * These tests exercise the live store against mock API callables.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useEditorStore } from '../../store/editorStore'

describe('editorStore.requestCourseMutation — TD-007 wiring', () => {
  beforeEach(() => {
    useEditorStore.setState({
      isSaving: false,
      saveError: null,
      cacheVersion: 0,
    })
  })

  it('success path → setIsSaving(true) then (bumpCacheVersion + setIsSaving(false)); setSaveError(null)', async () => {
    const seen: Array<{ isSaving: boolean; saveError: string | null; cacheVersion: number }> = []
    const unsub = useEditorStore.subscribe((s) => {
      seen.push({ isSaving: s.isSaving, saveError: s.saveError, cacheVersion: s.cacheVersion })
    })

    const result = await useEditorStore.getState().requestCourseMutation(
      async () => ({ _id: 'c1', slides: [] }),
    )

    unsub()

    expect(result).toEqual({ _id: 'c1', slides: [] })
    expect(useEditorStore.getState().isSaving).toBe(false)
    expect(useEditorStore.getState().saveError).toBeNull()
    expect(useEditorStore.getState().cacheVersion).toBe(1)
    // Somewhere in the subscription trail, isSaving should have been true
    expect(seen.some(s => s.isSaving)).toBe(true)
  })

  it('{ bumpCache: false } → success but cache NOT bumped', async () => {
    const cacheBefore = useEditorStore.getState().cacheVersion

    await useEditorStore.getState().requestCourseMutation(
      async () => ({ ok: true }),
      { bumpCache: false },
    )

    expect(useEditorStore.getState().cacheVersion).toBe(cacheBefore)
    expect(useEditorStore.getState().isSaving).toBe(false)
  })

  it('error path → setSaveError(msg) + setIsSaving(false); cacheVersion unchanged; returns undefined', async () => {
    const cacheBefore = useEditorStore.getState().cacheVersion

    const result = await useEditorStore.getState().requestCourseMutation(async () => {
      throw new Error('backend 500')
    })

    expect(result).toBeUndefined()
    expect(useEditorStore.getState().saveError).toBe('backend 500')
    expect(useEditorStore.getState().isSaving).toBe(false)
    expect(useEditorStore.getState().cacheVersion).toBe(cacheBefore)
  })

  it('is always available immediately (no null window)', () => {
    // Regression guard: the original TD-007 design had a null window between
    // app mount and EditorCanvas Effect 1 registering the closure. That caused
    // silent no-ops in TopToolbar / SlideList click handlers. The store action
    // fixes this by being plain state, not a lifecycle-bound closure.
    const rcm = useEditorStore.getState().requestCourseMutation
    expect(typeof rcm).toBe('function')
  })

  it('non-Error throws are narrowed via String(err)', async () => {
    await useEditorStore.getState().requestCourseMutation(async () => {
      throw 'plain-string'
    })

    expect(useEditorStore.getState().saveError).toBe('plain-string')
  })
})

afterEach(() => {
  useEditorStore.setState({
    isSaving: false,
    saveError: null,
    cacheVersion: 0,
  })
})
