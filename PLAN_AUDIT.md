# PLAN_AUDIT — Remediación de la auditoría estructural (AUDIT.md, 2026-07-20)

> **Fuente**: `AUDIT.md` (auditoría estática vía `/audit-structural`, sin cambios de código).
> **Tareas derivadas**: `TASK_AUDIT.md` (TD-022…TD-027; graduarán a `tasks.md` al aprobarse este plan).
> **Estado**: APROBADO por el owner (2026-07-20). Fase 0 (TD-026) ✅ completada; D1 resuelta (referencias corregidas, carpeta no renombrada).

---

## 1. Reformulación del objetivo

La auditoría no encontró ciclos ni fugas entre paquetes (resultado positivo íntegro en AUDIT.md §Resultado positivo), pero sí **tres desviaciones Alta y tres Media** que comparten una raíz: **autoridades paralelas** — el mismo contrato mantenido a mano en varias capas (paneles vs Backbone, tipos de simulación ×3, dominio Course vs Swagger, docs vs implementación, fósil `Slide.actions` medio retirado). Es exactamente la familia estructural que produjo TD-019b.

El objetivo del plan: **eliminar las autoridades paralelas donde sea rentable y blindar con tests las que se conserven**, en bloques independientes y ordenados por riesgo.

## 2. Estrategia elegida (recomendación)

De las tres alternativas de AUDIT.md §Alternativas:

- **Base: Alternativa 2 (escalonada)** — tareas independientes, una por familia, compatible con el protocolo de un-subtask-cada-vez y las puertas TDD de AGENTS.md.
- **Dirección de fondo: Alternativa 1 (estructural)** — dentro del bloque de contratos (TD-023/TD-024), la meta es que `shared-types` sea la única autoridad y que Mongo/OpenAPI se alineen con ella, no solo "tests de igualdad de formas".
- **Alternativa 3 (mitigación pragmática) descartada como estrategia** — mantiene las autoridades paralelas que causaron TD-019b; solo se adopta su idea buena (tests de estados deliberadamente desalineados) como parte de TD-022.

## 3. Fases

### Fase 0 — TD-026: Integridad documental y del protocolo (LOW, sin riesgo)
La más barata y la única que está **rompiendo activamente el protocolo**: AGENTS.md exige leer un skill en una ruta que no existe (`grapesjs-react-lifecycle` vs carpeta real `grapejs-react-lifecycle`), y `GRAPESJS_REACT_PATTERNS.md` ordena un patrón (`[courseId, slideId]` reinit) que reintroduciría las carreras que Phase 10 eliminó. Corregir la documentación para que describa el ciclo de vida real de dos effects (`EditorCanvas.tsx:173`).
**Decisión owner D1**: ¿renombrar la carpeta del skill al nombre que citan los docs, o corregir las referencias al nombre real? (Recomendación: corregir referencias — renombrar carpetas de skills puede romper invocaciones ya aprendidas.)

### Fase 1 — TD-022: Completar la migración T648 en los 4 paneles (MEDIUM)
Riesgo autor-facing activo: durante el desfase Zustand→Backbone un panel puede editar el widget equivocado. Doble gate (tipo Zustand + tipo del componente Backbone seleccionado) en los 4 paneles señalados, con el patrón ya probado de `PhaserSimPropertiesPanel`. TDD: tests con los dos estados **deliberadamente desalineados** (el hueco que los tests actuales no cubren). Sub-scope opcional: hacer explícita la invariante en Button/Question.

### Fase 2 — TD-023: `shared-types` como autoridad de simulación y animaciones (HIGH)
Consolidar los tipos de simulación (×3: authoring, backend, runtime) y animaciones (×2) en `@elearn-studio/shared-types`. Resolver la divergencia ya existente (`interactionType` obligatorio en authoring vs opcional en runtime).
**Decisión owner D2**: forma canónica de `interactionType` (recomendación: obligatorio en el contrato; el runtime tolera legacy con default documentado, patrón suspend-v2).

### Fase 3 — TD-024: Frontera OpenAPI tipada para el dominio Course (HIGH, depende de F2)
Sustituir los `object` genéricos de `Slide.widgets`/`Slide.actions` en `swagger.ts` por schemas derivados del contrato compartido; regenerar cliente; que `courseApi.ts` deje de castear a `CourseDoc` por fe. Esta es la barrera que habría detectado TD-019b en compilación.
**Decisión owner D3**: ¿solo tipos, o también validación runtime (zod) en la frontera HTTP? (Recomendación: tipos + validación en PATCH/POST de courses — es la ruta de escritura que ya nos quemó.)

### Fase 4 — TD-027: Retirada completa del fósil `Slide.actions` (MEDIUM, se apoya en F3)
El `@deprecated` de TD-017 no basta: Mongo lo persiste, Swagger lo publica y `duplicateSlide()` lo copia. Retirarlo de las tres superficies.
**Decisión owner D4**: ¿migración de datos para course-docs existentes que tengan contenido en `Slide.actions`? (Paso previo del bloque: censo en la BD; si el censo da 0 — esperable, nada lo escribe — retirada directa sin migración.)

### Fase 5 — TD-025: Contract-tests de GrapesJS contra instancia real (MEDIUM)
Cerrar el antecedente H-01 (issues-T705): los contract-tests actuales prueban stubs. Añadir una capa que ejercite los mismos contratos contra GrapesJS real (vía E2E existente o jsdom+grapesjs real), de forma que un upgrade incompatible de GrapesJS falle en CI.

## 4. Dependencias

```
F0 (TD-026) ── independiente, primero por barato y por integridad del protocolo
F1 (TD-022) ── independiente
F2 (TD-023) ──► F3 (TD-024) ──► F4 (TD-027)
F5 (TD-025) ── independiente (mejor al final: se beneficia de contratos ya consolidados)
```

## 5. Riesgos principales

| Riesgo | Fase | Mitigación |
|---|---|---|
| Consolidar tipos rompe consumidores silenciosos (misma clase que la regla domain-cast vigiló) | F2 | migración por paquete con `verify:ci` entre pasos; grep de casts previos |
| Regenerar el cliente OpenAPI produce drift masivo | F3 | patrón TD-014.27.d ya documentado (solo `openapi.hash` trackeado) |
| Retirar `Slide.actions` con datos reales en BD | F4 | censo previo obligatorio; gate al resultado |
| Contract-test real de GrapesJS flaky en CI | F5 | ejecutarlo en la capa E2E (churn de iframe ya dominado) |
| Doble gate en paneles rompe flujos de selección legítimos | F1 | réplica exacta del patrón PhaserSim (ya en producción) + E2E de paneles existente |

## 6. Verificación (por bloque, protocolo AGENTS)

TDD RED→GREEN por hallazgo; `pnpm verify:ci` completo; E2E gate para F1/F5 (capa paneles/GrapesJS); censo BD para F4; cierre por bloque con CHANGELOG + WORKING_CONTEXT + commit/push/CI, como en TD-013…TD-021.

## 7. Estimación de complejidad

| Fase | Tarea | Complejidad |
|---|---|---|
| F0 | TD-026 docs/protocolo | LOW |
| F1 | TD-022 paneles T648 | MEDIUM |
| F2 | TD-023 contratos shared-types | HIGH |
| F3 | TD-024 frontera OpenAPI | HIGH |
| F4 | TD-027 fósil Slide.actions | MEDIUM |
| F5 | TD-025 contract-tests reales | MEDIUM |

**Decisiones abiertas para el owner**: D1 (ruta skill), D2 (forma canónica interactionType), D3 (alcance validación runtime), D4 (migración según censo).
