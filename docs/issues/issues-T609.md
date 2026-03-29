# Issues — T609: GrapesJS Concurrent Load Race Fix + E2E Infrastructure

**Fecha:** 2026-03-28
**Revisión:** E2E debugging + AI Regression Testing
**Archivos analizados:**
- `e2e/pages/EditorPage.ts`
- `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`
- `e2e/tests/question-widget.spec.ts` (T601.0a)
- `e2e/tests/persistence.spec.ts` (GAP-03)

---

## Resumen ejecutivo

Dos tests de la suite Playwright fallaban de forma sistemática en entornos con
el curso cargando slides desde la base de datos:

- `T601.0a` — "Multiple Choice block is visible in the Questions category"
- `GAP-03` — "widgets on a slide survive page reload"

La raíz era una condición de carrera en el ciclo de vida del editor GrapesJS:
`EditorPage.goto()` retornaba tras ver la toolbar visible, pero antes de que
`editor.load()` completase. El `beforeEach` que llama a `addSlide()` inmediatamente
después de `goto()` disparaba un segundo `editor.load()` mientras el primero
seguía en vuelo. GrapesJS no soporta llamadas concurrentes a `editor.load()` en
la misma instancia.

**Bugs activos:** 2 FIXED
**Tests desbloqueados:** 2 (T601.0a, GAP-03)

---

## Issues

### BUG-T609-01 — `goto()` retornaba antes de que `editor.load()` completase (CRITICAL — FIXED)

**Archivos:**
- `e2e/pages/EditorPage.ts` — `goto()`
- `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` — Effect 2

**Severidad:** CRITICAL
**Estado:** FIXED

**Descripción:**

`EditorPage.goto()` navegaba a `/` y esperaba que el botón "Publish SCORM" fuese
visible (`waitForReady()`), pero ese botón pertenece a la toolbar que aparece en
cuanto la UI React monta, independientemente de si GrapesJS ha terminado de
cargar el slide. En cualquier curso con al menos un slide ya existente:

1. La UI monta → toolbar visible → `goto()` retorna.
2. GrapesJS detecta el slide activo → dispara `editor.load()` (gen=N).
3. `beforeEach` llama a `addSlide()` → el backend crea un nuevo slide → React
   actualiza el estado → **Effect 2 vuelve a dispararse** → segundo `editor.load()`
   (gen=N+1) mientras el primero sigue procesando sus callbacks.

GrapesJS crashea internamente:

```
TypeError: Cannot read properties of undefined (reading 'forEach')
  at Editor.load (grapesjs/src/editor/index.ts)
```

El `loadGenRef` (contador de generación, añadido en la sesión anterior) prevenía
que el `.then()` de gen=N llamase a `setIsReady(true)` después de gen=N+1, pero
eso hacía que `waitForCanvas()` se bloqueara indefinidamente porque el `.then()`
legítimo de gen=N+1 nunca llegaba a dispararse correctamente (el crash lo abortaba).
El resultado eran tests que colgaban hasta timeout.

**Reproducción:**
1. Tener un curso con al menos 1 slide en la base de datos.
2. `goto()` → la toolbar aparece.
3. Inmediatamente `addSlide()` → segundo `editor.load()` en vuelo.
4. Crash de GrapesJS + timeout en `waitForCanvas()`.

**Causa raíz:**

`waitForReady()` sólo confirma que la toolbar está visible, no que el canvas haya
terminado de cargar. En un curso con slides, `editor.load()` empieza tan pronto
como el canvas iframe se monta, lo cual ocurre antes de que `goto()` retorne.

**Fix aplicado en `EditorPage.goto()`:**

```typescript
async goto() {
  await this.page.goto('/')
  await this.waitForReady()
  // Si el curso ya tiene slides el iframe aparece e editor.load() arranca
  // inmediatamente. Esperamos a que termine antes de retornar, para que
  // beforeEach (addSlide()) no dispare un segundo load() concurrente.
  const iframe = this.page.locator('iframe.gjs-frame')
  const appeared = await iframe.waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true).catch(() => false)
  if (appeared) {
    await this.page.locator('[data-editor-ready="true"]')
      .waitFor({ state: 'attached', timeout: 15_000 })
  }
}
```

**Por qué funciona:**

`data-editor-ready="true"` se establece en el `then()` de `editor.load()` en
Effect 2 de `EditorCanvas.tsx` (con guard de generación). Al esperar este atributo,
`goto()` garantiza que gen=N ha completado antes de retornar. Cuando `addSlide()`
dispara gen=N+1, el primero ya no está en vuelo y no hay concurrencia.

---

### BUG-T609-02 — `loadGenRef` generation counter bloqueaba `waitForCanvas()` bajo carga (HIGH — FIXED)

**Archivo:** `packages/authoring-ui/src/components/editor/EditorCanvas.tsx`

**Severidad:** HIGH
**Estado:** FIXED (como efecto colateral del fix T609-01)

**Descripción:**

El `loadGenRef` fue añadido para prevenir que el `.then()` de una carga anterior
llamase a `setIsReady(true)` sobre el slide equivocado. Sin embargo, cuando
`editor.load()` crasheaba por la concurrencia (gen=N en vuelo + gen=N+1 disparado),
el `.catch()` de gen=N capturaba el error pero el `if (loadGenRef.current === gen)`
era `false` (gen ya era N+1), por lo que **ni el `.then()` ni el `.catch()` de
gen=N+1 llamaban a `setIsReady(true)`**. El fallback timer de 8 segundos era la
única salida, causando timeouts en la suite.

**Mecanismo del guard (se mantiene como capa de seguridad):**

```typescript
// EditorCanvas.tsx — Effect 2
const gen = ++loadGenRef.current

editor.load(storageOptions).then(() => {
  clearTimeout(fallbackTimer)
  if (loadGenRef.current === gen) {       // sólo el load más reciente activa isReady
    setTimeout(() => setIsReady(true), 150)
  }
}).catch((err) => {
  clearTimeout(fallbackTimer)
  if (loadGenRef.current === gen) {       // idem en el camino de error
    setIsReady(true)
  }
})

// Fallback: si el .then() nunca llega (crash, network), isReady se fuerza a true
fallbackTimer = setTimeout(() => {
  if (loadGenRef.current === gen) setIsReady(true)
}, 8000)
```

El contador es ahora una **capa de seguridad** (previene doble `setIsReady(true)`
en cambios de slide legítimos) en lugar del mecanismo principal. El fix principal
es T609-01.

---

## Tests desbloqueados

### T601.0a — "Multiple Choice block is visible in the Questions category"

**Archivo:** `e2e/tests/question-widget.spec.ts`

Antes: fallaba con timeout en `waitForCanvas()` porque el crash de GrapesJS
impedía que `data-editor-ready="true"` apareciera.

Después del fix: pasa de forma determinista. El bloque "Multiple Choice" se
localiza en el Block Manager bajo la categoría "Questions".

```typescript
test('T601.0a — Multiple Choice block is visible in the Questions category',
  async ({ editorPage, page }) => {
    await editorPage.blocksTab.click()
    await expect(
      page.locator('.gjs-block').filter({ hasText: 'Multiple Choice' })
    ).toBeVisible({ timeout: 15_000 })
  }
)
```

---

### GAP-03 — "widgets on a slide survive page reload"

**Archivo:** `e2e/tests/persistence.spec.ts`

Antes: la carrera hacía que el componente añadido por `addComponentViaEditor()`
fuera borrado cuando el segundo `editor.load()` (el del slide recién creado)
completaba y sobreescribía el estado del canvas.

Después del fix: el componente se persiste correctamente y sobrevive a un
`page.reload()` completo.

```typescript
test('GAP-03 — widgets on a slide survive page reload', async ({ editorPage, page }) => {
  const slides = page.locator('[data-testid="slide-item"]')
  const ourSlideIndex = (await slides.count()) - 1

  // Añadir un rectángulo al canvas
  await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
  await expect(
    editorPage.canvasComponent('[data-gjs-type="rectangle"]')
  ).toBeVisible({ timeout: 15_000 })

  // Esperar autosave y recargar
  await page.waitForTimeout(3000)
  await page.reload()
  await editorPage.waitForReady()

  // Volver al slide y verificar que el widget sigue ahí
  await slides.nth(ourSlideIndex).click()
  await editorPage.waitForCanvas()
  await expect(
    editorPage.canvasComponent('[data-gjs-type="rectangle"]')
  ).toBeVisible({ timeout: 15_000 })
})
```

---

## Patrón de regresión documentado

Este bug es un caso clásico de **"infraestructura E2E que no espera suficiente"**:

```
waitForReady() ← espera toolbar (incorrecto — no confirma editor.load())
waitForCanvas() ← espera data-editor-ready="true" (correcto — pero DESPUÉS de goto())
```

La lección: en apps con inicialización asíncrona multi-etapa (React mount →
GrapesJS init → editor.load()), cada nivel de "listo" es distinto y hay que
esperar el nivel correcto según la acción siguiente.

**Regla documentada en `feedback_e2e_patterns.md`:**

> `goto()` must wait for `data-editor-ready="true"` before returning. Do not
> remove the extra wait or simplify back to just `waitForReady()`.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `e2e/pages/EditorPage.ts` | `goto()` espera `[data-editor-ready="true"]` cuando el iframe es visible |
| `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` | `loadGenRef` generation counter (capa de seguridad, no eliminado) |
| `C:\Users\jose_\.claude\projects\D--dev-git-elearn-studio\memory\feedback_e2e_patterns.md` | Nuevas entradas: patrón `goto()` y patrón `loadGenRef` |

---

## Resumen por severidad

| Severidad | Bugs activos | Tests desbloqueados |
|-----------|-------------|---------------------|
| CRITICAL  | 1 (FIXED)   | 2 (T601.0a, GAP-03) |
| HIGH      | 1 (FIXED)   | —                   |
| MEDIUM    | —           | —                   |
| LOW       | —           | —                   |
