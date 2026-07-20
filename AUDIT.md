Inicio la auditoría aprobada como un único subtask de revisión. Aplicaré el comando `audit-structural`: refrescaré Graphify, revisaré ciclos entre authoring-ui y runtime-player y auditaré todos los `PropertiesPanel` contra el patrón de ciclo de vida. Además cruzaré los hallazgos con CHANGELOG, ADR, issues y antecedentes documentados; será una auditoría sin cambios de código.

El patrón obligatorio citado por AGENTS no existe en la ruta indicada (`.claude/skills/grapesjs-react-lifecycle/SKILL.md`). No voy a inventar sus reglas: usaré los patrones documentados en `GRAPESJS_REACT_PATTERNS.md`, el historial de Phase 10 y el código/test actuales como fallback. Ahora el comando de auditoría exige refrescar Graphify; esto actualizará sus artefactos generados antes de consultar dependencias.

El refresco terminó sin cambios topológicos. La primera evidencia ya distingue dos cosas: no hay imports TypeScript directos entre los paquetes, pero sí existen contratos “mirror/must stay in sync” y una dependencia de build de authoring-ui hacia el artefacto de runtime-player. Voy a verificar si son desviaciones reales o decisiones documentadas antes de clasificarlas.

La auditoría está convergiendo en cuatro familias, no en una colección de detalles aislados: selección React/GrapesJS parcialmente migrada, contratos duplicados entre capas, frontera OpenAPI incompleta y documentación arquitectónica que ya no describe el ciclo de vida real. Antes del informe cierro la trazabilidad con los tests existentes y el estado del árbol, sin aplicar correcciones.

Auditoría estructural completada. No hay ciclos entre `authoring-ui` y `runtime-player`, pero sí encontré desviaciones relevantes que explican la clase de fallos históricos.
## Architectural Deviations

1. Alta — Migración incompleta del patrón T648

Cuatro paneles validan el tipo únicamente mediante Zustand, pero no comprueban que el componente Backbone seleccionado corresponda al panel:

- [AudioNarrationPropertiesPanel.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/sidebar/AudioNarrationPropertiesPanel.tsx:197)
- [MediaPlayerPropertiesPanel.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/sidebar/MediaPlayerPropertiesPanel.tsx:216)
- [ProgressBarPropertiesPanel.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/sidebar/ProgressBarPropertiesPanel.tsx:130)
- [VolumeControlPropertiesPanel.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/sidebar/VolumeControlPropertiesPanel.tsx:121)

Durante el desfase Zustand→Backbone pueden montar sus hooks sobre el widget siguiente y editar propiedades del componente equivocado. Los tests actuales solo prueban el gate de Zustand, no ambos estados deliberadamente desalineados.
`PhaserSimPropertiesPanel` sí implementa correctamente la doble comprobación. Button y Question consultan el tipo Backbone para escoger formulario, pero tampoco expresan explícitamente la invariante completa.

2. Alta — Contratos duplicados entre capas

Los tipos de simulación están mantenidos manualmente en tres lugares:

- [authoring simulation.ts](/D:/dev/git/elearn-studio/packages/authoring-ui/src/types/simulation.ts:7)
- [backend simulation.ts](/D:/dev/git/elearn-studio/backend/api/src/types/simulation.ts:44)
- [runtime simPlayer.ts](/D:/dev/git/elearn-studio/packages/runtime-player/src/sim/simPlayer.ts:13)

Ya existe divergencia: `interactionType` es obligatorio en authoring y opcional en runtime.

Los tipos de animaciones también están duplicados entre [AnimationPropertiesPanel.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/sidebar/AnimationPropertiesPanel.tsx:23) y [animator.ts](/D:/dev/git/elearn-studio/packages/runtime-player/src/animations/animator.ts:14).

Esta es la misma familia estructural que produjo TD-019b: una capa evoluciona y otra conserva un contrato incompleto.

3. Alta — La frontera OpenAPI no protege el dominio Course

Swagger declara `Slide.widgets` y `Slide.actions` como objetos genéricos en [swagger.ts](/D:/dev/git/elearn-studio/backend/api/src/lib/swagger.ts:95). Por ello, el cliente generado expone `actions?: Record<string, never>[]`, mientras [courseApi.ts](/D:/dev/git/elearn-studio/packages/authoring-ui/src/api/courseApi.ts:21) tipa directamente las respuestas como `CourseDoc`.

Resultado: el cliente confía en el tipo compartido sin comprobar que Mongo, Swagger y la respuesta HTTP implementen realmente ese contrato. El compilador no podía detectar la ausencia de `WidgetSchema.name` que causó TD-019b.

4. Media — Los “contract tests” de GrapesJS siguen siendo mocks

El antecedente H-01 de [issues-T705.md](/D:/dev/git/elearn-studio/docs/issues/issues-T705.md:13) continúa vigente: [grapesjs-contracts.test.ts](/D:/dev/git/elearn-studio/packages/authoring-ui/src/__tests__/grapesjs-contracts.test.ts:5) prueba stubs que imitan GrapesJS, no una instancia real.

El fallback de `getInnerHTML` sí fue implementado posteriormente, pero una actualización incompatible de GrapesJS todavía podría dejar verdes estos tests.

5. Media — La documentación obligatoria contradice la implementación actual

[GRAPESJS_REACT_PATTERNS.md](/D:/dev/git/elearn-studio/GRAPESJS_REACT_PATTERNS.md:14) exige reinicializar el editor con dependencias `[courseId, slideId]`.

La implementación real y deliberada usa:

- Effect 1 `[courseId]`: instancia y destruye el editor.
- Effect 2 `[courseId, slideId]`: carga slides sin recrear GrapesJS.

Está documentado en [EditorCanvas.tsx](/D:/dev/git/elearn-studio/packages/authoring-ui/src/components/editor/EditorCanvas.tsx:173). Aplicar literalmente el patrón obligatorio reintroduciría carreras y recreaciones innecesarias.

Además, AGENTS referencia `grapesjs-react-lifecycle`, pero la carpeta real se llama `grapejs-react-lifecycle`.

6. Media — `Slide.actions` no está completamente retirado

El tipo lo declara fósil en [course.ts](/D:/dev/git/elearn-studio/packages/shared-types/src/course.ts:15), pero:

- Mongo todavía lo persiste.
- Swagger todavía lo publica.
- `duplicateSlide()` todavía lo copia.

Por tanto, “nada lo lee ni escribe” no es estrictamente cierto. Sigue siendo una segunda representación posible para acciones de slide, aunque el runtime no la ejecute.

## Resultado positivo

- Sin dependencias circulares entre paquetes.
- `authoring-ui` y `runtime-player` solo dependen de `shared-types`.
- La referencia al bundle de runtime desde Vite es unidireccional.
- `editor.store()` permanece centralizado en `storageManager.ts`.
- Los listeners DOM y Backbone revisados tienen cleanup.
- Graphify fue actualizado correctamente y no detectó cambios topológicos.

## Alternativas de remediación

1. Solución estructural: convertir `shared-types` en autoridad también para simulaciones y animaciones; derivar/alinear Mongo y OpenAPI con esos contratos; añadir validación real en la frontera HTTP.

2. Solución escalonada: abrir tareas independientes para paneles T648, contratos cross-layer, OpenAPI/Course, GrapesJS real-contract test y limpieza documental/fósil.

3. Mitigación pragmática: añadir solo tests de selección desalineada y checks de igualdad de formas entre tipos duplicados. Reduce el riesgo, pero mantiene las autoridades paralelas.

No modifiqué código ni documentación durante la auditoría y no ejecuté tests; fue una revisión estática respaldada por Graphify, código, ADR, CHANGELOG y el corpus documental.