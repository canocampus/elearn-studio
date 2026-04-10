/**
 * Tests for useComponentProperty and useExtendedProperty hooks.
 *
 * These hooks replace the `isLocalRef` pattern across all property panels.
 * React state is derived FROM the GrapesJS model (source of truth) via Backbone
 * change events — no guard flag needed.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useComponentProperty, useExtendedProperty } from '../../hooks/useComponentProperty'

// ── Minimal GrapesJS Component mock ──────────────────────────────────────────

type Handler = () => void

function makeComponent(initialProps: Record<string, unknown> = {}) {
  const props: Record<string, unknown> = { ...initialProps }
  const listeners: Record<string, Set<Handler>> = {}

  return {
    get(key: string): unknown {
      return props[key]
    },
    set(key: string, value: unknown): void {
      props[key] = value
      const event = `change:${key}`
      listeners[event]?.forEach(h => h())
    },
    on(event: string, handler: Handler): void {
      if (!listeners[event]) listeners[event] = new Set()
      listeners[event].add(handler)
    },
    off(event: string, handler: Handler): void {
      listeners[event]?.delete(handler)
    },
    listenerCount(event: string): number {
      return listeners[event]?.size ?? 0
    },
  }
}

// ── useComponentProperty ──────────────────────────────────────────────────────

describe('useComponentProperty', () => {
  it('returns the current model value on mount', () => {
    const comp = makeComponent({ content: 'hello' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )
    expect(result.current[0]).toBe('hello')
  })

  it('uses defaultValue when model key is undefined', () => {
    const comp = makeComponent({})
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', 'default'),
    )
    expect(result.current[0]).toBe('default')
  })

  it('uses defaultValue when model key is null', () => {
    const comp = makeComponent({ content: null })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', 'fallback'),
    )
    expect(result.current[0]).toBe('fallback')
  })

  it('updates React state when model changes externally', () => {
    const comp = makeComponent({ content: 'initial' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )

    act(() => { comp.set('content', 'updated') })

    expect(result.current[0]).toBe('updated')
  })

  it('update() writes to model, which drives React state (no isLocalRef needed)', () => {
    const comp = makeComponent({ content: 'before' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )

    act(() => { result.current[1]('after') })

    expect(comp.get('content')).toBe('after')
    expect(result.current[0]).toBe('after')
  })

  it('cleans up event listener on unmount (no memory leak)', () => {
    const comp = makeComponent({ count: 0 })
    const { unmount } = renderHook(() =>
      useComponentProperty(comp as never, 'count', 0),
    )

    expect(comp.listenerCount('change:count')).toBe(1)
    unmount()
    expect(comp.listenerCount('change:count')).toBe(0)
  })

  it('re-subscribes when component changes', () => {
    const comp1 = makeComponent({ label: 'A' })
    const comp2 = makeComponent({ label: 'B' })

    const { result, rerender } = renderHook(
      ({ comp }) => useComponentProperty(comp as never, 'label', ''),
      { initialProps: { comp: comp1 } },
    )

    expect(result.current[0]).toBe('A')

    rerender({ comp: comp2 })
    expect(result.current[0]).toBe('B')

    // Old component no longer has listener
    expect(comp1.listenerCount('change:label')).toBe(0)
    expect(comp2.listenerCount('change:label')).toBe(1)
  })

  it('handles boolean and number types', () => {
    const comp = makeComponent({ visible: true, opacity: 0.8 })

    const { result: boolResult } = renderHook(() =>
      useComponentProperty(comp as never, 'visible', false),
    )
    const { result: numResult } = renderHook(() =>
      useComponentProperty(comp as never, 'opacity', 1),
    )

    expect(boolResult.current[0]).toBe(true)
    expect(numResult.current[0]).toBe(0.8)

    act(() => {
      boolResult.current[1](false)
      numResult.current[1](0.5)
    })

    expect(boolResult.current[0]).toBe(false)
    expect(numResult.current[0]).toBe(0.5)
  })
})

// ── getLatest() — T639 stale-closure regression tests ────────────────────────

describe('useComponentProperty — getLatest() (T639)', () => {
  it('returns getLatest as the third element of the tuple', () => {
    const comp = makeComponent({ content: 'hello' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )
    expect(typeof result.current[2]).toBe('function')
  })

  it('getLatest() returns the current value on mount', () => {
    const comp = makeComponent({ content: 'initial' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )
    expect(result.current[2]()).toBe('initial')
  })

  it('getLatest() reflects updated value after update() + re-render', () => {
    const comp = makeComponent({ content: 'before' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'content', ''),
    )

    act(() => { result.current[1]('after') })

    expect(result.current[2]()).toBe('after')
  })

  it('getLatest() reflects external model change after re-render', () => {
    const comp = makeComponent({ src: 'old.mp4' })
    const { result } = renderHook(() =>
      useComponentProperty(comp as never, 'src', ''),
    )

    act(() => { comp.set('src', 'new.mp4') })

    expect(result.current[2]()).toBe('new.mp4')
  })

  /**
   * T639 regression test — patch-merge wrapper pattern (simulates useExtendedProperties).
   *
   * Two consecutive updates each modify a DIFFERENT field of extendedProperties.
   * With the stale-closure bug (`{ ...ep, ...patch }` where `ep` is the closure
   * variable), the second update would overwrite the first because it spread over
   * the pre-first-update `ep`.
   *
   * With `getLatest()`, each call reads `latestRef.current` (the value from the
   * most-recent render), so the second update sees the field written by the first.
   */
  it('patch-merge via getLatest(): second update preserves first update\'s field (T639 regression)', () => {
    type EP = { questionText: string; options: string[]; correctIndex: number }
    const defaults: EP = { questionText: '', options: [], correctIndex: 0 }
    const comp = makeComponent({ extendedProperties: { ...defaults } })

    const { result } = renderHook(() => {
      const [ep, setEp, getLatest] = useComponentProperty<EP>(
        comp as never,
        'extendedProperties',
        defaults,
      )
      function update(patch: Partial<EP>) {
        setEp({ ...getLatest(), ...patch })
      }
      return { ep, update, getLatest }
    })

    // First update: set question text
    act(() => { result.current.update({ questionText: 'What is 2+2?' }) })
    // Second update: set options — must NOT clobber questionText
    act(() => { result.current.update({ options: ['3', '4', '5'] }) })

    const final = comp.get('extendedProperties') as EP
    expect(final.questionText).toBe('What is 2+2?') // not clobbered by second update
    expect(final.options).toEqual(['3', '4', '5'])
    expect(final.correctIndex).toBe(0) // unchanged default preserved
  })

  /**
   * T639 regression test — AnimationPropertiesPanel.save() pattern.
   *
   * `save(updatedAnimations)` uses `{ ...getLatestEp(), animations: updated }`.
   * Verifies that other extendedProperties keys (e.g. a hypothetical `label`) are
   * not lost when the animations array is written.
   */
  it('save-pattern via getLatest(): writing animations preserves other EP fields (T639 AnimationPanel regression)', () => {
    type EP = Record<string, unknown>
    const comp = makeComponent({
      extendedProperties: { label: 'intro', animations: [] },
    })

    const { result } = renderHook(() => {
      const [ep, setEp, getLatestEp] = useComponentProperty<EP>(
        comp as never,
        'extendedProperties',
        {},
      )
      function save(animations: unknown[]) {
        setEp({ ...getLatestEp(), animations })
      }
      return { ep, save }
    })

    // Write animations without touching `label`
    act(() => { result.current.save([{ id: 'anim-1', name: 'Fade In' }]) })

    const final = comp.get('extendedProperties') as EP
    expect(final.label).toBe('intro')              // preserved
    expect((final.animations as unknown[]).length).toBe(1)
    expect((final.animations as Array<{ id: string }>)[0].id).toBe('anim-1')
  })

  /**
   * T639 regression test — three consecutive patch-merge updates all survive.
   *
   * Each update targets a different field. All three must be present in the
   * final model state.
   */
  it('three consecutive patch-merge updates via getLatest() all survive', () => {
    type EP = { a: number; b: number; c: number }
    const defaults: EP = { a: 0, b: 0, c: 0 }
    const comp = makeComponent({ extendedProperties: { ...defaults } })

    const { result } = renderHook(() => {
      const [ep, setEp, getLatest] = useComponentProperty<EP>(
        comp as never,
        'extendedProperties',
        defaults,
      )
      const update = (patch: Partial<EP>) => setEp({ ...getLatest(), ...patch })
      return { ep, update }
    })

    act(() => { result.current.update({ a: 1 }) })
    act(() => { result.current.update({ b: 2 }) })
    act(() => { result.current.update({ c: 3 }) })

    const final = comp.get('extendedProperties') as EP
    expect(final).toEqual({ a: 1, b: 2, c: 3 })
  })
})

// ── useExtendedProperty ───────────────────────────────────────────────────────

describe('useExtendedProperty', () => {
  it('reads a sub-key from extendedProperties', () => {
    const comp = makeComponent({ extendedProperties: { color: '#ff0000' } })
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'color', '#000000'),
    )
    expect(result.current[0]).toBe('#ff0000')
  })

  it('uses defaultValue when sub-key is absent', () => {
    const comp = makeComponent({ extendedProperties: {} })
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'color', '#000000'),
    )
    expect(result.current[0]).toBe('#000000')
  })

  it('uses defaultValue when extendedProperties is undefined', () => {
    const comp = makeComponent({})
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'color', '#000000'),
    )
    expect(result.current[0]).toBe('#000000')
  })

  it('update() merges sub-key immutably, preserving other keys', () => {
    const comp = makeComponent({
      extendedProperties: { color: '#ff0000', height: 10 },
    })
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'color', '#000000'),
    )

    act(() => { result.current[1]('#00ff00') })

    const ext = comp.get('extendedProperties') as Record<string, unknown>
    expect(ext.color).toBe('#00ff00')
    expect(ext.height).toBe(10) // unchanged
    expect(result.current[0]).toBe('#00ff00')
  })

  it('update() creates extendedProperties if it did not exist', () => {
    const comp = makeComponent({})
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'showMute', false),
    )

    act(() => { result.current[1](true) })

    const ext = comp.get('extendedProperties') as Record<string, unknown>
    expect(ext.showMute).toBe(true)
    expect(result.current[0]).toBe(true)
  })

  it('reacts to external changes to extendedProperties', () => {
    const comp = makeComponent({ extendedProperties: { volume: 50 } })
    const { result } = renderHook(() =>
      useExtendedProperty(comp as never, 'volume', 100),
    )

    act(() => {
      comp.set('extendedProperties', { volume: 75 })
    })

    expect(result.current[0]).toBe(75)
  })

  it('cleans up change:extendedProperties listener on unmount', () => {
    const comp = makeComponent({ extendedProperties: {} })
    const { unmount } = renderHook(() =>
      useExtendedProperty(comp as never, 'showPercent', false),
    )

    expect(comp.listenerCount('change:extendedProperties')).toBe(1)
    unmount()
    expect(comp.listenerCount('change:extendedProperties')).toBe(0)
  })

  it('multiple useExtendedProperty hooks on the same component each get their own listener', () => {
    const comp = makeComponent({ extendedProperties: { a: 1, b: 2 } })

    const { result: rA } = renderHook(() =>
      useExtendedProperty(comp as never, 'a', 0),
    )
    const { result: rB } = renderHook(() =>
      useExtendedProperty(comp as never, 'b', 0),
    )

    expect(rA.current[0]).toBe(1)
    expect(rB.current[0]).toBe(2)

    // Changing 'a' should not corrupt 'b'
    act(() => { rA.current[1](99) })

    const ext = comp.get('extendedProperties') as Record<string, unknown>
    expect(ext.a).toBe(99)
    expect(ext.b).toBe(2)
    expect(rA.current[0]).toBe(99)
    expect(rB.current[0]).toBe(2)
  })
})
