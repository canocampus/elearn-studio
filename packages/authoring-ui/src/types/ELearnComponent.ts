import type { Component } from 'grapesjs'

/**
 * TD-004 — central typed view over a GrapesJS `Component` for elearn-studio.
 *
 * Why this exists
 * ---------------
 * GrapesJS types `Component.get`/`set` with `<A extends keyof ComponentProperties>`
 * inherited from Backbone's generic `Model<T>`. That signature rejects the many
 * custom attributes we store on every component — `extendedProperties`, `actions`,
 * `elearnActions`, `questionText`, `options`, `sceneDef`, `prevLabel`, `nextLabel`,
 * and every widget-specific field — because they are not in `ComponentProperties`.
 *
 * Before TD-004 every call site worked around this with `as unknown` / `as GjsComponent`
 * casts scattered across `useComponentProperty.ts` (see 6 sites pre-refactor). That
 * bypassed TypeScript's safety completely and spread a loose assumption through the
 * hooks layer.
 *
 * `ELearnComponent` keeps all typed methods from `Component` (`getId`, `addStyle`,
 * `getStyle`, `setStyle`, `components()`, `append()`, `clone()`, `remove()`, etc.)
 * and only loosens the four methods we use with arbitrary string keys/events:
 *
 *  - `get(key)`    — read any attribute, returns `unknown` (caller narrows)
 *  - `set(key, v)` — write any attribute, returns `void`
 *  - `on(event, handler)`  — subscribe to `change:<anyKey>`, `component:update`, etc.
 *  - `off(event, handler)` — matching unsubscribe
 *
 * Return type of `get` is deliberately `unknown` (not `any`): it forces callers to
 * narrow at the use site, which is what the hooks already do via `typeof`/`??`
 * guards.
 *
 * Usage
 * -----
 *  ```ts
 *  import type { ELearnComponent } from '../types/ELearnComponent'
 *
 *  function readExtended(component: Component | null): unknown {
 *    if (!component) return undefined
 *    const comp = component as ELearnComponent
 *    return comp.get('extendedProperties')
 *  }
 *  ```
 *
 * Scope
 * -----
 * - Production hooks that reach into non-`ComponentProperties` fields
 *   (`useComponentProperty`, `useExtendedProperty`, and any future hook).
 * - Tests MAY keep `as unknown as Component` on mock objects — ELearnComponent is
 *   not intended to replace mock-construction casts; those live at a different
 *   type-safety boundary (hand-rolled fakes vs. real instances).
 *
 * Non-goals
 * ---------
 * - Wrapping every GrapesJS API. Only methods that require arbitrary string keys.
 * - Adding runtime behaviour. This is a pure type declaration.
 */
export type ELearnComponent = Component & {
  /** Read any attribute (including custom elearn-studio fields). Returns `unknown` — caller must narrow. */
  get(key: string): unknown
  /** Write any attribute. Value is opaque to the type system by design. */
  set(key: string, value: unknown): void
  /** Subscribe to a Backbone event (`change:<key>`, `component:update`, etc.). */
  on(event: string, handler: () => void): void
  /** Unsubscribe a previously registered handler. Must be the same reference passed to `on`. */
  off(event: string, handler: () => void): void
}
