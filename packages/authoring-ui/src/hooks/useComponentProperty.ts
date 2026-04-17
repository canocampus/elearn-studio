import { useEffect, useRef, useState } from 'react'
import type { Component } from 'grapesjs'

export type GjsComponent = Component & {
  get(key: string): unknown
  set(key: string, value: unknown): void
  on(event: string, handler: () => void): void
  off(event: string, handler: () => void): void
}

/**
 * Labeled tuple returned by useComponentProperty and useExtendedProperty.
 *
 *  value      — current React state derived from the GrapesJS model
 *  update     — writes a new value to the model (state updates via Backbone event)
 *  getLatest  — stable ref-backed getter; always returns the most-recent committed
 *               value without relying on a potentially stale closure (T639.1)
 */
type UsePropertyReturn<T> = [
  value: T,
  update: (value: T) => void,
  getLatest: () => T,
]

/**
 * Subscribes to a GrapesJS component property and returns derived React state.
 *
 * React state is derived FROM the GrapesJS model (source of truth) via change event
 * handlers. No `isLocalRef` guard is needed: React 18 batches all `setState` calls,
 * including those triggered from Backbone event callbacks.
 *
 * @param component - GrapesJS component instance
 * @param key - Model key to subscribe to (e.g. `'content'`, `'src'`, `'extendedProperties'`)
 * @param defaultValue - Value used when the model property is null/undefined
 * @returns [value, update, getLatest] — current value, setter that writes to model only,
 *   and a stable `getLatest()` function that always returns the most-recent committed value
 *   without relying on a potentially stale closure variable.
 */
export function useComponentProperty<T>(
  component: Component | null,
  key: string,
  defaultValue: T,
): UsePropertyReturn<T> {
  const [value, setValue] = useState<T>(() => {
    if (!component) return defaultValue
    const comp = component as GjsComponent
    const raw = comp.get(key)
    return (raw !== undefined && raw !== null ? raw : defaultValue) as T
  })

  // T639.1: latestRef tracks the most-recent committed value so that closures
  // (e.g. useExtendedProperties.update in QuestionPropertiesPanel) can always
  // read the latest without depending on stale React state from the last render
  // cycle. Prevents patch-merge bugs where rapid updates clobber each other.
  const latestRef = useRef(value)
  latestRef.current = value

  useEffect(() => {
    if (!component) return
    const comp = component as GjsComponent

    const raw = comp.get(key)
    setValue((raw !== undefined && raw !== null ? raw : defaultValue) as T)

    function onChange() {
      const updated = comp.get(key)
      const val = (updated !== undefined && updated !== null ? updated : defaultValue) as T
      setValue(val)
    }

    comp.on(`change:${key}`, onChange)
    return () => {
      comp.off(`change:${key}`, onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Only re-subscribe when the component instance or watched key changes.
    // defaultValue is intentionally excluded: it never changes for a given panel,
    // and including it would cause redundant re-subscriptions on every render.
  }, [component, key])

  function update(newValue: T) {
    if (!component) return
    const comp = component as GjsComponent
    // T639.1: apply optimistic React state update immediately so controlled inputs
    // (value={state} + onChange) never freeze waiting for the Backbone event.
    // T649: update ref synchronously so getLatest() returns the new value for
    // consecutive calls within the same render cycle (no stale-closure between batched updates).
    setValue(newValue)
    latestRef.current = newValue
    comp.set(key, newValue)
  }

  return [value, update, () => latestRef.current]
}

/**
 * Subscribes to a sub-key of `extendedProperties` on a GrapesJS component.
 *
 * Reads and writes a single sub-key while keeping the rest of `extendedProperties`
 * intact via an immutable merge. Subscribes to `change:extendedProperties` so
 * the React state updates automatically on any undo/redo or external change.
 *
 * @param component - GrapesJS component instance
 * @param subKey - Key within `extendedProperties` to read/write
 * @param defaultValue - Value used when the sub-key is absent
 * @returns [value, update, getLatest] — current sub-key value, setter, and a stable
 *   ref-backed getter that always returns the most-recent committed value (T639.1 parity
 *   with useComponentProperty — prevents stale-closure bugs in callers that read the
 *   latest sub-key value inside event callbacks or rapid consecutive updates).
 */
export function useExtendedProperty<T>(
  component: Component | null,
  subKey: string,
  defaultValue: T,
): UsePropertyReturn<T> {
  function readValue(): T {
    if (!component) return defaultValue
    const comp = component as GjsComponent
    const ext = comp.get('extendedProperties')
    if (ext !== null && ext !== undefined && typeof ext === 'object' && subKey in (ext as object)) {
      return (ext as Record<string, unknown>)[subKey] as T
    }
    return defaultValue
  }

  const [value, setValue] = useState<T>(readValue)

  // T639.1 parity: latestRef tracks the most-recent committed sub-key value so that
  // any caller callback can read the latest without stale-closure risk.
  const latestRef = useRef(value)
  latestRef.current = value

  useEffect(() => {
    if (!component) return
    const comp = component as GjsComponent

    setValue(readValue())

    function onChange() {
      setValue(readValue())
    }

    comp.on('change:extendedProperties', onChange)
    return () => {
      comp.off('change:extendedProperties', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Only re-subscribe when the component instance or sub-key changes.
    // readValue and defaultValue are stable for the lifetime of a given panel.
  }, [component, subKey])

  function update(newValue: T) {
    if (!component) return
    const comp = component as GjsComponent
    // T649: update ref synchronously so getLatest() returns the new value for
    // consecutive calls within the same render cycle.
    setValue(newValue)
    latestRef.current = newValue
    const current = (comp.get('extendedProperties') as Record<string, unknown> | undefined) ?? {}
    comp.set('extendedProperties', { ...current, [subKey]: newValue })
  }

  return [value, update, () => latestRef.current]
}
