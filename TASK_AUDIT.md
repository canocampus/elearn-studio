# TASK_AUDIT — Tareas derivadas de AUDIT.md (2026-07-20)

> **Fuente**: `AUDIT.md` | **Plan**: `PLAN_AUDIT.md` | **Estado**: APROBADO (owner, 2026-07-20) — EN EJECUCIÓN. TD-026 ✅ (v0.5.75) · TD-022 ✅ (v0.5.76).
> Al aprobarse, estas entradas graduarán a `tasks.md` (sección TECH DEBT BACKLOG) y este fichero pasará a ser el índice de trazabilidad del bloque.
> Convención heredada: una tarea = un bloque cerrable con TDD + verify:ci + E2E gate cuando aplique + cierre documentado.

---

### [x] TD-026 — Documentación arquitectónica y referencia de skill rotas
> **Fuente:** AUDIT.md hallazgo 5 (Media) | **Fase:** 0 | **Complejidad:** LOW | **Decisión previa:** D1 (ruta skill)

- [x] TD-026.1 — `GRAPESJS_REACT_PATTERNS.md`: sustituir el patrón obligatorio `[courseId, slideId]`-reinit por el ciclo de vida real de dos effects (Effect 1 `[courseId]` instancia/destruye; Effect 2 `[courseId, slideId]` carga slides sin recrear), citando `EditorCanvas.tsx:173` y el porqué (carreras Phase 10).
- [x] TD-026.2 — Resolver D1: referencias de AGENTS.md/CLAUDE.md a `grapesjs-react-lifecycle` vs carpeta real `.claude/skills/grapejs-react-lifecycle/` (recomendado: corregir referencias al nombre real).
- [x] TD-026.3 — Grep global de ambas grafías para no dejar referencias mixtas; verificación: la ruta que cite AGENTS existe.

### [x] TD-022 — Migración T648 incompleta: doble gate en 4 PropertiesPanel
> **Fuente:** AUDIT.md hallazgo 1 (Alta) | **Fase:** 1 | **Complejidad:** MEDIUM

- [x] TD-022.1 — TDD RED: tests por panel con Zustand y Backbone **deliberadamente desalineados** (el estado que hoy nadie prueba) — el panel NO debe montar hooks ni editar el componente equivocado. Paneles: AudioNarration (:197), MediaPlayer (:216), ProgressBar (:130), VolumeControl (:121).
- [x] TD-022.2 — GREEN: replicar el doble gate de `PhaserSimPropertiesPanel` (tipo Zustand + tipo del componente Backbone seleccionado) en los 4 paneles.
- [x] TD-022.3 — Sub-scope opcional (decidir al llegar): expresar la invariante completa también en Button/Question panels, que hoy solo usan Backbone para elegir formulario.
- [x] TD-022.4 — E2E gate: spec de paneles existente + escenario de conmutación rápida de selección entre widgets de tipos distintos.

### [ ] TD-023 — Contratos duplicados: shared-types como autoridad (simulación + animaciones)
> **Fuente:** AUDIT.md hallazgo 2 (Alta) | **Fase:** 2 | **Complejidad:** HIGH | **Decisión previa:** D2 (interactionType)

- [ ] TD-023.1 — Inventario de divergencias entre las tres copias de simulación (`authoring types/simulation.ts:7`, `backend types/simulation.ts:44`, `runtime simPlayer.ts:13`) y las dos de animaciones (`AnimationPropertiesPanel.tsx:23`, `animator.ts:14`). Salida: tabla campo a campo.
- [ ] TD-023.2 — Resolver D2 con el inventario delante (recomendación: obligatorio en contrato, runtime tolera legacy con default documentado).
- [ ] TD-023.3 — Definir los contratos canónicos en `@elearn-studio/shared-types` (RED: tests de forma en los 3 consumidores contra el contrato).
- [ ] TD-023.4 — Migrar authoring → backend → runtime, un paquete por subtask, `verify:ci` entre pasos; eliminar las copias locales (o reducirlas a re-export).
- [ ] TD-023.5 — Guard permanente: la regla `no-unsafe-domain-cast` cubre ya los paquetes; añadir test que falle si reaparece una redefinición local de los tipos consolidados.

### [ ] TD-024 — Frontera OpenAPI: tipar Slide.widgets/Slide.actions y dejar de confiar por fe
> **Fuente:** AUDIT.md hallazgo 3 (Alta) | **Fase:** 3 | **Complejidad:** HIGH | **Depende de:** TD-023 | **Decisión previa:** D3 (validación runtime)

- [ ] TD-024.1 — `swagger.ts:95`: sustituir los `object` genéricos por schemas de Widget/ActionSequence derivados del contrato compartido (incluye `name` — la ausencia que TD-019b habría hecho visible).
- [ ] TD-024.2 — Regenerar cliente (`gen:api-client`, patrón TD-014.27.d: solo `openapi.hash` trackeado) y comprobar que el cliente ya no expone `actions?: Record<string, never>[]`.
- [ ] TD-024.3 — `courseApi.ts:21`: alinear el tipado de respuestas con el cliente generado en vez de castear a `CourseDoc`.
- [ ] TD-024.4 — Resolver D3; si va validación runtime: zod en PATCH/POST de courses (la ruta de escritura de TD-019b), RED con payload sin `name`.
- [ ] TD-024.5 — Test de paridad schema Mongo ↔ OpenAPI ↔ shared-types (el triángulo cuya desincronización fue TD-019b).

### [ ] TD-027 — Retirada completa del fósil `Slide.actions`
> **Fuente:** AUDIT.md hallazgo 6 (Media) | **Fase:** 4 | **Complejidad:** MEDIUM | **Depende de:** TD-024 | **Decisión previa:** D4 (censo → migración)

- [ ] TD-027.1 — Censo en BD: ¿algún course-doc real tiene contenido en `Slide.actions`? (esperado 0 — nada lo escribe). Gate: el resultado decide si hay migración.
- [ ] TD-027.2 — Retirar de las tres superficies vivas: `SlideSchema` (Mongo), `swagger.ts`, `duplicateSlide()`.
- [ ] TD-027.3 — Retirar el campo `@deprecated` de `shared-types/course.ts` (cierre del arco TD-017) y regenerar cliente.
- [ ] TD-027.4 — Regresión: backend suite + E2E duplicate-slide.

### [ ] TD-025 — Contract-tests de GrapesJS contra instancia real (cierra H-01/T705)
> **Fuente:** AUDIT.md hallazgo 4 (Media) | **Fase:** 5 | **Complejidad:** MEDIUM

- [ ] TD-025.1 — Decidir capa: E2E (GrapesJS real en la app, churn de iframe ya dominado) vs unit con grapesjs real en jsdom. Recomendación: E2E — spec `@contract` dedicado.
- [ ] TD-025.2 — Portar los contratos de `grapesjs-contracts.test.ts` (hoy stubs) a asserts contra la instancia real: `getInnerHTML` fallback, `attributes.id`, shape de `component:add`/`component:selected`, restore de `name`.
- [ ] TD-025.3 — Los tests stub actuales se conservan (rápidos, unit) pero pierden el nombre "contract"; renombrar para que nadie los confunda con la garantía real.
- [ ] TD-025.4 — Verificar que un bump simulado de GrapesJS incompatible hace fallar el spec (sabotaje controlado en local, no comiteado).

---

## Orden de ejecución propuesto

`TD-026 → TD-022 → TD-023 → TD-024 → TD-027 → TD-025`

## Decisiones abiertas (bloquean su fase, no el arranque)

| ID | Decisión | Fase bloqueada | Recomendación |
|---|---|---|---|
| D1 | Renombrar carpeta skill vs corregir referencias | F0 | corregir referencias |
| D2 | Forma canónica `interactionType` | F2 | obligatorio + tolerancia legacy en runtime |
| D3 | Validación runtime en frontera HTTP | F3 | sí, en PATCH/POST courses |
| D4 | Migración de datos `Slide.actions` | F4 | según censo (esperado: innecesaria) |
