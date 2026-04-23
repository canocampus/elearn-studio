/**
 * Ambient augmentation of `Window` for the E2E test harness.
 *
 * `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` exposes the
 * live GrapesJS editor on `window.__elearn_editor` in DEV and
 * `VITE_E2E_MODE=true` builds. Specs read the handle from inside
 * `page.evaluate()` callbacks to assert on component state or drive the
 * canvas programmatically (adding widgets, selecting, querying styles,
 * extended properties, etc.).
 *
 * Without this declaration every access needs `(window as unknown as
 * Record<string, unknown>).__elearn_editor as { … }` — the scattered
 * double-cast escape hatch that TD-004 (`ELearnComponent`, 2026-04-18)
 * erradicated on the production side. Mirror the same policy here:
 * narrow ONCE at this boundary, then use `window.__elearn_editor` at
 * every call site with zero cast.
 *
 * Scope — intentionally minimal. Only the subset of the grapesjs `Editor`
 * surface that specs actually invoke. Adding grapesjs as a devDep here
 * would pull ~400 kB of type definitions for a test-only typing — far
 * larger than the specs' real API needs. Extend `E2EEditor` when a spec
 * genuinely calls a new method and document why in the commit message.
 *
 * Every type here describes the RUNTIME shape as observed from inside
 * `page.evaluate()` (the browser-side shape of a grapesjs Component,
 * Wrapper, etc.) — not the TypeScript type exported from the `grapesjs`
 * package.
 */

export interface E2EComponent {
  get(key: string): unknown
  set(key: string, value: unknown): void
  getId(): string
  /** Backbone-collection-style: getStyle() returns all; getStyle(prop) returns one. */
  getStyle(): Record<string, string>
  getStyle(prop: string): string
  setStyle(styles: Record<string, string>): void
  addStyle(styles: Record<string, string>): void
  addAttributes(attrs: Record<string, string>): void
  toJSON(): unknown
}

export interface E2EWrapper {
  find(selector: string): E2EComponent[]
  components(): E2EComponent[]
}

/**
 * grapesjs `Components` is a Backbone Collection — it exposes both
 * collection-helper methods (`first`, `at`, `length`, `add`) AND the
 * underlying `models` array. Specs reach for whichever is more
 * ergonomic for the assertion they need.
 */
export interface E2EComponents {
  length: number
  first(): E2EComponent | undefined
  at(index: number): E2EComponent | undefined
  add(def: unknown): E2EComponent | E2EComponent[] | undefined
  toArray(): E2EComponent[]
  models: E2EComponent[]
}

export interface E2EBlock {
  get(key: string): unknown
}

export interface E2EBlockManager {
  getAll(): E2EBlock[]
}

export interface E2EEditor {
  addComponents(defs: object[]): E2EComponent | E2EComponent[] | undefined
  select(component: E2EComponent | null | undefined): void
  getSelected(): E2EComponent | null
  getWrapper(): E2EWrapper
  getComponents(): E2EComponents
  runCommand(command: string): unknown
  store(): Promise<unknown>
  BlockManager: E2EBlockManager
}

declare global {
  interface Window {
    __elearn_editor?: E2EEditor
  }
}
