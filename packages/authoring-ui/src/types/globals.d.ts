/**
 * Ambient Window augmentation for authoring-ui.
 *
 * DEV builds and `VITE_E2E_MODE=true` builds expose two handles on `window`:
 *
 *  - `__elearn_editor` — the live GrapesJS Editor instance. Used by Playwright
 *    specs to drive the canvas programmatically (add widgets, select, read
 *    state). Set in `EditorCanvas.tsx` onReady.
 *  - `__elearn_store` — the Zustand store reference (bind API). Used by the
 *    docs-screenshots campaign to force-sync Zustand state without a full
 *    page reload — specifically to populate `course.slides[i].widgets` with
 *    current widget names so `WidgetIdParam` renders named options (TD-013.4
 *    playbook T-15). Set in `EditorCanvas.tsx` onReady.
 *
 * The declarations are intentionally loose (`unknown` for Editor, generic
 * store API for the Zustand handle) so this file stays free of grapesjs /
 * Zustand deep-type imports. Callers narrow at the use site.
 *
 * Mirrors the policy established by TD-012: narrow once at the boundary,
 * never scattered `as unknown as X` double casts at every call site.
 */

// Re-declared here (not imported from e2e/) because packages have
// independent tsconfigs and cannot share ambient declarations without
// a dedicated monorepo types package. The two declarations intentionally
// stay in sync; any addition to one should be mirrored to the other.

interface ElearnStoreBind {
  getState(): unknown
  setState(partial: unknown): void
  subscribe(listener: () => void): () => void
}

declare global {
  interface Window {
    /** GrapesJS Editor instance — DEV / E2E only. */
    __elearn_editor?: unknown
    /** Zustand store bind API — DEV / E2E only. */
    __elearn_store?: ElearnStoreBind
    /**
     * Sim editor Zustand store — DEV / E2E only (TD-014.29 / F7).
     * Used by `simulation-editor.spec.ts` to read hotspot bounds, step
     * content, and config post-reload.
     */
    __simStore?: ElearnStoreBind
    /**
     * Recorder lifecycle Zustand store — DEV / E2E only (TD-014.29 / F7).
     * Used by `simulation-recorder.spec.ts` to read `activeSessionId` for
     * cleanup via `DELETE /recorder/sessions/:id`.
     */
    __recorderStore?: ElearnStoreBind
  }
}

export {}
