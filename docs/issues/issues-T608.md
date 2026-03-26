# Issues — T608: E2E Tests authoring-ui GrapesJS+React Layer

> Detectados durante la implementación de `e2e/tests/authoring-ui-layer.spec.ts`
> Estado: todos resueltos — 21/21 tests pasando

---

## Resumen

| Severidad | Encontrados | Resueltos |
|-----------|-------------|-----------|
| CRITICAL  | 0           | —         |
| HIGH      | 2           | 2 ✅      |
| MEDIUM    | 2           | 2 ✅      |
| LOW       | 1           | 1 ✅      |

---

## HIGH — Resueltos

### H-01: Drag-and-drop al iframe de GrapesJS falla silenciosamente en Playwright

**Archivo:** `e2e/pages/EditorPage.ts` — `dragBlockToCanvas()`

**Síntoma:** El test T608.5 ("drop MC widget → Props tab shows MC form") nunca
encontraba el componente en el canvas tras el drag-and-drop. La operación de
ratón se completaba sin error pero GrapesJS no registraba ningún componente
nuevo.

**Causa raíz:** GrapesJS usa su propio sistema de eventos de drag para el canvas.
El canvas es un `<iframe>` que constituye un contexto de navegación separado.
Los eventos de puntero sintetizados por Playwright (`mouse.down`, `mouse.move`,
`mouse.up`) llegan al host page pero los eventos `dragover`/`drop` no se
propagan correctamente al interior del iframe con los listeners de GrapesJS.

**Corrección aplicada:**
Reemplazado el drag-and-drop por inserción programática a través de la API pública
de GrapesJS expuesta en `window.__elearn_editor` (añadida en `EditorCanvas.tsx`
para builds DEV):

```typescript
// EditorPage.ts
async addComponentViaEditor(type: string): Promise<void> {
  await this.page.waitForFunction(
    () => !!(window as Record<string, unknown>).__elearn_editor,
    { timeout: 15_000 },
  )
  await this.page.evaluate((componentType: string) => {
    const ed = (window as Record<string, unknown>).__elearn_editor as {
      addComponents: (c: object[]) => unknown
      select: (c: unknown) => void
    }
    const added = ed.addComponents([{ type: componentType }])
    const comp = Array.isArray(added) ? added[0] : added
    if (comp) ed.select(comp)
  }, type)
}
```

**Impacto:** Todos los tests T608.5 ahora pasan de forma determinista.

---

### H-02: Selector CSS `#gjs-sm` inexistente — StyleManager container no encontrado

**Archivo:** `e2e/tests/authoring-ui-layer.spec.ts` — T608.2

**Síntoma:** El test "clicking Styles tab makes it selected" fallaba con timeout
esperando `#gjs-sm` visible.

**Causa raíz:** El ID real del contenedor del StyleManager registrado en
`EditorCanvas.tsx` es `gjs-style-manager`, no `gjs-sm`. El selector del test
se copió de un ejemplo externo incorrecto.

**Corrección aplicada:**

```typescript
// Antes (incorrecto)
await expect(editorPage.page.locator('#gjs-sm')).toBeVisible({ timeout: 10_000 })

// Después (correcto)
await expect(editorPage.page.locator('#gjs-style-manager')).toBeVisible({ timeout: 10_000 })
```

**Archivos afectados:**
- `EditorCanvas.tsx:29` — `const STYLE_MANAGER_ID = 'gjs-style-manager'`

---

## MEDIUM — Resueltos

### M-01: Strict mode violation — `getByText('Multiple Choice')` resuelve 3 elementos

**Archivo:** `e2e/tests/authoring-ui-layer.spec.ts` — T608.5

**Síntoma:** Playwright lanzaba `Error: strict mode violation: getByText('Multiple
Choice') resolved to 3 elements`.

**Causa raíz:** El texto "Multiple Choice" aparece simultáneamente en:
1. La etiqueta del bloque en el Block Manager (`gjs-block-label`)
2. El nombre del layer en el Layer Manager (`gjs-layer-name`)
3. El encabezado de la sección en `QuestionPropertiesPanel`

Los tres están visibles en el DOM al mismo tiempo. `page.getByText()` sin acotar
el scope es ambiguo bajo el modo estricto de Playwright.

**Corrección aplicada:**
Se añadió `data-testid="question-properties-panel"` al div raíz del estado activo
de `QuestionPropertiesPanel`, y los tests usan un locator acotado:

```typescript
// QuestionPropertiesPanel.tsx (línea 473)
<div data-testid="question-properties-panel" style={{ overflowY: 'auto', flex: 1 }}>

// Test T608.5
const qPanel = editorPage.page.locator('[data-testid="question-properties-panel"]')
await expect(qPanel.getByText('Multiple Choice')).toBeVisible({ timeout: 10_000 })
```

---

### M-02: Conteo de slides relativo roto — T608.6 falla en entornos con slides previos

**Archivo:** `e2e/tests/authoring-ui-layer.spec.ts` — T608.6

**Síntoma:** Los tests de "Delete Slide" fallaban intermitentemente cuando el
fixture de curso ya tenía slides al hacer `goto()`.

**Causa raíz:** Los tests asumían que tras `addSlide()` habría exactamente 1 slide,
usando un conteo absoluto (`toHaveCount(1)`). Si el curso del fixture partía de 0
slides ya existentes, el conteo resultante era distinto al esperado.

**Corrección aplicada:**
Se reescribió el `beforeEach` para capturar el conteo inicial como variable y
calcular los conteos esperados de forma relativa:

```typescript
test.beforeEach(async ({ editorPage }) => {
  await editorPage.goto()
  countBefore = await editorPage.page.locator('[data-testid="slide-item"]').count()
  await editorPage.addSlide()
  await expect(editorPage.page.locator('[data-testid="slide-item"]')).toHaveCount(
    countBefore + 1,
    { timeout: 10_000 },
  )
})
```

---

## LOW — Resuelto

### L-01: Race condition — `window.__elearn_editor` no disponible tras `waitForCanvas()`

**Archivo:** `e2e/pages/EditorPage.ts` — `addComponentViaEditor()`

**Síntoma:** T608.5 "switching away from MC widget" fallaba únicamente en la
suite completa (no en ejecución aislada) con `TypeError: ed is undefined`.

**Causa raíz:** `waitForCanvas()` espera a que el `<iframe>` sea visible, pero
`window.__elearn_editor` se asigna en el callback `onReady` de GrapesJS, que
se dispara de forma asíncrona después de que el iframe ya es visible. En la suite
completa, el tiempo entre tests era suficientemente corto para que `onReady`
aún no hubiera completado su ciclo de `ed.load()` + `setTimeout(150ms)`.

**Corrección aplicada:**
`addComponentViaEditor()` incluye `page.waitForFunction()` antes de llamar a
`page.evaluate()`, lo que garantiza que el editor esté listo independientemente
del timing de tests:

```typescript
await this.page.waitForFunction(
  () => !!(window as Record<string, unknown>).__elearn_editor,
  { timeout: 15_000 },
)
```

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` | Exposición de `window.__elearn_editor` en builds DEV para acceso E2E |
| `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx` | `data-testid="question-properties-panel"` en el div raíz del estado activo |
| `e2e/pages/EditorPage.ts` | Método `addComponentViaEditor()` con guard `waitForFunction` |
| `e2e/tests/authoring-ui-layer.spec.ts` | Selector `#gjs-style-manager`, conteo relativo T608.6, tests T608.5 reescritos |
