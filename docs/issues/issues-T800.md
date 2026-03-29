# Análisis de Bugs de Persistencia — T800

**Fecha:** 2026-03-29
**Revisión:** Análisis profundo de la pila de guardado y persistencia
**Archivos analizados:**
- `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`
- `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`
- `packages/authoring-ui/src/editor/storageManager.ts`
- `packages/authoring-ui/src/editor/initEditor.ts`
- `packages/authoring-ui/src/editor/converters.ts`
- `backend/api/src/routes/courses.ts`

---

## Resumen ejecutivo

Se identificaron **4 bugs** en la pila de guardado/persistencia, todos reproducibles sin
instrumentación especial. Los bugs son independientes entre sí pero se combinan para
producir pérdidas de datos silenciosas que el usuario experimenta como "el editor no guarda
lo que escribí".

**Estado:** 4 FIXED

---

## Issues

---

### BUG-T800-01 — Requests PATCH concurrentes sobrescriben datos (CRITICAL — FIXED)

**Archivos:** `QuestionPropertiesPanel.tsx` (MCPropertiesForm, TFPropertiesForm, FillPropertiesForm)

#### Descripción

Las tres funciones `update()` de los formularios de propiedades de preguntas llamaban
`editor?.store()` directamente en cada evento `onChange`. `store()` lee
`editor.getComponents().toArray()` de forma síncrona al inicio y luego hace un PATCH al
backend. Al escribir "Hello" (5 teclas), se generaban 5 peticiones PATCH concurrentes cuyas
snapshots eran `["H", "He", "Hel", "Hell", "Hello"]`. Si la petición 5 completaba antes que
la 1, y la 1 completaba al final, la base de datos terminaba con `"H"`.

#### Código antes del fix (patrón en los 3 formularios)

```typescript
// MCPropertiesForm / TFPropertiesForm / FillPropertiesForm — ANTES
function update(patch: Partial<MCExtendedProps>) {
  component.set('extendedProperties', { ...ep, ...patch })
  editor?.store().catch(err => console.error('[MCPropertiesForm] store failed:', err))
  //     ^^^^^^^^^^^^^^^^^ llamado en cada pulsación de tecla
}
```

#### Fix aplicado

`component.set('extendedProperties', ...)` ya dispara el evento `component:update`, que
activa el autosave con debounce de 2 s en `initEditor.ts`. No se necesita llamar a
`editor.store()` manualmente.

```typescript
// DESPUÉS — los 3 formularios
function update(patch: Partial<MCExtendedProps>) {
  component.set('extendedProperties', { ...ep, ...patch })
  // component.set() dispara component:update → autosave con debounce en initEditor.ts
  // No llamar editor.store() aquí — genera PATCHes concurrentes que se sobrescriben
}
```

También se eliminaron las variables `editor` no utilizadas en `MCPropertiesForm`,
`TFPropertiesForm` y `FillPropertiesForm`.

---

### BUG-T800-02 — Buffer de texto no volcado al cambiar de slide (HIGH — FIXED)

**Archivo:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`

#### Descripción

El camino de guardado en el cambio de slide (`saveAndLoad()` en Effect 2) llamaba
`editor.store()` directamente sin detener antes el comando `text-edit`. GrapesJS mantiene
un buffer interno de texto mientras el widget de texto está activo; ese buffer no se
persiste al modelo del componente hasta que se detiene el comando. Al llamar a
`widgetsFromGrapesjs(editor.getComponents().toArray())` con el comando activo, se leía el
estado pre-pulsación y la última cadena escrita se perdía silenciosamente.

El camino de autosave con debounce en `initEditor.ts` ya hacía esto correctamente:

```typescript
// initEditor.ts — triggerAutosave() CORRECTO
if (editor.Commands.isActive('text-edit')) {
  editor.stopCommand('text-edit')
}
await editor.store()
```

El camino de cambio de slide en `EditorCanvas.tsx` no lo hacía.

#### Fix aplicado

```typescript
// EditorCanvas.tsx — saveAndLoad() DESPUÉS
if (shouldSaveBeforeSwitch && !controller.signal.aborted) {
  try {
    // BUG-2 fix: detener text-edit antes de guardar para volcar el buffer al modelo
    if (editor.Commands.isActive('text-edit')) {
      editor.stopCommand('text-edit')
    }
    await Promise.race([
      editor.store() as Promise<unknown>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('[EditorCanvas] store() timed out after 5s')), 5000)
      ),
    ])
  } catch (err) { ... }
}
```

---

### BUG-T800-03 — Cambio de curso no dispara guardado del slide actual (HIGH — FIXED)

**Archivo:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`

#### Descripción

La condición que decide si se guarda antes de cambiar contexto era:

```typescript
const isSlideSwitchWithinCourse =
  prev !== null && prev.courseId === courseId && prev.slideId !== slideId
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                 Solo guarda si el courseId NO cambia
```

Si el usuario editaba un slide y navegaba a otro curso antes de que el debounce de 2 s
disparara, `CRITICAL-01` en `initEditor.ts` abortaba el autosave pendiente (porque
`slideId` ya había cambiado). El guardado al cambiar de slide no ocurría porque la condición
`prev.courseId === courseId` era `false`. Los cambios se perdían sin ninguna notificación.

#### Fix aplicado

La condición solo requiere que `slideId` haya cambiado respecto al contexto anterior,
independientemente del `courseId`:

```typescript
// DESPUÉS
const shouldSaveBeforeSwitch = prev !== null && prev.slideId !== slideId
```

---

### BUG-T800-04 — Fallo en PATCH invalida la caché y sirve estado antiguo (MEDIUM — FIXED)

**Archivo:** `packages/authoring-ui/src/editor/storageManager.ts`

#### Descripción

La caché en memoria (`courseCache`) se invalidaba en el bloque `finally` de `store()`,
es decir, tanto en éxito como en fallo:

```typescript
// ANTES
try {
  await courseApi.updateSlide(courseId, slideId, { widgets, thumbnail })
} catch (err) {
  console.error('[StorageManager] store() failed:', err)
  throw err
} finally {
  courseCache = null  // Se ejecuta incluso cuando el PATCH falla
}
```

Secuencia que causaba pérdida de datos:

1. Usuario edita widgets → caché tiene `[widgetA, widgetB_editado]`
2. `store()` intenta PATCH → error de red
3. `finally` → `courseCache = null`
4. Usuario cambia de slide y vuelve → `load()` ve caché vacía → hace GET al backend
5. Backend devuelve `[widgetA, widgetB_original]` (el estado anterior al fallo)
6. El editor muestra los widgets sin los cambios del usuario

Con la caché aún válida, el paso 4 habría usado el estado en memoria, que es más reciente
que lo que hay en la base de datos.

#### Fix aplicado

`courseCache = null` se mueve al camino de éxito, inmediatamente después de que `updateSlide`
resuelve. Un fallo en el PATCH deja la caché intacta.

```typescript
// DESPUÉS
try {
  await courseApi.updateSlide(courseId, slideId, { widgets, thumbnail })
  // Invalidar caché solo en éxito: un fallo de red no debe servir estado más antiguo
  courseCache = null
} catch (err) {
  console.error('[StorageManager] store() failed:', err)
  throw err
}
```

---

## Impacto combinado

Los 4 bugs actuaban de forma independiente pero podían combinarse:

- Un usuario escribiendo en un `QuestionPropertiesPanel` → BUG-01 → escritura competitiva
- Si además cambiaba de slide mientras escribía → BUG-02 → último texto no volcado
- Si el cambio era a otro curso → BUG-03 → el guardado no se ejecutaba
- Si había un error de red puntual → BUG-04 → la siguiente carga mostraba estado antiguo

---

## Tests de regresión recomendados

Añadir al archivo `e2e/tests/persistence.spec.ts`:

```typescript
test('T800-01 — editar question text no produce requests concurrentes', async ({ page }) => {
  // Interceptar PATCHes y contar los que llegan mientras se escribe
  // Escribir 5 caracteres rápido → solo 1 PATCH debe dispararse (al final del debounce)
})

test('T800-02 — texto escrito en widget se guarda al cambiar de slide', async ({ editorPage, page }) => {
  // Añadir widget de texto, escribir, cambiar de slide sin pausa, volver
  // El texto debe estar presente
})

test('T800-03 — cambio de curso guarda el slide actual', async ({ editorPage, page }) => {
  // Editar slide en curso A, navegar a curso B antes de 2s, volver a curso A
  // Los cambios deben estar presentes
})

test('T800-04 — fallo de PATCH no descarta datos en el siguiente load', async ({ page }) => {
  // Simular error de red en el PATCH, cambiar de slide y volver
  // El editor debe mostrar el estado más reciente (no el del backend)
})
```

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` | Eliminadas llamadas directas a `editor?.store()` en `MCPropertiesForm`, `TFPropertiesForm` y `FillPropertiesForm`; eliminadas variables `editor` no utilizadas |
| `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` | `isSlideSwitchWithinCourse` → `shouldSaveBeforeSwitch`; añadido `stopCommand('text-edit')` antes de `editor.store()` |
| `packages/authoring-ui/src/editor/storageManager.ts` | `courseCache = null` movido de `finally` al camino de éxito |
