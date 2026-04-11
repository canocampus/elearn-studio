# 08 — Persistence Flow

How a user edit in GrapesJS travels from canvas interaction to the API and back — and how the in-memory cache prevents redundant round-trips on slide switches.

---

## Overview

eLearn Studio uses a **unidirectional persistence pipeline**:

```
USER EDIT
  │
  ▼ GrapesJS Backbone model updated (component tree)
  │
  ▼ component:update event fires (debounce 2 s via triggerAutosave)
  │
  ▼ editor.store()  ──────────────────────────────────────────────────┐
  │                                                                    │
  ▼ storageManager.store()                                            │
  │                                                                    │
  ▼ widgetsFromGrapesjs()  →  Widget[]                                │
  │                                                                    │
  ▼ PATCH /courses/:courseId/slides/:slideId                          │
  │                                                                    │
  ▼ courseCache updated in place (T640.1)  ◄──────────────────────────┘
  │
  ▼ Next editor.load() reads from cache — no extra GET /courses/:id
```

---

## Source-of-Truth boundary

| Domain | Source of Truth | Technology |
|--------|----------------|------------|
| Canvas content (widgets on slide) | GrapesJS Backbone model | GrapesJS component tree |
| UI state (panel selections, cursor, undo stack) | React state / Zustand | React |
| Persisted course data | MongoDB via API | Express + Mongoose |
| In-session cache | `courseCache` module var in `storageManager.ts` | TypeScript module scope |

These are **not** the same thing and must not be conflated. In particular:

- Never read `courseCache` from React components. It is internal to `storageManager.ts`.
- Never persist React UI state (panel open/closed, selected component) via `editor.store()`. Only widget schema lives in slides.
- Never call `editor.store()` directly from React components. Let `triggerAutosave()` handle it.

---

## Detailed step-by-step

### 1. User edits a widget on the canvas

GrapesJS fires `component:update` on the Backbone model for the changed component.

`initEditor.ts` registers a listener during editor setup:

```typescript
// packages/authoring-ui/src/editor/initEditor.ts
editor.on('component:update', () => triggerAutosave(editor))
```

### 2. Debounce — `triggerAutosave()`

`triggerAutosave()` uses a 2-second debounce to coalesce rapid edits (typing, dragging)
into a single API call. It calls `editor.store()` after the quiet period.

> **Why 2 s?** Short enough that users do not lose more than 2 s of work on a crash.
> Long enough to avoid a PATCH on every keystroke.

### 3. `editor.store()` dispatches to the custom Storage Manager

GrapesJS calls `storageManager.store(gjsData, context)` where:

- `gjsData` — the serialized component tree produced by GrapesJS internally
- `context` — `{ courseId, slideId }` injected by `updateStorageContext()` before every load/store

The Storage Manager type is registered as `'elearn-api'` in `initEditor.ts`.

### 4. `widgetsFromGrapesjs()` — canvas → Widget[]

```typescript
// packages/authoring-ui/src/editor/storageManager.ts
const widgets = widgetsFromGrapesjs(gjsData.components)
```

This converter walks the GrapesJS component tree and produces a `Widget[]` array
matching the Mongoose schema in `backend/models/Course.ts`.

> **Adding a new widget type?** See [03 — Adding Widget Types](./03-adding-widget-types.md).
> You must update both `widgetsFromGrapesjs()` and its inverse `grapesjsFromWidgets()`.

### 5. PATCH to the API

```typescript
await courseApi.updateSlide(courseId, slideId, { widgets })
// → PATCH /courses/:courseId/slides/:slideId
```

The API replaces the slide's `widgets` array in MongoDB atomically.

### 6. Cache update (T640.1)

After a successful PATCH, `storageManager.ts` updates the in-memory cache **in place**
rather than invalidating it:

```typescript
if (courseCache?.courseId === courseId) {
  const updatedSlides = courseCache.doc.slides.map(s =>
    s.id === slideId ? { ...s, widgets } : s
  )
  courseCache = { courseId, doc: { ...courseCache.doc, slides: updatedSlides } }
}
```

**Why update instead of invalidate?**

We just wrote the data — the cache now holds the freshest state for that slide.
Clearing it would force an unnecessary `GET /courses/:id` on the very next `load()`.
Only the **failure** path clears the cache (to prevent stale data from being served
after a failed write).

**Cold cache edge case:** If `courseCache` is `null` when `store()` runs (rare: first
store before any load), the condition is false and the update is safely skipped.

### 7. Slide switch — `load()` reads from cache

When the user switches slides, `EditorCanvas.tsx` calls:

```typescript
updateStorageContext({ courseId, slideId: newSlideId })
editor.load()  // → storageManager.load()
```

`storageManager.load()` checks the cache first:

```typescript
if (courseCache?.courseId === courseId) {
  const slide = courseCache.doc.slides.find(s => s.id === slideId)
  if (slide) return grapesjsFromWidgets(slide.widgets)
}
// cache miss → GET /courses/:id → populate cache → return slide
```

Because the cache was updated in step 6, the freshly saved slide A is served from
cache when the user switches to slide B and back to slide A — **without any extra API call**.

---

## The `autoload: false` / `autosave: false` invariants

Both flags in `initEditor.ts` are **intentional and must not be changed**.

### `autoload: false`

```typescript
// INTENTIONAL — do NOT change to true.
// EditorCanvas calls editor.load() explicitly after updateStorageContext() so it
// controls the exact slide being loaded. With autoload:true GrapesJS fires an
// extra load() on init (before EditorCanvas sets courseId/slideId), racing against
// EditorCanvas's own load() — clearing components added between the two calls.
// See R-03 fix notes in EditorCanvas.tsx Effect 2. (T640.2)
autoload: false,
```

The double-load race (autoload + EditorCanvas explicit load) produces a blank canvas
for the first slide opened. The fix is permanently `autoload: false`.

### `autosave: false`

```typescript
// INTENTIONAL — do NOT change to true.
// A debounced component:update listener in initEditor.ts (triggerAutosave) handles
// saves instead. Enabling autosave with stepsBeforeSave:1 would fire a
// PATCH /courses/:id/slides/:slideId on every single undo/redo step. (T640.2)
autosave: false,
```

GrapesJS's built-in `autosave` with `stepsBeforeSave: 1` fires after every command
in the undo stack — including every character typed in a text field. This produces
unbounded API traffic. The debounced listener in `initEditor.ts` is the correct solution.

---

## Cache lifecycle

| Event | Cache state |
|-------|-------------|
| First `load()` — cache miss | `GET /courses/:id` → populate `courseCache` |
| Subsequent `load()` same course | served from `courseCache` (no GET) |
| Successful `store()` | `courseCache` updated for that slide only |
| Failed `store()` | `courseCache = null` — force fresh GET on next load |
| `invalidateCourseCache()` called | `courseCache = null` — used when course structure changes (slide add/delete) |
| Editor `destroy()` | module var persists (module-level scope); new editor instance reuses cache if same courseId |

---

## Sequence diagram — edit + slide switch

```
User      EditorCanvas    initEditor.ts     storageManager.ts   API
 │              │               │                  │              │
 │──edit──►     │               │                  │              │
 │         (canvas event)       │                  │              │
 │              │──component:update──►              │              │
 │              │               │──triggerAutosave()│              │
 │              │               │   (2 s debounce)  │              │
 │              │               │──editor.store()──►│              │
 │              │               │                  │──widgetsFromGrapesjs()
 │              │               │                  │──PATCH slide──►│
 │              │               │                  │◄──200 OK───── │
 │              │               │                  │──updateCache() │
 │              │               │                  │              │
 │──switch──►   │               │                  │              │
 │         updateStorageContext(slideB)             │              │
 │              │──editor.load()────────────────────►              │
 │              │               │                  │─cache hit     │
 │              │               │                  │──grapesjsFromWidgets()
 │              │◄──gjsData─────────────────────── │              │
 │              │──editor.loadData()               │              │
 │              │               │                  │              │
 │──switch back►│               │                  │              │
 │         updateStorageContext(slideA)             │              │
 │              │──editor.load()────────────────────►              │
 │              │               │                  │─cache hit (saved widgets)
 │              │               │                  │──grapesjsFromWidgets()
 │              │◄──gjsData─────────────────────── │              │
```

---

## Key files

| File | Role |
|------|------|
| `packages/authoring-ui/src/editor/storageManager.ts` | Storage Manager — `load()`, `store()`, `courseCache`, `updateStorageContext()`, `invalidateCourseCache()` |
| `packages/authoring-ui/src/editor/initEditor.ts` | GrapesJS init — registers `'elearn-api'` Storage Manager type, `autoload:false`, `autosave:false`, `triggerAutosave` listener |
| `packages/authoring-ui/src/components/EditorCanvas.tsx` | React wrapper — calls `updateStorageContext()` + `editor.load()` on slide switch (Effect 2) |
| `packages/authoring-ui/src/api/courseApi.ts` | API client — `getCourse()`, `updateSlide()` |
| `packages/authoring-ui/src/editor/widgetConverters.ts` | `widgetsFromGrapesjs()` / `grapesjsFromWidgets()` — bidirectional converters |
| `packages/authoring-ui/src/__tests__/storageManager.test.ts` | Unit tests — T640.1 regression (no redundant GET), T640.3 multi-slide sequence |

---

## Failure modes and mitigations

| Failure | Behaviour | Mitigation |
|---------|-----------|------------|
| PATCH fails (network error) | `courseCache = null`; user sees save-error toast | Cache eviction forces fresh GET on next load; no stale data served |
| `editor.destroy()` during in-flight PATCH | PATCH resolves but `courseCache` is a dangling module var | `storageManager.ts` ignores the resolved value after destroy (context changed) |
| Two rapid stores (debounce collapsed) | Second store wins; both use `widgetsFromGrapesjs()` at call time | Debounce ensures only the last edit state is sent; no partial write |
| Slide add/delete while cache is warm | Cache has stale `slides[]` length | Callers must call `invalidateCourseCache()` after structural course mutations |

---

## Testing

Unit tests live in `packages/authoring-ui/src/__tests__/storageManager.test.ts`.

Key regression tests to keep green:

- **T640.1** — `store()` updates cache, next `load()` does not call `getCourse` again
- **T640.1** — After `store()`, cache holds the saved widgets (not the stale originals)
- **T640.3** — Multi-slide edit sequence: `getCourse` called exactly once across load → store → switch → switch back; slide A returns saved widgets after round-trip via slide B
