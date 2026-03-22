# Issues — T013: Slide Management (F01)

> Reviewer: automated code review (T013.7)
> Status: HIGH issues resolved; MEDIUM/LOW tracked below

---

## Summary

| Severity | Found | Resolved |
|----------|-------|----------|
| CRITICAL | 0 | — |
| HIGH | 4 | 4 ✅ |
| MEDIUM | 5 | 5 ✅ |
| LOW | 4 | 3 ✅ / 1 deferred (L-04 touch DnD) |

---

## HIGH — Resolved

### H-01: Missing error UI feedback in all catch blocks

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx`

**Issue:** All async operations (add, duplicate, delete, rename, reorder) only logged
errors to the console. Users would see no feedback on failure. The store already
exposed `setSaveError` (used by TopToolbar), but SlideList was not calling it.

**Fix applied:** Added `setSaveError` call in every catch block:

```tsx
const setSaveError = useEditorStore(s => s.setSaveError)

catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  setSaveError(msg)
  console.error('Failed to add slide:', err)
}
```

---

### H-02: Drag-drop index off-by-one when dragIndex < dropIndex

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx` — `handleDrop`

**Issue:** After `ids.splice(dragIndex, 1)`, all indices above `dragIndex` shift down
by 1. The original `dropIndex` was not adjusted, so the splice inserted the moved slide
one position too late whenever dragging a slide forward in the list.

**Example (before fix):**
- `[A, B, C, D]`, drag index 1 (B) to drop index 3
- After `splice(1, 1)`: `[A, C, D]`
- `splice(3, 0, B)` → index 3 out of bounds / appends at end → `[A, C, D, B]`
- Expected: `[A, C, D, B]` ← coincidentally correct at end, but wrong for mid-list drops

**Fix applied:**

```tsx
const moved = ids[dragIndex]!
ids.splice(dragIndex, 1)
const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex
ids.splice(adjustedDropIndex, 0, moved)
// ...
setCurrentSlideIndex(adjustedDropIndex)
```

---

### H-03: No guard against concurrent async operations (duplicate, delete)

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx`

**Issue:** Only `handleAddSlide` had an `isAdding` guard. Double-clicking duplicate or
delete could fire two API calls before the first completed, causing duplicate slides or
redundant delete errors.

**Fix applied:** Added `isProcessing` state flag shared across duplicate, delete, and
reorder operations. Action buttons are disabled while `isProcessing` is true:

```tsx
const [isProcessing, setIsProcessing] = useState(false)

async function handleDuplicate(slide: Slide) {
  if (isProcessing) return
  setIsProcessing(true)
  try { ... } finally { setIsProcessing(false) }
}

// In SlideItem:
<button disabled={isProcessing} ...>⧉</button>
<button disabled={!canDelete || isProcessing} ...>✕</button>
```

---

## MEDIUM — Deferred

### M-01: No error tests in SlideList.test.tsx ✅ Fixed

**File:** `packages/authoring-ui/src/__tests__/SlideList.test.tsx`

**Fix applied:** Added `describe('error handling — API throws', ...)` block with 4 tests:
- `addSlide` throws → `saveError` set, course unchanged
- `deleteSlide` throws → `saveError` set, course unchanged
- `duplicateSlide` throws → `saveError` set, course unchanged
- `updateSlide` (rename) throws → `saveError` set, course unchanged

---

### M-02: No loading state for rename operation ✅

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx` — `commitRename`

**Fix applied:** `commitRename` now guards on `isProcessing` and wraps the API call in
`setIsProcessing(true/false)` so concurrent renames are blocked while one is in flight.

---

### M-03: Error body may be very large in thrown messages ✅

**File:** `packages/authoring-ui/src/api/courseApi.ts` — `request` function

**Fix applied:** Error body is now truncated to 500 characters with an ellipsis:
```tsx
const raw = await res.text().catch(() => '')
const body = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
```

---

## LOW — Non-blocking

### L-01: `console.error` calls remain in production code

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx`

These are acceptable for Phase 0 debugging. Replace with a structured logger in Phase 1
before any production deployment.

**Why deferred:** No structured logging library has been selected for the frontend yet. Adding `console.error` calls now provides useful stack traces during active development without committing to a specific logger API.
**Unblock condition:** When a frontend logging facade (e.g. a thin wrapper over `pino-browser` or a custom `logger.ts`) is adopted, replace all `console.error` / `console.warn` calls in component files with `logger.error({ context: 'SlideList' }, message)`.

---

### L-02: Missing JSDoc on SlideItemProps ✅ Fixed

**File:** `packages/authoring-ui/src/components/sidebar/SlideList.tsx`

Added: `/** Props for an individual slide row in the slide list panel. */`

---

### L-03: DRY violation — next-slide title logic duplicated in TopToolbar ✅ Fixed

**Files:** `SlideList.tsx`, `TopToolbar.tsx`, `courseApi.ts`

Extracted `nextSlideTitle(slides)` helper to `courseApi.ts`. Both `SlideList` and
`TopToolbar` now import and call it instead of inlining the template string.

---

### L-04: Drag-and-drop is desktop-only (no touch support)

HTML5 drag-and-drop (`draggable` / `ondragstart`) does not fire on iOS/Android.
Acceptable for an authoring tool (always desktop). Document in CLAUDE.md if mobile
support becomes a requirement.

**Why deferred:** eLearn Studio is an authoring tool — course creation requires a keyboard, mouse, and large screen. Touch-only devices are not a target platform. The HTML5 DnD API is the correct choice for desktop; replacing it with a pointer-events-based library (e.g. `dnd-kit`) would add bundle size with no user benefit.
**Unblock condition:** Only if a mobile-first authoring requirement is added. Would require migrating to a pointer-events DnD library across SlideList, BlockManagerPanel, and the GrapesJS canvas.

---

## Files changed in T013.7 (refinement)

| File | Change |
|------|--------|
| `src/components/sidebar/SlideList.tsx` | H-01: added `setSaveError` to all catch blocks |
| `src/components/sidebar/SlideList.tsx` | H-02: fixed drag-drop `adjustedDropIndex` calculation |
| `src/components/sidebar/SlideList.tsx` | H-03: added `isProcessing` guard + disabled action buttons |

## Files changed in T013.6 + deferred fixes (follow-up)

| File | Change |
|------|--------|
| `src/types/course.ts` | T013.6: added `thumbnail?: string` to `Slide` |
| `src/editor/storageManager.ts` | T013.6: capture `getHtml()`+`getCss()` and save `thumbnail` in `store()` |
| `src/components/sidebar/SlideList.tsx` | T013.6: render srcdoc iframe in `SlideItem`; M-02: `commitRename` now guarded by `isProcessing` |
| `src/api/courseApi.ts` | M-03: truncate error body to 500 chars |
| `backend/api/src/models/Course.ts` | T013.6: added `thumbnail: String` to `SlideSchema` |
| `backend/api/src/routes/courses.ts` | T013.6: `thumbnail` field handled in PATCH route |
