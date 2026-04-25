# Baseline — síntomas/deficiencias detectados en el player (pre-fix)

**Fecha de captura**: 2026-04-24
**Trigger**: TD-013.5 pre-block investigation durante la campaña de screenshots para `docs/user-guide/13-software-walkthrough.md` (user-manual v2).
**Fuente original (archivo vivo del proyecto)**: `docs/issues/issues-TD-014.md` (30 filas auditadas → 15 gaps + 2 partial + 4 info findings).
**Método**: contraste línea-a-línea entre las **promesas textuales del manual §13** y la **superficie real en `packages/authoring-ui`** + los endpoints de `packages/simulation-engine` y `backend/api`.

> **Nota**: "player" aquí se refiere al stack completo **Screenshot Simulation** (autoría + recorder + runtime), no al paquete Phaser que es una pista paralela sin relación. El runtime `packages/runtime-player/src/sim/simPlayer.ts` ya existía y era funcional; todos los síntomas de abajo son de la **capa de autoría + recorder**, que es lo que el manual §13 promete al usuario final y lo que faltaba hacer alcanzable.

---

## Resumen cuantitativo

| Tipo | Cantidad |
|---|---|
| GAPS `missing-ui` (backend listo, UI faltante) | 12 |
| GAPS `backend-gap` (backend incompleto) | 3 |
| PARTIAL (UI existe pero incompleta) | 2 |
| INFO findings (observaciones, no gaps) | 4 |
| IMPLEMENTED (ok — no listados aquí) | 13 |
| **Total filas auditadas** | **30** |

**Gaps totales: 15.** El detalle de cada uno está abajo en bloques individuales.

---

## Detalle de los 15 gaps

### GAP 1 — "Add step" button no existe

- **Promesa del manual (§Adding steps L32)**: *"click **Add step**"*
- **Síntoma observable (pre-fix)**: al abrir `SimulationEditor` con 0 steps, el canvas mostraba "No steps yet" y no había ninguna manera de avanzar. Sin botón en la cabecera, sin botón en el pie de la columna de steps, sin atajo.
- **Causa técnica**: `SimulationEditor.tsx` tenía cabecera (`Mode`, `Passing %`, `Save & Close`, `Cancel`) + body de tres columnas, pero ningún control para añadir un step. `StepForm.tsx` tampoco lo exponía (sólo edita el step ya seleccionado).
- **Impacto**: **bloqueo duro** — el usuario literalmente no podía empezar autoría manual. El único camino alternativo para llegar a un primer step era **Import desde recorder**, que **también estaba sin UI** (ver GAP 6–11). Deadlock total para simulaciones nuevas.
- **Backend**: N/A (estado puro de cliente).
- **Fix**: TD-014.3 (sticky footer con botón + `data-testid="sim-add-step-btn"`).

### GAP 2 — `simStore.addStep()` action no existe

- **Promesa (implícita por GAP 1)**: el handler del botón necesita una acción de store a la que llamar.
- **Síntoma**: en código, `simStore.ts` (84 LOC pre-fix) exportaba sólo `openPanel / closePanel / selectStep / updateStep / reorderStep / deleteStep / updateMode / updatePassingScore`. **Faltaban `addStep` y `setConfig`.**
- **Causa técnica**: el store se diseñó para "editar lo que `openPanel` te dio" y nunca se extendió al add-from-scratch.
- **Impacto**: aunque alguien añadiera el botón, no tenía qué invocar. Gap de dos niveles (UI + store).
- **Backend**: N/A.
- **Fix**: TD-014.2 (`addStep(overrides?)` + `setConfig(config)` en la misma subtarea, esta última por R-02 → ver GAP 12).

### GAP 3 — Upload de screenshot de step sin UI

- **Promesa (§Adding steps L33)**: *"**Upload** the screenshot for this step"*
- **Síntoma observable**: `StepForm.tsx` tenía 9 campos (Description, Instruction, Hint, etc.) pero **ningún affordance de asset**. Sin `<input type="file">`, sin `useRef`, sin botón Upload, sin drag-and-drop de ficheros. Un step recién creado arrancaba con `screenshotUrl: ''` → `HotspotCanvas` intentaba cargar `new window.Image('')` → canvas en blanco sin pista de por qué.
- **Causa técnica**: integración simplemente no construida. El API client `uploadAsset(file)` ya existía en `courseApi.ts:224-242` y se usaba desde otros paneles (botón, imagen, narración), pero nunca se cableó al StepForm.
- **Impacto**: **camino de autoría manual muerto**. Incluso arreglando GAPs 1+2, el step existiría pero sin forma de ponerle screenshot. Sólo el path Import-desde-recorder era viable end-to-end.
- **Backend**: ✅ completamente listo — `POST /assets` (multipart, devuelve `{ objectName, url, originalName }`); `GET /assets/:name/presigned` (devuelve URL firmada para que el browser la cargue con auth).
- **Fix**: TD-014.4 (Upload button + hidden file input + async handler → `uploadAsset` → `resolveAssetUrl` → `onChange({ screenshotKey, screenshotUrl })`).

### GAP 4 — Asset Library picker no montado para steps

- **Promesa (§Adding steps L33)**: *"or pick one from the Asset Library"*
- **Síntoma observable**: no hay picker accesible desde el StepForm. El usuario no puede reutilizar una imagen ya subida en otro widget/slide — tiene que re-subirla cada vez.
- **Causa técnica**: cero integración. **Pero el patrón canónico ya existe y es trivial de reutilizar**: `editor.AssetManager.open({ types:['image'], select(asset, complete) { onChange({ screenshotUrl: asset.getSrc() }); if (complete) editor.AssetManager.close() } })` se usa en `ButtonPropertiesPanel.tsx:90-107`. `SimulationEditor.tsx:19` ya lee `editor` desde `useEditorStore` → zero plumbing.
- **Impacto**: degradación UX — re-subida obligada cada vez. No es bloqueo funcional (GAP 3 resuelto cubre el happy path de "subir de cero").
- **Backend**: GrapesJS AssetManager config proxea a `POST /assets` vía `assetManager.ts`. **Caveat**: el modal del AM muestra **sólo los assets subidos en la sesión en memoria** — no hay `GET /assets` persistente (ver GAP 14 por separado).
- **Fix**: TD-014.4 (fusionado con GAP 3 per R-01, evitando duplicar una modal cuando GrapesJS ya la da). El plan original TD-014.5 de construir un `AssetPickerModal` separado se descartó.

### GAP 5 — No se puede dibujar hotspot nuevo (draw-mode)

- **Promesa (§Marking a hotspot L51)**: *"drag a rectangle over the area"*
- **Síntoma observable**: si el step no tiene hotspot (todos los creados manualmente), el canvas no responde a mouse-down/move/up. El usuario lee el manual, intenta arrastrar, y no pasa nada. Sólo puede redimensionar hotspots que **ya existen**.
- **Causa técnica**: `HotspotCanvas.tsx:92-104` (pre-fix) sólo renderizaba un `<Rect>` único draggable + resizable ligado a `step.hotspot`. Sin handlers `onMouseDown / onMouseMove / onMouseUp` en el Stage. Los steps manualmente creados arrancaban con `{ x:0, y:0, width:0, height:0, tolerance:12 }` (sentinel de "sin hotspot") y se quedaban así indefinidamente. Los steps importados por recorder al menos recibían un default via backend (`deriveDefaultHotspot(raw)` en `simulations.ts:143`), pero nada permitía re-dibujar desde cero.
- **Impacto**: **camino de autoría manual de hotspots muerto**. Sólo el path "recorder deriva default" daba hotspots, y siempre eran genéricos.
- **Backend**: N/A.
- **Fix**: TD-014.6 (draw-mode con sentinel zero-size → click+drag en Stage crea el Rect; `isDrawModeHotspot()` helper; `MIN_HOTSPOT_SIZE = 10` para descartar clicks accidentales; `Clear hotspot` button en StepForm para re-entrar a draw-mode después).

### GAP 6 — Record from real application — sin UI de lanzamiento

- **Promesa (§Adding steps L30)**: *"by recording them from a real application"*
- **Síntoma observable**: en el toolbar del editor + en el SimulationEditor + en cualquier menú, **no hay ningún botón ni entry point** que permita arrancar una grabación. Cero affordance visible para el usuario.
- **Causa técnica**: nunca se construyó el componente de lanzamiento. El backend del recorder (`packages/simulation-engine/`) lleva meses operativo.
- **Impacto**: **gap más grande en magnitud**. Todo el pipeline de captura-a-import del backend está disponible pero sin puerta de entrada. La narrativa del §13 sobre "graba tu workflow" es aspiracional hoy.
- **Backend**: ✅ listo — `POST /recorder/start {url, title}` → `{ sessionId, status, startedAt }` (`recorder.ts:103-141`); incluye SSRF (rechaza `localhost`, loopback, IPs privadas), URL length validation (≤2048), title length (≤256), 429 on `activeBrowserCount() >= config.recorder.maxBrowsers`.
- **Fix**: TD-014.10 (`RecorderLauncherDialog.tsx` — modal portal-mounted con URL input + title input + Start button, validación client-side que replica las reglas del backend).

### GAP 7 — Capture step durante grabación — sin UI

- **Promesa**: implícita — sin captura manual, una grabación sólo puede reflejar el estado inicial de la página navegada.
- **Síntoma observable**: incluso si GAP 6 se resolviera, el usuario podría lanzar una sesión pero no tendría forma de pedir "captura este estado ahora". La auto-captura por eventos sólo se dispara en clicks/inputs/keydowns que el injected-script del recorder detecta en el browser remoto — no cubre "captura este estado hovered" o similares.
- **Causa técnica**: no hay componente de live-view que muestre botón Capture.
- **Impacto**: granularidad de los steps queda determinada sólo por los eventos DOM. Sin capture manual, el autor no tiene control editorial sobre qué momentos del flujo quiere inmortalizar.
- **Backend**: ✅ listo — `POST /recorder/capture {sessionId}` → `{ steps }` (lista completa actualizada) (`recorder.ts:143-171`); 404 si session no existe.
- **Fix**: TD-014.11 (`RecorderLiveView.tsx` — Capture button + atajo `C`).

### GAP 8 — Stop recording + persist a Garage — sin UI

- **Promesa**: implícita — una grabación debe poderse terminar y quedar importable más tarde.
- **Síntoma observable**: no hay botón Stop. Si el usuario cierra la pestaña o se va, el session server-side eventualmente expira (timeout 5 min en `config.recorder.timeoutMs` default) y el trabajo se pierde sin haber llegado a `recordings/{id}/session.json`.
- **Causa técnica**: componente live-view no existe.
- **Impacto**: trabajo volátil; no hay entrada estable al flujo de Import.
- **Backend**: ✅ listo — `POST /recorder/stop {sessionId}` devuelve el `Session` finalizado; escribe `recordings/{id}/session.json` a Garage (`recorder.ts:173-215`).
- **Fix**: TD-014.11 (RecorderLiveView — Stop button con confirmación via Esc).

### GAP 9 — Listar grabaciones existentes — sin UI

- **Promesa**: implícita en el flujo de Import — "import a recorded session" presupone poder elegir cuál.
- **Síntoma observable**: si una grabación existe de una sesión anterior, el usuario no tiene cómo encontrarla. Ni listado, ni browse, ni buscador.
- **Causa técnica**: no hay componente SessionsPickerDialog.
- **Impacto**: grabaciones antiguas quedan inaccesibles desde la UI aunque estén intactas en Garage.
- **Backend**: ✅ listo — `GET /recorder/sessions` → `{ sessions: SessionSummary[], total }`; ordenadas newest-first; usa `Promise.allSettled` para tolerar sessions con JSON corrupto (`recorder.ts:217-252`).
- **Fix**: TD-014.12 (`SessionsPickerDialog.tsx` — lista con metadata + botón Import por fila + botón Refresh + empty-state).

### GAP 10 — Preview en vivo de grabación activa — sin UI

- **Promesa**: implícita en "Record" del §L30 — grabar implica poder ver qué está haciendo el browser remoto.
- **Síntoma observable**: si una sesión se iniciara (sin GAP 6 esto no es posible), el usuario no vería nada de lo que Playwright está renderizando en el servidor. Grabación a ciegas.
- **Causa técnica**: no hay componente que monte `<img src={getLiveScreenshotUrl(sessionId)}>` con refresh periódico.
- **Impacto**: UX inaceptable para una tarea que dura minutos; el usuario no puede ni verificar que se esté grabando lo correcto.
- **Backend**: ✅ listo — `GET /recorder/sessions/:id/screenshot` devuelve JPEG con `Cache-Control: no-store` (`recorder.ts:285-310`); el navegador puede refrescar sin caché con solo re-renderizar el `<img>`.
- **Fix**: TD-014.11 (live JPEG poll en RecorderLiveView a 500ms).

### GAP 11 — Import de sesión grabada — sin UI (pero cliente existe)

- **Promesa (§Adding steps L30)**: *"import a recorded session into the course"*
- **Síntoma observable más llamativo**: **el cliente de API existe y nadie lo llama.** `courseApi.importSimulation(courseId, sessionId)` en `courseApi.ts:196` está totalmente implementado, tipado y cubierto por tests. Pero ningún componente de authoring-ui lo invoca.
- **Causa técnica**: se construyó el cliente (T024.3) pero se olvidó el dispatcher UI. Combinado con GAP 9 (sin lista de sesiones), no había forma de pasarle un `sessionId` siquiera.
- **Impacto**: el backend invierte en un pipeline completo de transformación Session → SimConfig (derivación de hotspots, URL presigning, etc.) que **es inalcanzable** desde la UI. Código muerto desde el punto de vista del usuario.
- **Backend**: ✅ listo — `POST /courses/:courseId/simulations/import {sessionId}` → `{ success: true, data: SimConfig }`; deriva `AuthoredSimStep[]` con `deriveDefaultHotspot` + URLs `/simulations/screenshot?key=…` (`simulations.ts:92-170`).
- **Fix**: TD-014.12 (botón Import por fila en SessionsPickerDialog → `courseApi.importSimulation` → `simStore.setConfig` → Toast).

### GAP 12 — `simStore.setConfig()` action no existe (blocker del Import)

- **Promesa**: implícita — el flujo de Import (GAP 11 fix) necesita reemplazar el SimConfig actualmente abierto con el resultado del import.
- **Síntoma técnico**: el único punto de entrada para "cargar un SimConfig en el editor" era `openPanel(config, componentId)` que **resetea `selectedStepIndex` a 0** y está semánticamente asociado a "abrir desde doble-click del widget". Usarlo para post-import rompe la expectativa de UX y los tests (si llegaran).
- **Causa técnica**: el store se diseñó asumiendo un único flujo de entrada (doble-click → openPanel → editar → Save & Close). No contemplaba un flujo "swap config mid-session".
- **Impacto**: **upstream blocker del GAP 11.** Sin setConfig, el Import tendría que usar openPanel (UX errónea) o exponer `set` directamente (anti-patrón de Zustand).
- **Backend**: N/A.
- **Fix**: TD-014.2 (añade `setConfig(config)` junto a `addStep`; per R-02 del audit; preserva `panelOpen` + `editingComponentId` + clamps `selectedStepIndex`).

### GAP 13 — simulation-engine sin CORS middleware

- **Promesa**: implícita — el manual §13 describe un workflow fluido Record → Import que requiere que las llamadas navegador → :3002 funcionen.
- **Síntoma observable si el resto se hubiera arreglado sin esto**: el navegador bloquea cada fetch cruzado con un error de red **opaco**. Chrome muestra "Failed to fetch" sin indicar CORS como causa → los devs perderían horas diagnosticando como si fuera un backend caído.
- **Causa técnica**: `packages/simulation-engine/src/index.ts` (58 LOC pre-fix) tenía **sólo** `express.json({ limit: '100kb' })`. Ni `cors`, ni `@types/cors`, ni dependencia declarada. Los clientes existentes son backend-to-backend (llamadas desde `backend/api/src/routes/simulations.ts` durante el `importSimulation`) → el gap era invisible hasta que el navegador se convirtiera en cliente directo.
- **Impacto**: **DOA blocker para toda la UI del recorder**. Debe aterrizar antes que cualquier subtarea TD-014.10 a TD-014.13, aunque no sea una feature visible.
- **Backend**: **ÉSTE es el backend-gap**. Requiere añadir el middleware.
- **Fix**: TD-014.8a (nueva subtarea per R-03 — `cors` dep + `createCorsMiddleware()` factory en `src/middleware/cors.ts` + env var `SIMULATION_ENGINE_ALLOWED_ORIGIN`).

### GAP 14 — Persistent asset listing (`GET /assets`)

- **Promesa (§Adding steps L33)**: *"Asset Library"* — el manual no especifica si es persistente o sólo de sesión, pero "Library" sugiere persistencia.
- **Síntoma observable**: el modal de GrapesJS AssetManager muestra **sólo los assets subidos en la sesión actual en memoria**. Si el usuario recarga la página, el picker queda vacío incluso aunque los assets sigan en Garage.
- **Causa técnica**: `backend/api/src/routes/assets.ts` expone `POST /`, `GET /:name`, `GET /:name/presigned`, `DELETE /:name` — **no hay ruta de listado**. El modo `upload` por defecto del AM de GrapesJS sólo mantiene un array in-memory de lo que se subió en la sesión; no hay hydrate desde un endpoint.
- **Impacto**: degradación UX. No es estrictamente una violación del §13 — "Asset Library" es ambigua.
- **Backend**: gap real — falta el endpoint de listado.
- **Fix**: **DIFERIDO**. Filed as I-04 del audit. No aborda dentro de TD-014; candidato a un bloque backend futuro (no es promesa estricta del §13, y el upload-and-pick por sesión cubre el happy path del manual).

### GAP 15 — `DELETE /recorder/sessions/:id` endpoint

- **Promesa**: implícita — para tests de limpieza y para usuarios que quieran descartar grabaciones.
- **Síntoma observable**: las grabaciones se acumulan en Garage indefinidamente. Sin manera de limpiar desde UI ni desde tests.
- **Causa técnica**: `recorder.ts` expone `start / capture / stop / list / get / screenshot` solamente. Sin DELETE.
- **Impacto**: quality-of-life + **bloqueo para E2E cleanup**. El test `simulation-recorder.spec.ts` (TD-014.23) acumularía una sesión nueva por cada corrida de CI sin poder limpiarla.
- **Backend**: gap real — falta el endpoint.
- **Fix**: TD-014.8b (nueva subtarea per R-04 — `DELETE /recorder/sessions/:id` valida sessionId + `headObject(session.json)` → 404 si falta → `listObjects(recordings/{id}/) → deleteObjects(keys)` → 204; client pairing `recorderApi.deleteSession(id)` va en TD-014.8).

---

## PARTIAL — UI existe pero incompleta (no son gaps puros)

| # | Promesa | Estado | Problema |
|---|---|---|---|
| 16 | Delete step (implícito) | Botón ✕ funciona (`SimulationEditor.tsx:126-131` → `simStore.deleteStep`) | Sin diálogo de confirmación — click accidental destructivo |
| 17 | `sessionId` en simulaciones no grabadas | `registerSimBlock.ts:82` pone `sessionId: ''` para scaffolds manuales | Semánticamente erróneo, sin impacto runtime (0 consumers — ver sección siguiente) |

## INFO findings (observaciones adicionales)

- **I-01**: El manual dice *"drag them up or down to reorder"* pero la UI sólo tenía botones ↑ ↓ (drag-drop de step list no implementado).
- **I-02**: = Partial #16 (delete sin confirmación).
- **I-03**: = Partial #17 (`sessionId` semantic clarity).
- **I-04**: = GAP 14 (no persistent asset listing — degradación UX menor; no es promesa estricta del §13).

---

## Hallazgos derivados del sweep cross-package (durante TD-014.2b)

Al investigar si `SimConfig.sessionId` tenía consumidor antes de tocarlo, se descubrió una **deriva de datos silenciosa**:

- **Escritores del campo** (2):
  - `backend/api/src/routes/simulations.ts:162` — copia el `sessionId` del request body al `SimConfig` que devuelve en el Import response.
  - `packages/authoring-ui/src/editor/registerSimBlock.ts:82` — pone `''` en scaffolds manuales.
- **Lectores del campo**: **0.** Sólo aparece en declaraciones de tipo (3 paquetes) + OpenAPI schema + un único `expect(config.sessionId).toBe('sess-abc')` en test de round-trip que sólo valida el write path sin comprobar comportamiento real.
- **Conclusión**: el campo era **data muerta**. El runtime player (`simPlayer.ts:104-109`) destructura `const { steps, mode } = config` — `sessionId` no se lee **nunca**. Deriva entre 3 paquetes cuya única "prueba" de vida era un test que nunca cubrió comportamiento.
- **Nota crítica para no confundir identificadores**: el `sessionId` que viaja a `/recorder/*` como clave S3 en Garage (`recordings/{sessionId}/...`) **es un identificador distinto** — vivo y correcto; termina su vida cuando `POST /courses/:id/simulations/import` transforma el Session JSON a SimConfig. La última copia del id al SimConfig era el write muerto.

---

## Observaciones estructurales (no son gaps per se — riesgo futuro)

- **Contratos duplicados entre 3 paquetes**: `AuthoredSimStep` + `SimConfig` están definidos literalmente en `packages/authoring-ui/src/types/simulation.ts`, `packages/runtime-player/src/sim/simPlayer.ts:25-53` y `backend/api/src/types/simulation.ts`. Sin single source of truth. El campo `sessionId` es la prueba de que esta estructura es frágil: el runtime nunca lo tuvo, los otros dos sí, y nadie lo notó hasta este audit.
- **`generated.ts` no rompe type-check**: `packages/authoring-ui/src/api/generated.ts` se regenera vía `pnpm --filter @elearn-studio/authoring-ui run gen:api-client`. Nadie lo consume en código de producción todavía → cualquier drift de schema es invisible para `tsc`. Se detectaba sólo con `grep -n sessionId`.

---

## Tamaño real del trabajo (post-audit, pre-fix)

Mapeo de los 15 gaps + 2 partial + 4 info a subtareas del plan original (pre-amendment):

| Síntoma | Subtarea planificada | Amendment |
|---|---|---|
| GAP 1 | TD-014.3 | — |
| GAP 2 | TD-014.2 | — |
| GAP 3 | TD-014.4 | — |
| GAP 4 | TD-014.4 + TD-014.5 (collapsed) | R-01 (TD-014.5 cancelado) |
| GAP 5 | TD-014.6 | — |
| GAP 6 | TD-014.10 | — |
| GAP 7 | TD-014.11 | — |
| GAP 8 | TD-014.11 | — |
| GAP 9 | TD-014.12 | — |
| GAP 10 | TD-014.11 | — |
| GAP 11 | TD-014.12 | — |
| GAP 12 | **TD-014.2 extendido** | R-02 |
| GAP 13 | **TD-014.8a (nueva)** | R-03 |
| GAP 14 | (diferido — I-04) | — |
| GAP 15 | **TD-014.8b (nueva)** | R-04 |
| Partial #16 | TD-014.17 | cancelado (R-01) |
| Partial #17 | **TD-014.2b (nueva)** | R-05 Option E — eliminar entero |
| I-01 | **TD-014.7b (nueva)** | Option B — drag-drop implementado |

**Subtareas**: 28 originales → 32 tras amendments (+4 nuevas: .2b, .7b, .8a, .8b; 2 canceladas: .5, .17).

---

## Scope boundary

Este fichero documenta **estado pre-fix** como baseline objetiva para auditoría externa. **No** documenta:

- Qué se ha arreglado desde entonces (ver `[x]` entries en `tasks.md` bloque TD-014).
- Amendments aplicadas (ver `docs/issues/issues-TD-014.md` § "Amendments applied").
- Decisiones de owner sobre cada finding (R-01 a R-05 documentadas en el audit doc).

Para ver el rastro completo síntoma → fix → verification, leer `docs/issues/issues-TD-014.md` seguido de los bullets `[x]` de `tasks.md` en el bloque TD-014.
