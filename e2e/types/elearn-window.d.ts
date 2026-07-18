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
  /**
   * Content setter — replaces the component's children with the parsed
   * HTML/text string (Backbone-side `components(content)` overload). Added
   * for TD-013.5c: the §17 worked-example composition writes text-widget
   * copy ("Capitals of Europe — Quick Quiz", …) before capturing.
   */
  components(content: string): unknown
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

/**
 * Zustand store bind API exposed alongside `__elearn_editor` (see
 * EditorCanvas.tsx onReady). Used by TD-013.4 to force-sync the Zustand
 * `course.slides[i].widgets` array without a page reload — specifically
 * so WidgetIdParam renders its named-option `<select>` branch for the
 * dropdown-names screenshot. The shape intentionally mirrors the one
 * declared in `packages/authoring-ui/src/types/globals.d.ts` — both are
 * deliberately loose (`unknown`) so this file stays free of Zustand
 * deep-type imports. Callers narrow at the use site.
 */
export interface E2EStoreBind {
  getState(): unknown
  setState(partial: unknown): void
  subscribe(listener: () => void): () => void
}

/**
 * TD-014.29 (F7) — sim editor + recorder stores exposed for E2E only.
 * Shapes are intentionally narrow to the fields specs actually read so the
 * ambient declaration doesn't drift with refactors of the store internals.
 * If a spec needs a new field, widen here at the boundary — do NOT reach in
 * with `as unknown as` at the call site.
 */
interface E2ESimStoreState {
  config: {
    mode: 'demo' | 'practice' | 'assessment'
    passingScore: number
    steps: Array<{
      id: string
      order: number
      description: string
      instruction: string
      screenshotKey: string
      screenshotUrl: string
      hotspot: { x: number; y: number; width: number; height: number; tolerance: number }
      interactionType?: 'click' | 'hover' | 'type'
      expectedText?: string
    }>
  } | null
  selectedStepIndex: number
  panelOpen: boolean
}

interface E2ERecorderStoreState {
  activeSessionId: string | null
  recording: boolean
  captures: unknown[]
  error: string | null
  isBusy: boolean
}

export interface E2ESimStoreBind {
  getState(): E2ESimStoreState
  setState(partial: Partial<E2ESimStoreState>): void
  subscribe(listener: () => void): () => void
}

export interface E2ERecorderStoreBind {
  getState(): E2ERecorderStoreState
  setState(partial: Partial<E2ERecorderStoreState>): void
  subscribe(listener: () => void): () => void
}

declare global {
  interface Window {
    __elearn_editor?: E2EEditor
    __elearn_store?: E2EStoreBind
    /** Sim editor Zustand store — DEV / E2E only (TD-014.29 / F7). */
    __simStore?: E2ESimStoreBind
    /** Recorder lifecycle Zustand store — DEV / E2E only (TD-014.29 / F7). */
    __recorderStore?: E2ERecorderStoreBind
  }
}
