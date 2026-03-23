# Code Review: Phaser Sim Authoring UI (T034)

**Date**: 2026-03-23
**Scope**: T034 — Phaser-sim GrapesJS block, properties panel, preview modal
**Status**: ✅ RESOLVED — all CRITICAL and HIGH issues fixed before commit

---

## CRITICAL Issues

### C-01: React `key` Prop Null Crash

**File**: `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`
**Line**: 256

**Issue**: `selected.getId()` can return `null` for GrapesJS components that have not yet been
assigned a persistent ID (e.g., freshly dropped blocks before the first save cycle).
Passing `null` to the `key` prop is silently accepted by React but causes incorrect reconciliation.

```tsx
// BEFORE — risky: key may be null
<PhaserSimSceneDefEditor
  key={selected.getId()}
  ...
/>
```

**Why Critical**: GrapesJS does not guarantee `getId()` returns a non-null string until the
component is persisted. If `null` is passed React falls back to index-based reconciliation,
which can cause the editor to keep stale state from a previous component.

**Fix applied**:
```tsx
// AFTER — safe fallback to internal cid
<PhaserSimSceneDefEditor
  key={selected.getId() ?? selected.get('cid') as string}
  ...
/>
```

`cid` is GrapesJS's internal auto-generated client-side id — it is always present.

---

## HIGH Issues

### H-01: Empty String Passed as `componentId` to Store

**File**: `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`
**Function**: `handlePreview`

**Issue**: `selected.getId() ?? ''` passed an empty string to `openPreview()` when the component
lacked a persistent ID. The Zustand store stored `''` as `editingComponentId`, which downstream
consumers could not use to locate the component.

```typescript
// BEFORE — bad: empty string is not a valid component reference
function handlePreview(): void {
  const current = getExtendedProps(selected!)
  openPreview(current, selected!.getId() ?? '')
}
```

**Why High**: Empty-string IDs create silent bugs — the modal opens but any "Save changes back
to canvas" logic silently fails to find the target component.

**Fix applied**:
```typescript
// AFTER — guard: refuse to open preview if ID is unavailable
function handlePreview(): void {
  const componentId = selected!.getId()
  if (!componentId) {
    console.warn('[PhaserSimPropertiesPanel] Cannot open preview: component lacks ID')
    return
  }
  const current = getExtendedProps(selected!)
  openPreview(current, componentId)
}
```

---

## MEDIUM Issues

### M-01: No Loading State During Async Preview Open

**File**: `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`

**Issue**: `handlePreview` is synchronous; no visual feedback if the preview modal takes time to
initialise. Low risk now (modal is instant) but could become a UX issue when real Phaser boot is
wired in.

**Status**: ⚠ Open — deferred to T036+ when full preview initialisation is added.

---

### M-02: `PhaserSimPreviewModal` Shows Config Summary Only

**File**: `packages/authoring-ui/src/components/simulation/PhaserSimPreviewModal.tsx`

**Issue**: Preview modal renders a JSON summary rather than a live Phaser canvas. Intentional for
T034 (full preview requires T035 runtime), but should be clearly labelled as a placeholder.

**Status**: ⚠ Open — by design. Modal copy already states "Full preview requires runtime player."

---

### M-03: `PhaserSimPropertiesPanel` Lacks Input Debounce

**File**: `packages/authoring-ui/src/components/sidebar/PhaserSimPropertiesPanel.tsx`

**Issue**: Every keystroke in the sceneDef JSON editor calls `selected.set(...)` and triggers
a GrapesJS change event → auto-save. This is correct semantically but could generate excessive
API calls under the current storage manager implementation.

**Status**: ⚠ Open — to be addressed when storage manager debounce is added in a later task.

---

## LOW Priority

### L-01: Missing JSDoc on `registerPhaserSimBlock`
- Exported function lacks `@param` / `@returns` documentation.

### L-02: `PhaserSimStore` Has No Selector Helpers
- Consumers use `useStore(s => s.field)` directly. Selector helpers would improve refactor safety.

### L-03: `phaserSim.ts` Types Not Validated at Runtime
- `PHASER_SIM_TYPES` array is the only validation gate; schema validation (zod) would catch
  malformed `sceneDef` earlier.

---

## Security Review

✅ `sceneDef` JSON is editor-authored content, not user-submitted. No XSS surface at this layer.
✅ No external HTTP requests from the authoring panel.
✅ `PhaserSimPreviewModal` renders config as escaped text, not `dangerouslySetInnerHTML`.

---

## Summary

| Severity | Count | Status     |
|----------|-------|------------|
| CRITICAL | 1     | ✅ Closed  |
| HIGH     | 1     | ✅ Closed  |
| MEDIUM   | 3     | ⚠ Open    |
| LOW      | 3     | ⚠ Open    |

**Verdict**: ✅ PASS (CRITICAL and HIGH resolved before commit)

**Fixes applied**:
1. [C-01] ✅ `key` prop uses `selected.getId() ?? selected.get('cid') as string` fallback
2. [H-01] ✅ `handlePreview` guards against null ID with early return + `console.warn`
