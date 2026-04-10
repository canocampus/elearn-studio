import { useEffect, useRef, useState } from 'react'
import type { Component } from 'grapesjs'

type GjsComponent = Component & {
  get(key: string): unknown
  set(key: string, value: unknown): void
  on(event: string, handler: () => void): void
  off(event: string, handler: () => void): void
}

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
  component: Component,
  key: string,
  defaultValue: T,
): [T, (value: T) => void, () => T] {
  const comp = component as GjsComponent

  const [value, setValue] = useState<T>(() => {
    const raw = comp.get(key)
    return (raw !== undefined && raw !== null ? raw : defaultValue) as T
  })

  // T620: latestRef tracks the most-recent committed value so that closures
  // (e.g. useExtendedProperty.update) can always read the latest without
  // depending on stale React state from the last render cycle. (T621 fix)
  const latestRef = useRef(value)
  latestRef.current = value

  useEffect(() => {
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
  }, [component, key])

  function update(newValue: T) {
    // T620: apply optimistic React state update immediately so controlled inputs
    // (value={state} + onChange) never freeze waiting for the Backbone event.
    setValue(newValue)
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
 * @returns [value, update] — current sub-key value and setter
 */
export function useExtendedProperty<T>(
  component: Component,
  subKey: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const comp = component as GjsComponent

  function readValue(): T {
    const ext = comp.get('extendedProperties')
    if (ext !== null && ext !== undefined && typeof ext === 'object' && subKey in (ext as object)) {
      return (ext as Record<string, unknown>)[subKey] as T
    }
    return defaultValue
  }

  const [value, setValue] = useState<T>(readValue)

  useEffect(() => {
    setValue(readValue())

    function onChange() {
      setValue(readValue())
    }

    comp.on('change:extendedProperties', onChange)
    return () => {
      comp.off('change:extendedProperties', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component, subKey])

  function update(newValue: T) {
    const current = (comp.get('extendedProperties') as Record<string, unknown> | undefined) ?? {}
    comp.set('extendedProperties', { ...current, [subKey]: newValue })
  }

  return [value, update]
}
