/**
 * Course-meta mutation primitive — TD-007 Layer 1.
 *
 * Generic wrapper around a single `courseApi` REST call that narrows any thrown
 * error to a message string and funnels UI-state transitions via caller-supplied
 * hooks. Returns the API result on success, `undefined` on failure (so callers
 * can branch on `if (updated) { … }` without try/catch at every site).
 *
 * Mirrors the pure-primitive layer of T651's `performSave`. No Zustand, no
 * React — testable in isolation with just a mock API function.
 *
 * The Zustand-bound closure (`requestCourseMutation`) lives in `initEditor.ts`
 * (Layer 2) and is exposed via the editor store (Layer 3).
 *
 * See decisions/2026-04-18-course-mutation.md for the full design rationale.
 */

export interface CourseMutationHooks {
  /** Called synchronously before `apiCall()` is invoked. */
  onStart?: () => void
  /** Called after `apiCall()` resolves successfully, before the result is returned. */
  onSuccess?: () => void
  /**
   * Called after `apiCall()` rejects, with a narrowed message string.
   * The error is NOT re-thrown — `performCourseMutation` returns `undefined`
   * so callers check the return value instead of wrapping in try/catch.
   */
  onError?: (message: string) => void
}

export async function performCourseMutation<R>(
  apiCall: () => Promise<R>,
  hooks: CourseMutationHooks = {},
): Promise<R | undefined> {
  hooks.onStart?.()
  try {
    const result = await apiCall()
    hooks.onSuccess?.()
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    hooks.onError?.(msg)
    return undefined
  }
}
