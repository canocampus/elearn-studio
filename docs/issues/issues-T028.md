# Issues — T028 Animations

Code review of the T028 Animations feature (path editor, properties panel, WAAPI runtime, play-animation action).

---

## MEDIUM — `AnimationPropertiesPanel` re-reads component on every render; state resets when widget changes

**File:** `packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx:92`

`resolvedSelectedId` is derived from `animations` on every render, but `selectedId` is tracked in component state. When the user selects a *different* widget, `selectedId` still holds the old animation ID. The `resolvedSelectedId` derivation correctly handles this by falling back to `animations[0]?.id`, but it does not call `setSelectedId` to persist the new resolved value, so the stale `selectedId` lingers until the user clicks an animation. This is benign but slightly inconsistent.

**Resolution:** Acceptable for v1. A `useEffect` that calls `setSelectedId(animations[0]?.id ?? null)` on component ID change would clean this up in a future pass.

---

## ~~MEDIUM — `buildKeyframes` uses `new Array(n).fill(undefined)` — TypeScript typed as `number[]`~~ ✅ FIXED

**File:** `packages/runtime-player/src/animations/animator.ts:64`

The type annotation said `number[]` but the array was initialised with `undefined` slots. The interpolation loop relies on `offsets[i] !== undefined` to detect gaps — TypeScript would not catch accidental reads on downstream uses.

**Fix (2026-03-22):** Changed annotation to `(number | undefined)[]` — the type now accurately reflects the initialisation and the gap-detection logic.

---

## MEDIUM — No guard against out-of-order explicit `t` values in `buildKeyframes`

**File:** `packages/runtime-player/src/animations/animator.ts:54`

If an author provides keypoints with `t` values that are not monotonically increasing (e.g. `[{x:0,y:0,t:0.8}, {x:50,y:0,t:0.2}]`), the resulting `offsets` array will be non-monotonic. WAAPI requires keyframe offsets to be in non-decreasing order and will throw a `TypeError` at `element.animate(...)`. The `try/catch` in `executeAnimation` will catch it gracefully, but the animation will silently not play.

**Resolution:** Add a sort or validation pass in `buildKeyframes` (or in `executeAnimation` before the call). A `console.warn` explaining the problem helps authors debug. Low priority for v1 since the path editor does not expose explicit `t` fields yet.

---

## ~~LOW — `PathEditorCanvas` keyboard handler requires the overlay `div` to have focus~~ ✅ FIXED

**File:** `packages/authoring-ui/src/components/konva/PathEditorCanvas.tsx:98`

Added `autoFocus` to the overlay div so focus is set immediately on mount. Also added `e.preventDefault()` inside `handleKeyDown` to prevent browser default behavior (back-navigation, input deletion) when Delete/Backspace is pressed.

---

## LOW — `PathEditorCanvas` waypoint circles use array `idx` as Konva `key`

**File:** `packages/authoring-ui/src/components/konva/PathEditorCanvas.tsx:144`

```tsx
<Circle key={idx} ...>
```

Using the array index as the React key causes unnecessary reconciliation when a waypoint is deleted from the middle of the list (all subsequent circles get new keys). A stable unique ID per waypoint (e.g. incrementing counter or `crypto.randomUUID()`) would prevent this.

**Resolution:** Add a `uid` field to waypoint objects in local state. Minor impact since the array is small.

---

## LOW — `executePlayAnimation` is fire-and-forget — no API to cancel or track completion

**File:** `packages/runtime-player/src/actions/builtins/animation.ts:43`

`executeAnimation` returns an `Animation` handle that can be cancelled, but `executePlayAnimation` discards it. If a second `play-animation` action triggers the same widget before the first animation finishes, both animations will run simultaneously on the element, potentially fighting over `transform`.

**Resolution:** For v1 this is acceptable. A future `stop-animation` action (or storing the handle on `WidgetRef`) would allow proper cancellation.

---

## LOW — `AnimationPropertiesPanel` types duplicated from `animator.ts`

**File:** `packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx:23`

`AnimationKeypoint`, `AnimationFill`, and `AnimationPath` are defined in both `runtime-player/src/animations/animator.ts` and `authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx`. The comment says "mirrored from runtime-player/src/animations/animator.ts". If the types diverge, the authoring UI and runtime player could silently misinterpret animation data.

**Resolution:** Move shared types to a `packages/shared-types` workspace package, or use a `/// <reference>` / re-export in authoring-ui that points to the runtime-player package. Acceptable duplication for v1 given the strict monorepo boundary, but requires discipline to keep in sync.

---

## INFO — `buildTiming` silently clamps `loop: 0` to `iterations: 1`

**File:** `packages/runtime-player/src/animations/animator.ts:114`

```ts
const iterations = rawLoop === -1 ? Infinity : rawLoop <= 0 ? 1 : rawLoop
```

`loop: 0` is clamped to `iterations: 1` (plays once). The properties panel allows entering `0` as the loop count. From an author's perspective, `0` plays might mean "never play" — but the current behaviour makes it play once. The UI could prevent `0` with `min={1}` on the input, or document the clamping.

**Resolution:** Change the UI's `min` attribute from `-1` to `1` and add `-1` as a distinct "infinite" option (or keep as-is and add a tooltip). No runtime change required.

---

## Summary

| Severity | Count | Fixed | Accepted |
|----------|-------|-------|----------|
| MEDIUM   | 3     | 1 ✅  | 2        |
| LOW      | 4     | 1 ✅  | 3        |
| INFO     | 1     | 0     | 1        |

**Accepted (no fix needed for v1):**
- M-01 — AnimationPropertiesPanel stale selectedId on widget change (acceptable for v1; clean up with `useEffect` later)
- M-03 — No guard for out-of-order `t` values in `buildKeyframes` (path editor doesn't expose `t` in v1)
- L-02 — PathEditorCanvas waypoint circles use array index as Konva key (small array; minor reconciliation cost)
- L-03 — `executePlayAnimation` fire-and-forget (acceptable for v1; future `stop-animation` action will address)
- L-04 — AnimationPropertiesPanel types duplicated from animator.ts (acceptable in monorepo for v1; move to `shared-types` in Phase 2.5)
- INFO — `buildTiming` silently clamps `loop: 0` to `iterations: 1` (acceptable; UI can add `min={1}`)

## VERDICT: CLOSED (2026-03-22) — no CRITICAL/HIGH items; all MEDIUM/LOW either fixed or accepted for v1

**Fixed:** L-01 (keyboard focus), M-02 (number[] type annotation), T028-POST-01 (TS2322), plus implementation-time fixes (single-point offset bug, prop refactor, preventDefault, unsafe cast)

---

## Post-review fix (2026-03-22)

| ID | Severity | Location | Issue | Status |
|----|----------|----------|-------|--------|
| T028-POST-01 | LOW | `src/__tests__/animator.test.ts:197` | **TypeScript error TS2322 — `animate = undefined` assignment**: Test assigns `undefined` to `el.animate` using `(el as HTMLElement & { animate?: unknown }).animate = undefined`, but TS still complains because the original `HTMLElement` type has `animate` as non-optional. | **FIXED** — Changed cast to `(el as any).animate = undefined` with an eslint-disable comment. |

## Resolved during implementation

- **Single-point keyframe offset bug** (offset was `1` instead of `0` for single-waypoint paths): Fixed by adding an early-return shortcut in `buildKeyframes` before the anchor-overwrite logic runs. All 24 animator tests pass.
- **`AnimationPropertiesPanel` component prop refactor**: Refactored from prop-driven to store-driven (reads `editor.getSelected()` from `useEditorStore`) for consistency with `QuestionPropertiesPanel`.
- **`PathEditorCanvas` missing `e.preventDefault()`**: Added in `handleKeyDown` so Delete/Backspace doesn't trigger browser default actions (back-navigation, input clearing) while editing waypoints.
- **`executePlayAnimation` unsafe `animations` cast**: Added `Array.isArray` guard before casting `ref.extendedProperties?.animations` to `AnimationPath[]`, with a `console.warn` when the value is missing or malformed.
