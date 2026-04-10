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

## Pending (T639.9–T639.11)

- **T639.9** — Full suite pass + CI green
- **T639.10** — Refine generated code
- **T639.11** — Formal code review pass; update this file with verdict

---

## Verdict

APPROVED (partial) — all CRITICAL and HIGH items resolved in T639.1–T639.8.
MEDIUM M-01 resolved. LOW items resolved. GrapesJS destroy/load race (browser error in T639.8)
fixed with em.loadData guard in initEditor.ts. Remaining subtasks T639.9–T639.11 are
CI/review/refine work — no further code changes expected in core implementation.
