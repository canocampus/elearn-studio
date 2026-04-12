# T643 — Fix forEach crash: GrapesJS loadData + validateSequence unguarded iterators

**Fecha diagnóstico:** 2026-04-12  
**Síntoma:** `TypeError: Cannot read properties of undefined (reading 'forEach')`  
aparece continuamente en dev y en CI. Los tests verdes lo absorben silenciosamente vía
el `.catch()` de `EditorCanvas` que llama a `setIsReady(true)` incondicionalmente.

---

## Dos bugs independientes, mismo síntoma

### Bug A — GrapesJS `loadData()` crash (se dispara en carga de página)

**Archivos afectados:**
- `packages/authoring-ui/src/editor/converters.ts` (líneas 78-82, 165-167, 276-278)
- `packages/authoring-ui/src/editor/registerPhaserSimBlock.ts`
- `packages/authoring-ui/src/editor/registerSimBlock.ts`

**Secuencia causal:**

1. `phaser-sim` y `screenshot-sim` tienen `content: PLACEHOLDER_HTML` en sus defaults de
   modelo GrapesJS (HTML multi-elemento: `<div>` con `<svg>` y `<div>` hijos).
2. Ambos tipos **no están en `GENERATED_CONTENT_TYPES`** (set en `converters.ts:78-82`).
3. Al guardar: `widgetsFromGrapesjs()` lee `c.get('content')` → obtiene el HTML → lo escribe
   en `widget.properties.content` → persiste en MongoDB.
4. Al recargar: `grapesjsFromWidgets()` ejecuta `def.content = props.content` (línea 276-278,
   sin guard) → pasa el HTML como `content` de la definición del componente.
5. GrapesJS en `loadData()` detecta HTML con elementos → lo parsea en definiciones de
   componentes hijo (`<div>`, `<svg>`, etc.) generadas automáticamente.
6. Esas definiciones hijas **no tienen campo `actions: []`**.
7. GrapesJS llama internamente `componentDef.actions.forEach(...)` → `actions` es `undefined`
   → **TypeError**.

**Mismo camino para widgets `text`/`button` con RTE:**  
Si el usuario aplica negrita, cursiva o links al texto, `getInnerHTML()` devuelve HTML
(`<b>texto</b>`, `<a href="...">`, etc.). Se guarda en `properties.content`, se recarga
como `def.content`, GrapesJS lo parsea en child defs sin `actions` → mismo crash.

**Por qué los tests CI se ven verdes:**  
`EditorCanvas.tsx` `.catch()` llama a `setIsReady(true)` incondicionalmente (el guard
`isCancelled` fue eliminado para evitar que `waitForCanvas()` colgara). El canvas queda
en estado parcial/error pero el test continúa y pasa si no afirma sobre el contenido
específico del widget crasheado.

**Fix (T643.1):**
- Añadir `'phaser-sim'` y `'screenshot-sim'` a `GENERATED_CONTENT_TYPES`.
- Añadir guard en `grapesjsFromWidgets()` para `text`/`button`: no pasar `def.content`
  cuando el valor almacenado es markup HTML.

---

### Bug B — `validateSequence.ts` unguarded forEach (se dispara por interacción)

**Archivo afectado:**
- `packages/authoring-ui/src/utils/validateSequence.ts`

**Tres llamadas sin guard:**

| Línea | Código | Condición de crash |
|---|---|---|
| 90 | `action.params.then.forEach(...)` | `then` undefined (action sequences antiguas) |
| 102 | `action.params.body.forEach(...)` | `body` undefined (loop actions antiguas) |
| 129 | `sequence.actions.forEach(...)` | `actions` undefined (sequences antiguas) |

**Por qué ocurre:**  
Los tipos en `shared-types/src/actions.ts` declaran `then: Action[]`, `body: Action[]` y
`actions: Action[]` como campos requeridos (no opcionales). TypeScript los garantiza en
escritura nueva, pero documentos MongoDB guardados **antes de que esos tipos existieran**
pueden tener esos campos ausentes en runtime.

**Cuándo se dispara:**  
Solo cuando el usuario selecciona un widget en GrapesJS → `ActionsPanel` renderiza →
llama `validateAllSequences`. NO ocurre en carga de página, requiere interacción.

**Cuándo aparece en CI:**  
Tests `GAP-02.1`, `GAP-02.2`, `GAP-02.3` de `e2e/tests/action-sequence.spec.ts` añaden
widgets y abren la pestaña Actions → activan `validateAllSequences`.

**Fix (T643.2):**
- Línea 90: `action.params.then?.forEach(...)`
- Línea 102: `action.params.body?.forEach(...)`
- Línea 129: `sequence.actions?.forEach(...)`

---

## Subtasks

| ID | Descripción | Estado |
|---|---|---|
| T643.1 | Fix Bug A: `GENERATED_CONTENT_TYPES` + guard HTML en `grapesjsFromWidgets()` | [x] done — 2026-04-12 |
| T643.2 | Fix Bug B: `?.forEach()` en `validateSequence.ts` líneas 90, 102, 129 | [x] done — 2026-04-12 |
