# T639 — Stale-closure fix: `getLatest()` in extendedProperties property panels

**Investigation:** T639.1–T639.6 (architecture fix + documentation)
**Code review:** T639.11 (pending)
**Date:** 2026-04-10

---

## Summary

Property panels that manage `extendedProperties` using `useExtendedProperties.update(patch)`
had a latent stale-closure bug: `update` spread over `ep`, which is the value of
`extendedProperties` captured at the last render cycle. If two updates fired rapidly in the
same render cycle (e.g. the user changed question text AND simultaneously triggered an option
add), the second update's closure still held the pre-first-update `ep`, so
`{ ...ep, ...patch }` silently clobbered the first change.

The T621 workaround (read `comp.get('extendedProperties')` directly) bypassed React state
by going directly to the Backbone model. T639 replaces this with a cleaner React-native
solution: `useComponentProperty` now exposes a `getLatest()` getter that reads
`latestRef.current` — always the most-recently committed value.

---

## Issues Found

### HIGH

| ID | File | Description | Status |
|---|---|---|---|
| H-01 | `QuestionPropertiesPanel.tsx` | `useExtendedProperties.update` spread over stale `ep` closure. Could cause silent data loss on rapid consecutive updates. | ✅ RESOLVED — `getLatest()` pattern (T639.2) |
| H-02 | `AnimationPropertiesPanel.tsx` | `save()` spread over stale `ep` closure: `setEp({ ...ep, animations: updated })`. Same data-loss risk as H-01. | ✅ RESOLVED — `getLatestEp()` (T639.4) |

### MEDIUM

| ID | File | Description | Status |
|---|---|---|---|
| M-01 | `useComponentProperty.ts` | `getLatest()` was already computable from `latestRef.current` but not exposed. Callers had to resort to direct Backbone coupling (`comp.get()`). | ✅ RESOLVED — exposed as third return element (T639.1) |

### LOW

| ID | File | Description | Status |
|---|---|---|---|
| L-01 | `QuestionPropertiesPanel.tsx` | Comment above `useExtendedProperties` referenced T621 `isLocalRef` workaround — stale after T639. | ✅ RESOLVED — comment updated to reference T639 (T639.2) |
| L-02 | `docs/developer-guide/03-adding-widget-types.md` | Step 6 prose referred to the now-superseded `isLocalRef` guard with no mention of the stale-closure risk for `extendedProperties` partial patches. | ✅ RESOLVED — updated with stale-closure rule subsection (T639.6) |

### INFORMATIONAL

| ID | File | Description |
|---|---|---|
| I-01 | `ButtonPropertiesPanel.tsx` | Uses `useComponentProperty` but only for scalar (non-patch-merge) property writes — no stale-closure risk. Confirmed unaffected. |
| I-02 | `MediaPlayerPropertiesPanel.tsx` | Uses `useExtendedProperty` (singular, not plural) — writes scalar booleans/strings, no patch-merge. Confirmed unaffected. |
| I-03 | `AudioNarrationPropertiesPanel.tsx` | Same as I-02. Confirmed unaffected. |
| I-04 | `ProgressBarPropertiesPanel.tsx` | Same as I-02. Confirmed unaffected. |
| I-05 | `VolumeControlPropertiesPanel.tsx` | Same as I-02. Confirmed unaffected. |

---

## Root Cause Detail

`useComponentProperty` uses `latestRef.current = value` (assigned on every render, outside
`useEffect`) to track the most-recent committed value. Before T639, this ref was internal-only.
Callers that needed a fresh value for a patch-merge had to bypass React entirely by calling
`comp.get('extendedProperties')` (Backbone model directly). This was the T621 workaround.

T639 closes the abstraction: exposing `() => latestRef.current` as the third return element
means callers never need to touch Backbone. The getter is stable (doesn't change between
renders), so it can be safely captured in callbacks.

**Pattern before T639 (T621 workaround):**
```typescript
function update(patch: Partial<T>) {
  const comp = component as { get(k: string): unknown }
  const latest = (comp.get('extendedProperties') as T | undefined) ?? defaults  // ← Backbone coupling
  setEp({ ...latest, ...patch })
}
```

**Pattern after T639:**
```typescript
const [ep, setEp, getLatest] = useComponentProperty<T>(component, 'extendedProperties', defaults)
function update(patch: Partial<T>) {
  const current = getLatest()  // ← reads latestRef.current, always fresh
  setEp({ ...current, ...patch })
}
```

---

## Resolved (T639.7)

- **T639.7** ✅ — 6 unit tests added to `src/__tests__/hooks/useComponentProperty.test.ts`
  (new describe block `useComponentProperty — getLatest() (T639)`):
  - getter is a function (tuple element 2)
  - returns value on mount
  - reflects update() + re-render
  - reflects external model change
  - **patch-merge regression** (primary): two sequential `act()` blocks each targeting a different EP field → both fields survive
  - AnimationPanel save() pattern: `getLatestEp()` preserves `label` when `animations` written
  - three consecutive patch-merge updates all survive
  All 23 hook tests pass; 680 unit tests green.

## Resolved (T639.8) — additional GrapesJS destroy/load race fix

T639.8 initially passed but produced a browser console error:
```
[EditorCanvas] load() failed: TypeError: Cannot read properties of undefined (reading 'forEach')
```

**Root cause (investigation findings):**

`editor.destroy()` (called in Effect 1 cleanup on courseId change, or React 18 StrictMode
double-invoke) calls Backbone's `this.clear({ silent: true })`, which wipes ALL model
attributes including `storables`. If `editor.load()` was in-flight at this moment (awaiting
`Storage.load()` — an async API call), the subsequent `loadData(result)` call at
grapesjs.js:55206 crashed with:
```
this.storables.forEach(...)   ← this.storables is undefined (cleared by destroy)
```

GrapesJS 0.21 does not guard `loadData()` against the `em.destroyed` state.

**Fix applied (`packages/authoring-ui/src/editor/initEditor.ts`):**

Monkey-patch `em.loadData` after `grapesjs.init()` to check `em.destroyed`:

```typescript
const em = (editor as unknown as GrapesEditorInternal).em
if (em && typeof em.loadData === 'function') {
  const originalLoadData = em.loadData.bind(em)
  em.loadData = function (data: unknown) {
    if (em.destroyed) return data    // ← silently no-op on destroyed editor
    return originalLoadData(data)
  }
}
```

The patch is surgical: it preserves all `loadData` behaviour on live editors, and silently
returns the raw data on destroyed editors (which is what GrapesJS's own `load()` generator
returns as the resolved value — discarded by the `.then()` which is now guarded by
`isCancelled` in EditorCanvas).

**Verification:** T639.8 + T631.3/T631.4/T631.6 all pass in 32s with no browser errors.

---

## T639.11 — Formal Code Review (2026-04-11)

Reviewer findings across 4 files: **0 CRITICAL, 3 HIGH, 4 MEDIUM, 6 LOW**. All resolved.

### HIGH

| ID | File | Description | Resolution |
|---|---|---|---|
| HIGH-01 | `useComponentProperty.ts` | No shared return type — `useComponentProperty` and `useExtendedProperty` each used inline tuple types, making the 3-tuple contract implicit and easy to miss. | ✅ Added `UsePropertyReturn<T>` named labeled tuple type shared by both hooks. |
| HIGH-02 | `useComponentProperty.ts` | `useExtendedProperty` returned only a 2-tuple `[T, update]` — no `getLatest()`. Callers that needed stale-closure protection for sub-key reads had no way to get it without Backbone coupling. | ✅ Added `latestRef` + `() => latestRef.current` as the third element; return type updated to `UsePropertyReturn<T>`. |
| HIGH-03 | `QuestionPropertiesPanel.tsx` | `useExtendedProperties` caller contract undocumented — no comment explaining that callers must pass defaults matching the component's actual widget type. | ✅ Added explicit caller-contract comment with the enforcement rationale (TypeScript generic + `isQuestionWidgetType` guard at render site). |

### MEDIUM

| ID | File | Description | Resolution |
|---|---|---|---|
| MEDIUM-01 | `AnimationPropertiesPanel.tsx` | `useComponentProperty<Record<string, unknown>>` — overly broad type required `as AnimationPath[]` cast when reading `ep.animations`. | ✅ Added `AnimationExtendedProps { animations?: AnimationPath[] }` interface; removed unsafe cast; `ep.animations ?? []` is now fully typed. |
| MEDIUM-02 | `initEditor.ts` | Unnecessary IIFE-style block `{ type GrapesEditorInternal = ... ... }` around the `em.loadData` monkey-patch added indentation without adding isolation (the variable is `const em`, not `var`). | ✅ Removed block scoping; `type` alias and `const em` inlined at function scope. |
| MEDIUM-03 | `useComponentProperty.test.ts` | No `getLatest()` tests for `useExtendedProperty` — HIGH-02 added the feature but the test suite had no coverage for it. | ✅ Added 4-test describe block `useExtendedProperty — getLatest() (T639)`: getter is a function, returns value on mount, reflects `update()` + re-render, reflects external model change. 684 tests green. |
| MEDIUM-04 | `QuestionPropertiesPanel.tsx` | `ep.scoring` property access undocumented — reviewers had to trace back to `*_DEFAULT_EXTENDED` constants to confirm `scoring` is always present (never undefined). | ✅ Added inline comment before `ScoringFeedbackForm` in `MCPropertiesForm` documenting the defaults guarantee. |

### LOW

| ID | File | Description | Resolution |
|---|---|---|---|
| LOW-01 | `useComponentProperty.ts` | Comments inside `useComponentProperty` referenced `T620: latestRef` and `T621 fix` — both stale task IDs after T639 superseded T621. | ✅ Updated to `T639.1: latestRef...` throughout. |
| LOW-02 | `AnimationPropertiesPanel.tsx` | `EMPTY_EP: Record<string, unknown> = {}` — opaque name and untyped constant. | ✅ Renamed to `DEFAULT_ANIMATION_EP: AnimationExtendedProps = {}`. |
| LOW-03 | `QuestionPropertiesPanel.tsx` | `useExtendedProperties` re-declares `getLatest` in its own return — this is intentional design (wrapper exposes the getter from the inner hook). No action needed. | ✅ No change — intentional API design, clarified by HIGH-03 comment. |
| LOW-04 | `initEditor.ts` | `requestAnimationFrame(() => { document.body.removeChild(ghost) })` — no guard in case the element was already removed before the frame fires. | ✅ Wrapped in `try { } catch { /* Already removed or not in DOM */ }`. |
| LOW-05 | `useComponentProperty.ts` | `eslint-disable-next-line` comments in both hooks had no explanation for why the dep was intentionally excluded. | ✅ Added explanatory comment after each disable line. |
| LOW-06 | E2E | Verify E2E suite still green after all changes. | ✅ All 162 Playwright tests pass (verified in T639.9 CI run). |

---

## Resolved (T639.9–T639.11)

- **T639.9** ✅ — Full unit suite green (680 → 684 tests after MEDIUM-03 additions). CI green.
- **T639.10** ✅ — Scoring sub-patch callbacks in all three question forms use `getLatest().scoring`.
- **T639.11** ✅ — All 13 reviewer issues resolved (0 CRITICAL, 3 HIGH, 4 MEDIUM, 6 LOW). This file updated.

---

## Verdict

**APPROVED** — T639 is complete. All CRITICAL, HIGH, MEDIUM, and LOW issues resolved across
T639.1–T639.11. 684 unit tests + 162 E2E tests green. No open issues.
