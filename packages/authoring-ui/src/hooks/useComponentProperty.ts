import { useEffect, useRef, useState } from 'react'
import type { Component } from 'grapesjs'
import type { ELearnComponent } from '../types/ELearnComponent'

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
  // TD-004: narrow to ELearnComponent once so the rest of the hook reads/writes
  // arbitrary string keys without scattered `as GjsComponent` casts. ELearnComponent
  // extends Component, so this is a safe widening of the available method surface,
  // not a structural change.
  const comp = component as ELearnComponent | null

  const [value, setValue] = useState<T>(() => {
    if (!comp) return defaultValue
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
    // TD-004 micro-polish: narrow inside the effect so `comp` is not a closure
    // dependency. Identity-equivalent to `component` at runtime (type-only cast).
    const comp = component as ELearnComponent

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
    // Intentionally excluded: `defaultValue` is a fallback-only constant for the
    // panel lifetime. Adding it to deps would re-subscribe the Backbone listener
    // on every render of the panel (keystroke-level churn with zero benefit),
    // since the change handler reads the live value via comp.get(key) — never
    // a captured closure of defaultValue.
  }, [component, key])

  function update(newValue: T) {
    if (!comp) return
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
  // TD-004: single narrowing point for the whole function — mirrors useComponentProperty.
  const comp = component as ELearnComponent | null

  function readValue(): T {
    if (!comp) return defaultValue
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
    // TD-004 micro-polish: narrow inside the effect so `comp` is not a closure
    // dependency. Identity-equivalent to `component` at runtime (type-only cast).
    const effComp = component as ELearnComponent

    setValue(readValue())

    function onChange() {
      setValue(readValue())
    }

    effComp.on('change:extendedProperties', onChange)
    return () => {
      effComp.off('change:extendedProperties', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally excluded: `readValue` and `defaultValue` are fallback-only
    // constants for the panel lifetime. Adding them to deps would re-subscribe
    // the Backbone listener on every render of the panel (keystroke-level churn
    // with zero benefit), since the change handler always re-reads via
    // readValue() — never a captured closure of those values.
  }, [component, subKey])

  function update(newValue: T) {
    if (!comp) return
    // T649: update ref synchronously so getLatest() returns the new value for
    // consecutive calls within the same render cycle.
    setValue(newValue)
    latestRef.current = newValue
    const current = (comp.get('extendedProperties') as Record<string, unknown> | undefined) ?? {}
    comp.set('extendedProperties', { ...current, [subKey]: newValue })
  }

  return [value, update, () => latestRef.current]
}
