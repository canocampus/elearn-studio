# Auditoría Consolidada — eLearn Studio
**Fecha:** 2026-04-01
**Fuentes:** Auditoría de código fuente (propia) + Auditoría técnica de integración +
  Auditoría estratégica de Claude Code + Auditoría GrapesJS/React (PDF)

> **INSTRUCCIÓN PARA CLAUDE CODE:** Lee este fichero completo antes de tocar
> cualquier código. Los hallazgos están ordenados por impacto. No cierres ningún
> bloque de tareas relacionado con estas áreas sin verificar el flujo completo
> end-to-end, no solo el módulo aislado.

---

## NIVEL 1 — CRÍTICO: Funcionalidades que parecen implementadas pero están rotas

### C-01 — Motor de acciones del runtime NO está cableado al player

**Impacto:** Todas las acciones definidas en el editor (show/hide, set-variable,
condition, loop, call-sequence) son silenciosamente ignoradas en el curso publicado.

El motor existe y está completo:
- `packages/runtime-player/src/actions/dispatcher.ts`
- `packages/runtime-player/src/actions/executor.ts`

Pero `packages/runtime-player/src/index.ts` no lo importa ni lo inicializa.
El player solo maneja navegación básica por `data-action`, finish/suspend y
submit de preguntas (líneas 717-733 del index.ts).

**Fix requerido:**
```typescript
// packages/runtime-player/src/index.ts — añadir en la inicialización
import { EventDispatcher } from './actions/dispatcher'
import { ActionExecutor } from './actions/executor'

// Inicializar el dispatcher con el contexto del curso
const dispatcher = new EventDispatcher(courseData, slideRenderer)
const executor = new ActionExecutor(dispatcher)
dispatcher.init()
```

**Gate de cierre:** El bloque no está terminado hasta que una secuencia
show/hide y una call-sequence sean ejecutadas por el runtime player real,
verificado con un E2E test que publique un curso con acciones y compruebe
el DOM resultante.

---

### C-02 — sharedSequences roto de extremo a extremo

**Impacto:** El editor cree que puede guardar macros/shared sequences,
pero el backend no las persiste y el runtime tampoco las recibe.

Existe en frontend:
- `packages/authoring-ui/src/types/course.ts:97-115`
- `packages/authoring-ui/src/hooks/useActionsSave.ts:29-40`

No existe en:
- `backend/api/src/models/Course.ts:82-90` — campo ausente en el schema
- `backend/api/src/models/types.ts:72-83` — tipo ausente
- `packages/runtime-player/src/index.ts:63-69` — CourseDoc no incluye sharedSequences

`call-sequence` está conceptualmente implementado pero funcionalmente muerto.

**Fix requerido:** Añadir `sharedSequences` al schema de Mongoose, al tipo
`CourseDoc` compartido, y al CourseDoc del runtime player. Parte de C-05.

---

### C-03 — SCORM export no empaqueta assets: el ZIP funciona, el LMS no

**Impacto:** Un curso con imágenes o media publicado como SCORM parece exportarse
correctamente, pero dentro del LMS los recursos apuntan a `/assets/<uuid>` del
backend (que requiere auth) en lugar de rutas locales dentro del ZIP.

El backend llama a `packSCORM12(course.toObject(), tmpDir, ...)` sin pasar
`assetPaths` (`backend/api/src/routes/courses.ts:792-797`).

El packager solo copia assets extra si se los pasan
(`packages/scorm-packager/src/index.ts:385-390`).

El runtime player usa `properties.src` directamente sin reescritura
(`packages/runtime-player/src/index.ts:241-246`, `291-299`).

**Fix requerido (4 pasos en orden):**
1. En `courses.ts`, antes de `packSCORM12`: recolectar todas las referencias
   `/assets/` del course JSON (widgets de imagen y media)
2. Descargar cada asset de Garage y escribirlo en `tmpDir/assets/`
3. Reescribir las referencias `properties.src` en el course JSON a rutas
   relativas `assets/uuid.ext`
4. Pasar el `tmpDir/assets/` al packager como `assetPaths`

**Gate de cierre:** Test E2E que publique un curso con imagen, descomprima el ZIP
y verifique que: (a) el ZIP contiene `assets/uuid.png`, (b) el HTML apunta a
`assets/uuid.png` no a `/assets/uuid.png`.

---

### C-04 — React state bug: formularios de propiedades de preguntas no reactivos

**Impacto:** BETA-01, BETA-02, BETA-03, BETA-08, BETA-09, BETA-13.
Los tres formularios (MC, TF, Fill) leen `ep` como variable plana — no como
React state. Cuando `component.set('extendedProperties', ...)` se llama,
el canvas se actualiza y el autosave se dispara, pero el formulario NO
se re-renderiza porque no hay cambio de estado React.

Confirmado por tres auditorías independientes. El fix es el mismo en las tres:

```typescript
// PATRÓN CORRECTO — aplicar a MCPropertiesForm, TFPropertiesForm, FillPropertiesForm
function MCPropertiesForm({ component }: { component: Component }) {
  const [ep, setEp] = useState<MCExtendedProps>(
    () => (component.get('extendedProperties') as MCExtendedProps | undefined)
      ?? { ...MC_DEFAULT_EXTENDED }
  )

  useEffect(() => {
    const handler = () => {
      const fresh = component.get('extendedProperties') as MCExtendedProps | undefined
      if (fresh) setEp({ ...fresh })
    }
    component.on('change:extendedProperties', handler)
    return () => { component.off('change:extendedProperties', handler) }
  }, [component])

  function update(patch: Partial<MCExtendedProps>) {
    const next = { ...ep, ...patch }
    setEp(next)                                // React re-render inmediato
    component.set('extendedProperties', next)  // canvas + autosave
  }
}
```

**Fichero:** `packages/authoring-ui/src/components/sidebar/QuestionPropertiesPanel.tsx`

---

## NIVEL 2 — ALTO: Bugs de integración que fallan en flujos reales

### A-01 — uploadAsset() no usa apiClient — falla silenciosamente al expirar token

`packages/authoring-ui/src/api/courseApi.ts:184-205` usa `fetch` directo.
El resto de llamadas van por `apiClient.ts` que hace refresh automático
del access token en 401. Cuando el token caduca, todas las llamadas del
editor siguen funcionando, pero la subida de assets falla de forma inconsistente.

**Fix:** Reescribir `uploadAsset()` usando `apiClient` con multipart,
o añadir el interceptor 401+refresh a la llamada de upload directamente.

---

### A-02 — Posicionamiento en drag inicial falla en 4 widgets (BETA-06)

`initEditor.ts` handler `component:add` añade `position: absolute` pero no
establece `left`/`top`. GrapesJS con `dragMode: 'absolute'` debería capturar
las coordenadas del drop, pero falla para `done-button`, `question-tf`,
`question-fill`, `media-player`.

**Fix:** Añadir `setTimeout(0)` fallback:
```typescript
editor.on('component:add', (component) => {
  component.set({ draggable: true, resizable: true })
  if (component.getStyle('position') !== 'absolute') {
    component.addStyle({ position: 'absolute' })
  }
  setTimeout(() => {
    const s = component.getStyle()
    if (!s['left'] || s['left'] === '0px' || s['left'] === '0') {
      component.addStyle({ left: '50px', top: '50px' })
    }
  }, 0)
})
```

---

### A-03 — Asset Manager muestra icono genérico en lugar de thumbnail (BETA-07/12)

`assetManager.ts` `customFetch` retorna `/assets/uuid.ext` como src.
El browser no puede cargar `<img src="/assets/uuid.ext">` sin Bearer token → 401.

**Fix:** Después del upload, llamar a `/assets/:objectName/presigned` y
pasar la URL presignada a GrapesJS AM. Pasar también `originalName` como `name`.
Ver patrón completo en `docs/issues/audit-BETA-R1.md`.

---

### A-04 — Media Player: sin panel de propiedades, sin asignación de media (BETA-10)

El widget `media-player` tiene traits `src` y `mediaType` en el modelo pero:
1. No hay `view` con `onRender()` que cree un `<video>`/`<audio>` real
2. No hay integración con Asset Manager para seleccionar el fichero
3. Los traits están en el panel de Styles, no en un panel de propiedades propio

---

### A-05 — DELETE /courses/:id/slides/:slideId semántica incorrecta

`backend/api/src/routes/courses.ts:643-662` — el filtro del update solo
comprueba el curso, no que `slides.id = slideId` exista. Borrar un slideId
inexistente devuelve 200. La API no puede confiar en que la UI lo proteja.

**Fix:**
```typescript
const result = await Course.findOneAndUpdate(
  { _id: courseId, 'slides.id': slideId },  // ← verificar que el slide existe
  { $pull: { slides: { id: slideId } } },
  { new: true }
)
if (!result) return res.status(404).json({ success: false, error: 'Slide not found' })
```

---

### A-06 — Reorder de slides no es atómico aunque el comentario diga que sí

`backend/api/src/routes/courses.ts:482-499` hace findOne → reorder en memoria →
findOneAndUpdate. Hay ventana de lost update entre la lectura y la escritura.
El comentario dice "atomic single write" — esto es incorrecto y engañoso.

**Fix mínimo:** Usar un campo `version` para optimistic locking, o documentar
explícitamente el riesgo en el comentario y en `WORKING_CONTEXT.md`.

---

### A-07 — /auth/login filtra mensajes internos en errores 500

`backend/api/src/routes/auth.ts:213-216` devuelve
`Internal server error: ${msg}` — expone detalles internos inconsistentes
con el manejo de errores del resto de la app.

**Fix:**
```typescript
// En lugar de:
res.status(500).json({ success: false, error: `Internal server error: ${msg}` })
// Usar:
logger.error({ err }, 'Login internal error')
res.status(500).json({ success: false, error: 'Internal server error' })
```

---

## NIVEL 3 — DEUDA TÉCNICA: Problemas estructurales

### D-01 — Tipos duplicados entre paquetes sin fuente única de verdad

Hay deriva de tipos entre `authoring-ui`, `backend/api`, `runtime-player` y
`scorm-packager`. `sharedSequences` (C-02) es el primer síntoma — habrá más.

El runtime-player conoce tipos que el authoring no registra:
`question-drop`, `question-arrange`, `question-order`
(`packages/runtime-player/src/index.ts:383-388, 499-505, 652-664`)

**Fix estratégico:** Crear un paquete compartido `packages/shared-types/` con:
- `CourseDoc`, `Slide`, `Widget`, `ActionSequence`, `SharedSequence`
- Un único `package.json` como dependencia en todos los paquetes

Mientras no se haga: cada cambio de tipo debe propagarse manualmente a los
4 paquetes — documentar este riesgo en `CLAUDE.md`.

---

### D-02 — Tests unitarios de piezas aisladas sin integración end-to-end

Patrón detectado: Claude Code implementa subsistemas y sus tests unitarios pero
no los cablea al entrypoint real. C-01 (actions engine) es el caso más grave.

Flujos end-to-end que DEBEN tener test de integración antes de marcarlos como done:
1. Guardar sharedSequences → recargar curso → confirmar persistencia
2. Exportar curso con imagen → ZIP contiene asset → HTML apunta a ruta local
3. Acción show/hide → ejecutada en runtime player real
4. Acción call-sequence → ejecutada en runtime player real
5. Token expirado → uploadAsset() sigue funcionando tras refresh
6. DELETE slide inexistente → 404

---

### D-03 — Ficheros de debug/test en raíz del repositorio

Encontrados en la raíz: `checkauth.php`, `checklockout.php`,
`debug-moodle-course.js`, `debug-moodle-login.js`, `directlogin.php`,
`disable-tours.php`, `testauth.php`, `testlogin.php`, `tracker.php`,
`boton.png`, `test.png`, `test-claude.docx`

Añadir a `.gitignore` y eliminar del repo.

---

### D-04 — openapi.json y generated.ts commiteados en git

`backend/api/openapi.json` y `packages/authoring-ui/src/api/generated.ts`
son ficheros generados que deben estar en `.gitignore`.

---

### D-05 — Rollup config temporales commiteados

`packages/runtime-player/rollup.config-177*.mjs` (4 ficheros).
Añadir `rollup.config-*.mjs` a `.gitignore` y eliminar.

---

## Orden de fix recomendado

| Orden | ID | Descripción | Fichero principal | Esfuerzo |
|---|---|---|---|---|
| 1 | C-04 | useState en formularios de preguntas | QuestionPropertiesPanel.tsx | ~2h |
| 2 | A-02 | Positioning fallback component:add | initEditor.ts | ~30min |
| 3 | A-03 | AM thumbnail presigned URL | assetManager.ts | ~1h |
| 4 | A-07 | Auth error message leak | auth.ts | ~15min |
| 5 | A-05 | DELETE slide 404 | courses.ts | ~30min |
| 6 | A-01 | uploadAsset usa apiClient | courseApi.ts | ~1h |
| 7 | A-04 | Media Player view + AM | registerBlocks.ts | ~2h |
| 8 | C-01 | Cablear actions engine al runtime | runtime-player/index.ts | ~3h |
| 9 | C-03 | SCORM export empaqueta assets | courses.ts + packager | ~4h |
| 10 | C-02 | sharedSequences backend+runtime | Course.ts + types + index.ts | ~2h |
| 11 | A-06 | Reorder documentado o corregido | courses.ts | ~1h |
| 12 | D-03/04/05 | Limpieza ficheros + .gitignore | .gitignore | ~15min |
| 13 | D-01 | Paquete shared-types | nuevo package | ~1 día |

---

## Reglas de verificación para Claude Code

Antes de cerrar cualquier tarea que toque actions, SCORM, assets o tipos:

```
[ ] ¿El cambio funciona en el flujo completo end-to-end, no solo en el módulo?
[ ] ¿Si hay un nuevo tipo, está definido en TODOS los paquetes que lo necesitan?
[ ] ¿Las acciones del editor se ejecutan en el runtime player real?
[ ] ¿El SCORM ZIP contiene los assets y las rutas son locales?
[ ] ¿uploadAsset() usa apiClient con manejo de 401?
[ ] ¿DELETE de recurso inexistente devuelve 404?
[ ] ¿Los errores 500 no filtran mensajes internos?
[ ] ¿El test E2E del flujo afectado pasa?
```

---

## NIVEL 1 — CRÍTICO: Navegación SCORM — implementación incompleta

### C-05 — Navegación condicionada por SCORM: 4 comportamientos ausentes

**Contexto:** El widget `nav-buttons` existe y funciona a nivel básico (prev/next navegan
entre slides). El suspend/resume también existe y está bien implementado (`suspend.ts`).
**Sin embargo, la integración real de la navegación con el protocolo SCORM está incompleta
en 4 aspectos críticos que definen la diferencia entre un curso de juguete y uno LMS-real.**

---

#### NAV-01 — Botón "Next" NO se bloquea cuando hay preguntas obligatorias sin responder

**Estado actual:** `goNext()` no tiene ninguna comprobación. Navega siempre al slide
siguiente sin verificar si el slide actual contiene preguntas sin responder.

```typescript
// runtime-player/src/index.ts — código actual (roto)
function goNext(state: PlayerState): void {
  if (state.currentSlide < state.course.slides.length - 1) {
    goToSlide(state, state.currentSlide + 1)  // ← navega siempre, sin gate
  }
}
```

**Comportamiento correcto:** Si un slide contiene preguntas con `scoring.mandatory: true`
(o simplemente preguntas sin responder en modo lineal estricto), el botón "Next" debe
estar desactivado hasta que todas las interacciones requeridas del slide estén completadas.

**Lo que falta:**
1. Campo `mandatory: boolean` en `QuestionScoring` (types/questions.ts)
2. Campo `navigationMode: 'free' | 'linear-strict'` en `CourseSettings` (types/course.ts)
3. Función `slideIsComplete(state, slideIndex)` que comprueba si todas las preguntas
   mandatory del slide han sido respondidas
4. En `renderSlide()`: desactivar visualmente el botón Next si el slide no está completo
5. En `handleSubmit()` y `handleWidgetScore()`: re-evaluar y re-activar el botón Next
   cuando se completa la última pregunta obligatoria del slide

**Impacto:** Sin esto, un alumno puede pasar todos los slides sin responder ninguna
pregunta. El LMS registra el curso como completado pero sin evidencia real de aprendizaje.

---

#### NAV-02 — Resume no restaura en el slide correcto de forma consistente

**Estado actual:** `suspend.ts` guarda y restaura `currentSlide` correctamente via
`cmi.suspend_data`. Pero hay dos casos no cubiertos:

1. **`lesson_location` vs `suspend_data`:** El fallback cuando no hay `suspend_data`
   lee `cmi.core.lesson_location` (línea 818), pero `lesson_location` solo guarda el
   índice del slide en `scormReport()`. Si el LMS no soporta `suspend_data` (algunos
   no lo hacen), el alumno vuelve al slide correcto pero sin sus respuestas previas.

2. **Slides visitados no se rastrean:** No existe tracking de `visitedSlides[]`.
   En modo `free navigation`, el alumno debería poder volver a cualquier slide ya
   visitado. Actualmente no hay forma de saber qué slides ha visto ya.

**Lo que falta:**
- `visitedSlides: Set<number>` en `PlayerState`
- Actualizar el set en `goToSlide()`
- En `renderNavButtons()`: deshabilitar el botón "Next" solo en slides no visitados
  cuando `navigationMode === 'linear-strict'`
- En el fallback de resume sin `suspend_data`: restaurar al menos el slide guardado
  en `lesson_location` y marcar todos los slides anteriores como visitados

---

#### NAV-03 — `CourseSettings` no tiene modo de navegación configurable

**Estado actual:**
```typescript
// authoring-ui/src/types/course.ts — incompleto
export interface CourseSettings {
  width: number
  height: number
  passingScore: number
  allowReview: boolean
  // ← no hay navigationMode ni nada relacionado con secuenciación
}
```

**Lo que falta añadir a `CourseSettings`:**
```typescript
export interface CourseSettings {
  width: number
  height: number
  passingScore: number
  allowReview: boolean
  navigationMode: 'free' | 'linear-strict'
  // 'free': alumno puede navegar libremente a cualquier slide
  // 'linear-strict': Next bloqueado hasta completar preguntas obligatorias del slide actual
  requireAllSlides: boolean
  // true: el curso no se puede marcar como completado hasta que todos los slides sean visitados
}
```

Este campo debe propagarse al runtime player (añadir a `CourseDoc` del runtime)
y al backend (añadir al schema de Mongoose).

---

#### NAV-04 — SCORM sequencing en SCORM 2004 es solo sintaxis, no lógica real

**Estado actual:** El packager genera XML de sequencing correcto para SCORM 2004
(`packages/scorm-packager/src/index.ts:157`) con `imsss:sequencing` y reglas de flow.
Pero las reglas de sequencing son estáticas y permisivas — permiten choice navigation
y flow sin restricciones:

```typescript
// scorm-packager/src/index.ts
// Linear sequencing: allow choice navigation and flow, let content set completion/success
```

El LMS respeta el XML de sequencing. Si el XML dice "libre navegación", el LMS
permitirá al alumno saltar a cualquier slide aunque no haya completado el anterior.

**Lo que falta:** El packager debe generar reglas de sequencing condicionadas por
`course.settings.navigationMode`:
- `'free'` → sequencing permisivo actual (correcto)
- `'linear-strict'` → añadir `<imsss:sequencingRules>` que bloqueen el avance
  hasta que el objetivo del SCO actual esté completado

---

### Resumen de lo que funciona vs lo que falta en navegación

| Comportamiento | Estado |
|---|---|
| Navegar prev/next entre slides | ✅ Funciona |
| Guardar posición al salir (suspend) | ✅ Funciona |
| Reanudar en el slide correcto | ✅ Parcial (suspend_data) / ⚠️ Incompleto (lesson_location fallback) |
| Bloquear "Next" con preguntas sin responder | ❌ No implementado |
| Modo de navegación configurable (libre vs lineal) | ❌ No implementado |
| Tracking de slides visitados | ❌ No implementado |
| Sequencing SCORM 2004 condicionado por settings | ❌ Sintaxis correcta, lógica ausente |
| Marcar curso completo solo si todos los slides visitados | ❌ No implementado |

---

### Orden de fix para NAV

| Orden | ID | Descripción | Ficheros | Esfuerzo |
|---|---|---|---|---|
| 1 | NAV-03 | Añadir `navigationMode` a `CourseSettings` | types/course.ts + Course.ts backend + CourseDoc runtime | ~1h |
| 2 | NAV-01 | Bloquear Next con preguntas sin responder | runtime-player/index.ts | ~2h |
| 3 | NAV-02 | Tracking de slides visitados + resume completo | runtime-player/index.ts + suspend.ts | ~2h |
| 4 | NAV-04 | Sequencing SCORM 2004 condicionado | scorm-packager/index.ts | ~2h |

**Gate de cierre para navegación:** Test E2E que: (a) intente navegar con pregunta
sin responder → botón Next desactivado, (b) responda la pregunta → Next activo,
(c) complete el curso, cierre y reabra → reanuda en el slide correcto con
respuestas anteriores restauradas.
