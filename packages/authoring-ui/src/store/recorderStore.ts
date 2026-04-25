/**
 * Zustand store for the Simulation Recorder (TD-014.9).
 *
 * Owns the lifecycle state of an active recording session — which backend
 * session is live, the captures accumulated so far, async-in-flight flag, and
 * the last error message. Components (TD-014.10 launcher, TD-014.11 live view)
 * subscribe and dispatch `start` / `capture` / `stop` / `reset`.
 *
 * Error handling: thrown errors are narrowed to a string by
 * `performCourseMutation` (the same primitive `editorStore.requestCourseMutation`
 * uses) so the `error` field is always a user-surfaceable message. Consumers
 * decide how to render it (inline banner in the launcher dialog, Toast after
 * the live view closes, etc.) — the store does NOT call Toast directly because
 * it cannot use React hooks.
 *
 * Concurrency: `start` is a no-op while already recording, `capture`/`stop`
 * are no-ops without an active session. This matches the UI contract — buttons
 * are disabled anyway via `recording`/`isBusy`, but defending the store side
 * prevents duplicate backend calls from racing clicks.
 *
 * `activeSessionId` is intentionally NOT cleared on successful `stop()` so the
 * caller can still call `importSimulation(sessionId)` without passing the id
 * through state. A subsequent `reset()` returns the store to its initial
 * "no active session" shape.
 */

import { create } from 'zustand'
import * as recorderApi from '../api/recorderApi'
import { performCourseMutation } from '../lib/courseMutation'
import type { Session, SimStep } from '../types/recorder'

interface RecorderState {
  /** Backend session id while recording / between stop and reset; null otherwise. */
  activeSessionId: string | null
  /** True between successful start and successful stop. */
  recording: boolean
  /** Steps captured so far in the active session (full list, replaced on each capture response). */
  captures: SimStep[]
  /** Last narrowed error message; null while happy-path. */
  error: string | null
  /** True during an in-flight start/capture/stop request. */
  isBusy: boolean

  start: (url: string, title?: string) => Promise<void>
  capture: () => Promise<void>
  stop: () => Promise<Session | undefined>
  reset: () => void
}

const INITIAL = {
  activeSessionId: null,
  recording: false,
  captures: [] as SimStep[],
  error: null,
  isBusy: false,
} satisfies Omit<RecorderState, 'start' | 'capture' | 'stop' | 'reset'>

export const useRecorderStore = create<RecorderState>()((set, get) => ({
  ...INITIAL,

  start: async (url, title) => {
    if (get().recording || get().isBusy) return
    const result = await performCourseMutation(
      () => recorderApi.startRecording(url, title),
      {
        onStart: () => set({ isBusy: true, error: null }),
        onSuccess: () => set({ isBusy: false }),
        onError: (message) => set({ isBusy: false, error: message }),
      },
    )
    if (result) {
      set({
        activeSessionId: result.sessionId,
        recording: true,
        captures: [],
      })
    }
  },

  capture: async () => {
    const { activeSessionId, recording } = get()
    if (!activeSessionId || !recording) return
    const result = await performCourseMutation(
      () => recorderApi.captureStep(activeSessionId),
      {
        onStart: () => set({ isBusy: true, error: null }),
        onSuccess: () => set({ isBusy: false }),
        onError: (message) => set({ isBusy: false, error: message }),
      },
    )
    if (result) {
      // Backend returns the full current step list — replace rather than append
      // so out-of-order responses can't resurrect a stale subset.
      set({ captures: result.steps })
    }
  },

  stop: async () => {
    const { activeSessionId, recording } = get()
    if (!activeSessionId || !recording) return undefined
    const result = await performCourseMutation(
      () => recorderApi.stopRecording(activeSessionId),
      {
        onStart: () => set({ isBusy: true, error: null }),
        // Only flip `recording: false` on success — a failed stop leaves the
        // session alive on the backend so the user can retry.
        onSuccess: () => set({ isBusy: false, recording: false }),
        onError: (message) => set({ isBusy: false, error: message }),
      },
    )
    return result
  },

  reset: () => set({ ...INITIAL }),
}))

// TD-014.29 (F7) — expose the store on window for E2E specs (dev + VITE_E2E_MODE
// only). The recorder E2E uses this to read `activeSessionId` for cleanup —
// without the exposure the fictitious `window.__recorderSessionId` read in
// simulation-recorder.spec.ts never fires and orphan sessions accumulate in
// Garage across CI runs. Pattern mirrors __elearn_store in EditorCanvas.tsx:93-96.
if (typeof window !== 'undefined' &&
    (import.meta.env.DEV || import.meta.env.VITE_E2E_MODE === 'true')) {
  window.__recorderStore = useRecorderStore
}
