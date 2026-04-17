# Decision: Replace storageManager module singletons with injected StorageContextProvider

**Date:** 2026-04-17  
**Task:** T645  
**Status:** Approved (guardrails applied 2026-04-17)

## Context

`packages/authoring-ui/src/editor/storageManager.ts` exposes two module-level mutable
singletons:

```typescript
const storageContext: StorageOptions = { courseId: '', slideId: '' }
let courseCache: { courseId: string; doc: CourseDoc } | null = null
```

`storageContext` is written by `updateStorageContext()` (called from EditorCanvas.tsx
and initEditor.ts) and read inside the GrapesJS `load()` / `store()` closures and by
the autosave race-condition guard in initEditor.ts. Because it lives at module scope,
React cannot subscribe to changes, and courseId/slideId can desync from the props that
EditorCanvas receives.

## Options Evaluated

### A — Pass context as argument to store/load

Re-register the GrapesJS storage type on every slide switch so the closure captures
fresh `courseId`/`slideId`, or inject a getter callback into `registerStorageManager`.

**Rejected.** The GrapesJS `StorageManager` API calls `load()`/`store()` internally
with no mechanism for runtime argument injection. Re-registering on slide switch is
undocumented and fragile. Injecting a getter callback is structurally identical to the
current singleton — it just moves the mutation one level up.

### B — Move context to Zustand (with dependency inversion) ✅ Selected

Add `courseId`, `slideId`, `cacheVersion`, and actions to `useEditorStore`.
Inject a `StorageContextProvider` interface into `registerStorageManager` so that
`storageManager.ts` has zero knowledge of Zustand or React.

**Selected.** Rationale:

1. **Race-condition guard preserved via synchronous `getContext()`**: `getState()` is
   already used in initEditor.ts (line 433). The snapshot pattern translates directly
   through the provider interface:
   ```typescript
   const snapshot = provider.getContext()       // sync, atomic
   autosaveTimer = setTimeout(async () => {
     const current = provider.getContext()      // re-read after gap
     if (current.courseId !== snapshot.courseId ||
         current.slideId  !== snapshot.slideId) return
     // ...
   })
   ```

2. **`invalidateCourseCache` stays O(1) synchronous**: callers dispatch
   `bumpCacheVersion()` to Zustand (synchronous). Zustand notifies the adapter's
   subscriber synchronously within the same call stack. The adapter's callback sets
   `courseCache = null` inside `storageManager.ts`. Net effect: same O(1) synchronous
   semantics, no async gap.

3. **Dependency inversion**: `storageManager.ts` imports neither Zustand nor
   `useEditorStore`. The interface is defined in `storageManager.ts`; the Zustand
   implementation lives in the adapter created by `initEditor.ts`.

4. **Unified context update path**: both `initEditor.ts` and `EditorCanvas.tsx` call
   the same Zustand action `setEditorContext({ courseId, slideId })`.

5. **GrapesJS contract unchanged**: `load()` and `store()` signatures are unmodified;
   context is resolved via the provider closure.

### C — React ref passed down from EditorCanvas

**Rejected.** Couples `initEditor.ts` (a pure TS module) to React's `RefObject`.
Relocates the singleton to a component-owned ref without gaining reactivity. Sibling
components (TopToolbar, SlideList) cannot update context without prop-drilling or a
context provider, creating hidden coupling.

## Guardrails (all binding)

| # | Rule |
|---|---|
| G1 | Race-guard `snapshot → await → verify → abort` MUST be preserved. Provider exposes `getContext()` as a synchronous, atomic read. |
| G2 | `storageManager.ts` MUST NOT import Zustand or `useEditorStore`. A `StorageContextProvider` is injected via `registerStorageManager(editor, provider)`. |
| G3 | `invalidateCourseCache()` stays O(1) synchronous. Callers dispatch `bumpCacheVersion()` to Zustand; the adapter callback clears `courseCache` within the same call stack. |
| G4 | The two `updateStorageContext()` call sites are unified into one Zustand action `setEditorContext({ courseId, slideId })`. |
| G5 | GrapesJS adapter implements `load(): Promise<any>` and `store(): Promise<any>` with no additional parameters. Context resolved via provider closure. |

## Approved Design

### Interface (defined in `storageManager.ts`)

```typescript
export interface StorageContextProvider {
  getContext(): Readonly<StorageOptions>
  onCacheInvalidate(callback: () => void): () => void  // returns unsubscribe fn
}
```

### Zustand store additions (`editorStore.ts`)

```typescript
courseId: string          // init: ''
slideId: string           // init: ''
cacheVersion: number      // init: 0
setEditorContext: (opts: StorageOptions) => void
bumpCacheVersion: () => void
```

### Adapter (created in `initEditor.ts`, owns the Zustand import)

```typescript
const provider: StorageContextProvider = {
  getContext() {
    const { courseId, slideId } = useEditorStore.getState()
    return { courseId, slideId }
  },
  onCacheInvalidate(callback) {
    return useEditorStore.subscribe(
      state => state.cacheVersion,
      () => callback()
    )
  },
}
registerStorageManager(editor, provider)
```

### storageManager.ts changes

- **Remove**: `storageContext` singleton, `updateStorageContext()`, `getStorageContext()`
- **Remove**: `invalidateCourseCache()` public export (cache cleared via provider callback)
- **Change**: `registerStorageManager(editor)` → `registerStorageManager(editor, provider)`
- **Add**: `StorageContextProvider` interface export
- **Keep**: `courseCache` (module-level, private), `generateThumbnail()`, the GrapesJS adapter implementation

### Caller changes

| File | Before | After |
|---|---|---|
| `initEditor.ts:248` | `updateStorageContext({ courseId, slideId })` | `useEditorStore.getState().setEditorContext({ courseId, slideId })` |
| `initEditor.ts:241` | `registerStorageManager(editor)` | `registerStorageManager(editor, provider)` |
| `initEditor.ts:417-420` | `getStorageContext()` × 2 | `provider.getContext()` × 2 |
| `EditorCanvas.tsx:197` | `updateStorageContext({ courseId, slideId })` | `useEditorStore.getState().setEditorContext({ courseId, slideId })` |
| `TopToolbar.tsx:49,94,114` | `invalidateCourseCache()` | `useEditorStore.getState().bumpCacheVersion()` |
| `SlideList.tsx:53,74,96` | `invalidateCourseCache()` | `useEditorStore.getState().bumpCacheVersion()` |

## Design Review Q&A

**¿Por qué se descarta pasar context como argumento a load/store?**  
Rompe el contrato de `StorageManager` de GrapesJS: `load()` y `store()` son invocados
internamente por GrapesJS sin parámetros del caller. Añadir parámetros obliga a
monkey-patching frágil del StorageManager internal o a re-registrar el tipo en cada
slide switch. Ambos caminos son undocumented y rompen en actualizaciones de GrapesJS.

**¿Cómo se garantiza atomicidad en la lectura del contexto durante store()?**  
`provider.getContext()` llama a `useEditorStore.getState()` — lectura síncrona del
estado actual de Zustand, sin closures de renders anteriores. JS es single-threaded:
entre la llamada a `getContext()` y el inicio del `await courseApi.updateSlide(...)`,
ningún otro código puede modificar el store. El race-guard captura el snapshot
*antes* del await y lo compara *después* — si difieren, el save se aborta.

**¿Cómo se maneja `invalidateCourseCache()` sin async/await?**  
Callers llaman `bumpCacheVersion()` en Zustand (síncrono). Zustand notifica a sus
suscriptores síncronamente dentro del mismo `setState`. El adapter tiene un suscriptor
registrado vía `onCacheInvalidate` que ejecuta `courseCache = null` en el mismo call
stack. Net result: O(1), sin microtask gap, sin `await`.

**¿Qué pasa si EditorCanvas cambia slide mientras `store()` está pending?**  
El race-guard en `triggerAutosave` (initEditor.ts) captura `slideId` antes del
`setTimeout`. Cuando el timer dispara, `provider.getContext()` lee el estado actual.
Si el `slideId` difiere, el handler retorna sin llamar `editor.store()`. Si `store()`
ya está en vuelo (el `await courseApi.updateSlide` está pendiente), la request completa
pero el cache update usa el `slideId` del snapshot — el cache se invalida si no coincide
con `courseCache.courseId`, evitando corrupción silenciosa.

**¿Cómo se prueba la race condition en CI?**  
Test de integración en `storageManager.test.ts`: mock de `courseApi.updateSlide` con
`delay artificial` (e.g. `vi.useFakeTimers()` + `Promise`). Secuencia:

```typescript
// 1. Trigger autosave (snapshot courseId='A', slideId='s1')
triggerAutosave()
// 2. Durante el debounce, cambiar contexto
useEditorStore.getState().setEditorContext({ courseId: 'A', slideId: 's2' })
// 3. Avanzar timers
vi.runAllTimersAsync()
// 4. Verificar que updateSlide NO fue llamado
expect(courseApi.updateSlide).not.toHaveBeenCalled()
```

## Risks

- **Zustand subscriber timing**: Zustand's `subscribe()` with a selector fires synchronously
  within `setState`. This guarantees `courseCache = null` is set before any subsequent
  synchronous read of `courseCache` in the same call stack. No async gap is introduced.
- **Provider lifetime**: The `onCacheInvalidate` unsubscribe function must be called in
  the editor cleanup (alongside `editor.destroy()`). `initEditor.ts` returns a cleanup
  fn — add the unsubscribe there.
- **Subscriber re-renders**: Components subscribing to `courseId`/`slideId` will re-render
  on slide switch. New subscribers must use a Zustand selector to avoid over-rendering.
