# Regression Testing Review — T507

**Fecha:** 2026-03-27
**Revisión:** AI Regression Testing (ai-regression-testing skill)
**Archivos analizados:**
- `packages/authoring-ui/src/editor/assetManager.ts`
- `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`
- `packages/authoring-ui/src/editor/converters.ts`
- `packages/authoring-ui/src/__tests__/assetManager.test.ts` (nuevo)
- `packages/authoring-ui/src/__tests__/converters.test.ts` (ampliado)

---

## Resumen ejecutivo

Durante la revisión de la sesión v0.5.1 se identificaron **2 bugs activos** (ambos
corregidos en este ciclo) y **2 gaps de cobertura de tests** que exponen regresiones
silenciosas típicas del desarrollo asistido por IA. Se añadieron 15 tests de regresión
nuevos para blindar los caminos críticos.

**Bugs activos:** 2 FIXED
**Gaps de cobertura:** 2 cerrados (tests añadidos)

---

## Issues

### BUG-T507-01 — Pérdida de datos en cambio de slide (CRITICAL — FIXED)

**Archivo:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`
**Severidad:** CRITICAL
**Estado:** FIXED en v0.5.1

**Descripción:**
Las ediciones de widgets (posición, tamaño, estilos, contenido) se perdían
silenciosamente cuando el usuario navegaba a otro slide antes de que disparase
el debounce de guardado automático (2 segundos). El guardado automático está
implementado en `initEditor.ts` con un `setTimeout` de 2000 ms tras el evento
`storage:store`. Sin embargo, el guard `CRITICAL-01` en `storageManager.ts`
aborta el guardado si el `storageContext` ya apunta al nuevo slide — exactamente
lo que ocurría antes del fix: `updateStorageContext` se llamaba inmediatamente,
haciendo que el debounce guardase en el slide destino en lugar del origen.

**Reproducción:**
1. Abrir un curso con al menos dos slides.
2. Seleccionar slide 1, mover un widget.
3. Hacer clic en slide 2 **antes de 2 segundos**.
4. Volver a slide 1 → el widget está en su posición original.

**Causa raíz:**
`EditorCanvas` llamaba `updateStorageContext({ courseId, slideId })` antes de
`editor.store()`, por lo que el guard de contexto del storage manager abortaba
el guardado sobre el slide incorrecto.

**Fix aplicado:**
`EditorCanvas` ahora captura `prevContextRef.current` al inicio del efecto y,
si detecta un cambio real de slide dentro del mismo curso, llama a
`await editor.store()` **antes** de actualizar el contexto. Un `AbortController`
previene condiciones de carrera en cambios rápidos de slide.

```typescript
// Antes (buggy):
updateStorageContext({ courseId, slideId })
editor.load()

// Después (fixed):
if (isSlideSwitchWithinCourse) {
  await editor.store()   // guarda el slide ANTERIOR con contexto aún correcto
}
updateStorageContext({ courseId, slideId })
editor.load()
```

---

### BUG-T507-02 — Activos subidos no aparecían en el Asset Manager de GrapesJS (HIGH — FIXED)

**Archivo:** `packages/authoring-ui/src/editor/assetManager.ts`
**Severidad:** HIGH
**Estado:** FIXED en v0.5.1

**Descripción:**
Los ficheros subidos desde el Asset Manager del editor se almacenaban
correctamente en Garage (el backend respondía `201` con la URL) pero el widget
de imagen del canvas no se actualizaba y la lista del AM no mostraba el activo
recién subido. El mecanismo `autoAdd: true` de GrapesJS requiere que `customFetch`
resuelva con una **cadena de texto JSON**, no con un objeto ni con un `Response`.
El código anterior usaba `uploadFile` (hook personalizado), que no es compatible
con `autoAdd`.

**Causa raíz:**
GrapesJS ejecuta internamente:

```javascript
fetchResult.then(text =>
  onUploadResponse(text, clb)     // espera string
)
// onUploadResponse: json = JSON.parse(text); target.add(json.data)
```

El hook `uploadFile` retornaba un array de URLs directamente (no un string JSON),
por lo que `json.data` era `undefined` y `target.add(undefined)` era un no-op
silencioso.

**Fix aplicado:**
Reemplazado `uploadFile` por `customFetch` (API nativa de GrapesJS) que:
1. Inyecta el Bearer token en el header `Authorization`.
2. Mapea el envelope del backend `{ success, data: { url } }` →
   string JSON `{ data: [url] }` que GrapesJS puede parsear directamente.
3. Rechaza con `resp.text()` en caso de error no-2xx, igualando el comportamiento
   estándar de GrapesJS.

```typescript
// Camino crítico — debe devolver STRING, no objeto ni Response:
return JSON.stringify({ data: [body.data.url] })
```

---

### GAP-T507-03 — Sin tests para `assetManager.customFetch` (REGRESSION GAP — CLOSED)

**Archivo:** `packages/authoring-ui/src/__tests__/assetManager.test.ts`
**Severidad:** HIGH (riesgo de regresión silenciosa)
**Estado:** Tests añadidos (15 tests nuevos)

**Descripción:**
`assetManager.ts` no tenía ningún test. La transformación de respuesta
`{ data: { url } }` → `JSON.stringify({ data: [url] })` es un contrato implícito
con GrapesJS que un revisor de IA no puede validar visualmente. Cualquier
refactor que devuelva un objeto en lugar de un string rompe la integración sin
lanzar ningún error en compilación ni en lint.

**Patrón de regresión (AI blind spot):**
Este es el patrón más frecuente en desarrollo asistido por IA: el modelo cambia
la forma de la respuesta del backend (p. ej. `url` → `src`) y actualiza el
handler, pero al revisarlo en el mismo contexto asume que ambos extremos están
alineados.

**Tests añadidos:**

| Test | Regresión que previene |
|---|---|
| `customFetch` devuelve un string | Refactor que retorna objeto/Response |
| `parsed.data` es un array | GrapesJS `target.add(json.data)` recibe undefined |
| `data[0]` es la URL del backend | Renombrado del campo `url` → `src` / `path` en backend |
| Header `Authorization: Bearer` inyectado | Token omitido → 401 silencioso |
| Sin token → sin header `Authorization` | Error si se pasa `undefined` como header |
| Error 4xx → rechaza con `resp.text()` | Divergencia con path estándar de GrapesJS |
| Error 500 → rechaza con `resp.text()` | Misma razón |

---

### GAP-T507-04 — Round-trip de widgets de pregunta con `extendedProperties: {}` no testado (REGRESSION GAP — CLOSED)

**Archivo:** `packages/authoring-ui/src/__tests__/converters.test.ts`
**Severidad:** MEDIUM (riesgo de regresión silenciosa)
**Estado:** Tests añadidos (3 tests nuevos)

**Descripción:**
`converters.ts:grapesjsFromWidgets` contiene lógica especial para los tipos
`question-mc`, `question-tf` y `question-fill`: usa los datos de
`extendedProperties` para generar un HTML de preview, pero si
`extendedProperties` está vacío, cae en el valor por defecto (`MC_DEFAULT_EXTENDED`,
etc.). El round-trip era correcto (guarda `w.extendedProperties` en
`def.extendedProperties`, separado del contenido HTML), pero el comportamiento
no estaba cubierto por ningún test.

**Regresión que previene:**
Si en un futuro refactor se escribe `def.extendedProperties = ep` (el valor
calculado del preview) en lugar de `def.extendedProperties = w.extendedProperties`,
todos los widgets de pregunta recién colocados (con `extendedProperties: {}`)
serían reemplazados por los defaults en cada ciclo load/save. El bug sería
invisible hasta que el usuario abriera el panel de propiedades de la pregunta.

**Tests añadidos:**

```typescript
it('question-mc con extendedProperties:{} preserva {} (no MC_DEFAULT_EXTENDED)')
it('question-tf con extendedProperties:{} preserva {}')
it('question-fill con extendedProperties:{} preserva {}')
```

---

## Tests añadidos — resumen

| Archivo | Tests nuevos | Descripción |
|---|---|---|
| `src/__tests__/assetManager.test.ts` | 15 | Contrato completo de `buildAssetManagerConfig` y `customFetch` |
| `src/__tests__/converters.test.ts` | 3 | Round-trip de tipos de pregunta con `extendedProperties: {}` |
| **Total** | **18** | |

Suite completa tras los cambios: **506 tests pasando** (antes: 488).

---

## Resumen por severidad

| Severidad | Bugs activos | Gaps de cobertura |
|---|---|---|
| CRITICAL | 1 (FIXED) | — |
| HIGH | 1 (FIXED) | 1 (CLOSED) |
| MEDIUM | — | 1 (CLOSED) |
| LOW | — | — |

---

## Recomendaciones para futuras revisiones

1. **Ejecutar la suite de tests como primer paso de cada bug-check** — los tests
   automáticos detectan el patrón AI blind spot antes de la revisión de código.

2. **Añadir test inmediatamente después de encontrar un bug**, antes de corregirlo
   si es posible. Nombrar el test con la referencia del bug (p. ej. `BUG-T507-02
   regression`).

3. **Vigilar la paridad sandbox/producción** — el patrón más frecuente de
   regresión de IA es corregir un camino (p. ej. producción) y olvidar el
   gemelo (sandbox / mock). En este proyecto aplica a `storageManager.ts`:
   el path de contexto vacío (`courseId === ''`) y el path normal deben devolver
   la misma forma de datos.
