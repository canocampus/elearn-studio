# Graphify Architecture Analysis — packages/authoring-ui
> Generado: 2026-04-08 | Herramienta: graphify v1 (--mode deep)  
> Corpus: 104 ficheros · ~82,023 palabras · 503 nodos · 725 edges · 33 comunidades

---

## Resumen ejecutivo

El análisis semántico de `packages/authoring-ui` confirma objetivamente tres
problemas arquitectónicos que han sido parcheados de forma reactiva en lugar
de resueltos estructuralmente. Este documento sirve como referencia para las
decisiones de refactorización en T639/T640 y fases posteriores.

---

## 1. El acoplamiento GrapesJS/React no tiene representación en código

**Community 11 — "GrapesJS Integration Layer" — cohesión 0.12**

Graphify detectó en modo semántico los siguientes nodos conceptuales que
**existen como ideas pero no como abstracciones reales en código**:

- `GrapesJS Integration Pattern (Architectural Concept)`
- `GrapesJS Editor Core (Architectural Concept)`
- `GrapesJS Storage Manager (Architectural Concept)`

Una cohesión de 0.12 en el layer que debería ser el más cohesionado del
sistema indica que `initEditor`, `storageManager`, `registerBlocks` y
`assetManager` están relacionados por convención de uso, no por una interfaz
formal. No existe un contrato explícito entre React y GrapesJS — cada
componente accede al editor de forma directa y ad hoc.

**Implicación directa:** Los bugs de stale closure que afectan a T631 y los
panels de propiedades son una consecuencia predecible de esta ausencia de
contrato. GrapesJS maneja su propio ciclo de vida; React maneja el suyo;
la sincronización entre ambos depende de que cada desarrollador recuerde
usar `useRef` correctamente en cada panel.

**Tarea relacionada:** T639 — Diseño de capa de integración GrapesJS/React.

---

## 2. El patrón Properties Panel existe semánticamente pero no en código

**Community 17 — "Widget Properties Panel Ecosystem" — cohesión 0.20**

Graphify identificó con confianza 0.90 (INFERRED) la existencia de un
`Properties Panel Archetype (Shared Pattern)` con 9 edges hacia:

- ButtonPropertiesPanel
- ImagePropertiesPanel  
- MediaPropertiesPanel
- NavButtonsPropertiesPanel
- NavigationPropertiesPanel
- PhaserSimPropertiesPanel
- QuestionPropertiesPanel
- ScreenshotSimPropertiesPanel
- ProgressBarPropertiesPanel

El modelo semántico detectó el patrón porque los 9 componentes comparten
estructura: reciben `component` y `editor` como props, leen estado con
`getExtendedProps()`, escriben con `patch()` o `update()`, y gestionan
autosave de forma similar. Sin embargo, este patrón no existe como clase
base, hook, ni utilidad compartida — está duplicado 9 veces.

**Implicación directa:** T632 (asset picker), T633 (button background),
T634 (nav-buttons) son síntomas del mismo problema. Claude Code parcheó
cada panel por separado porque cada uno es una isla. Un `usePropertiesPanel`
hook o una clase base abstracta eliminaría la superficie de bug.

**Tarea relacionada:** T640 — Extracción de `usePropertiesPanel` / base común.

---

## 3. `patch()` tiene tres instancias con ciclos de vida distintos

**God Nodes: `patch()` ×3 — 10 edges, 7 edges, y disperso**

Tanto en AST como en deep mode, graphify detecta tres nodos distintos
llamados `patch()`:

| Instancia | Contexto | Edges | Riesgo |
|-----------|----------|-------|--------|
| `patch()` (DiagramBuilderSection) | Closure sobre estado de hotspots/sim | 10 | Alto — stale closure |
| `patch()` (ProcessFlowBuilderSection) | Closure sobre nodos/edges del flow | 7 | Alto — stale closure |
| `patch()` (general / updateQuestion) | Panel de preguntas | ~5 | Medio — cubierto por T631 |

Si fueran la misma función reutilizada, el grafo mostraría un único nodo
con 22+ edges. El hecho de que aparezcan separados confirma que son tres
closures distintas capturadas en distintos ámbitos. Esto es un riesgo latente
para los simuladores (DiagramBuilder, ProcessFlowBuilder) que T631 no cubre.

---

## 4. Community 0 confirma que T632/T633 fueron parcheados, no refactorizados

**Community 0 — "Action Editor Core" — cohesión 0.04**

Contiene juntos: `handleChooseMedia`, `openMediaPicker`, `handleChooseAudio`,
`openAudioPicker`, `getBgStyle`, `onStyleChange`.

Una cohesión de 0.04 significa que estos nodos están en el mismo fichero o
importan del mismo módulo pero no tienen relación lógica entre sí. La mezcla
de handlers de media, audio y estilos en la misma comunidad de bajísima
cohesión indica que fueron añadidos incrementalmente al mismo componente
sin refactorización.

**Implicación directa:** Si T632 (asset picker) y T633 (button background)
se implementaron tocando estos handlers directamente, el fix está correcto
funcionalmente pero el código sigue siendo una bolsa. El riesgo de regresión
al tocar uno afectando al otro es real.

---

## 5. Surprise: ValidateSequence como bridge cross-community

**Betweenness centrality 0.170 — el nodo más estratégico del grafo**

`Validate Sequence Utility` conecta `Debug & State Layer` con
`Actions UI Subsystem` — dos comunidades que deberían ser independientes.
Esto no era visible en el AST run.

Esto indica que la validación de secuencias de acciones tiene dependencias
implícitas con la capa de debug/estado que no están documentadas. Si en el
futuro se extraen las acciones a un paquete separado, este utility será el
punto de ruptura.

No es urgente para Phase 2.9 pero debe documentarse antes de cualquier
extracción de paquetes.

---

## Mapa de evidencias → tareas

| Hallazgo | Evidencia objetiva | Tarea |
|----------|--------------------|-------|
| Acoplamiento GrapesJS/React sin contrato | Community 11, cohesión 0.12, nodos "Architectural Concept" | T639 |
| Patrón PropertiesPanel duplicado ×9 | Community 17, `Properties Panel Archetype` INFERRED 0.90 | T640 |
| `patch()` ×3 con ciclos de vida distintos | God nodes separados en AST y deep mode | T639/T640 |
| T632/T633 parcheados, no refactorizados | Community 0, cohesión 0.04, mezcla handlers media+style | Post-Phase 2.9 |
| ValidateSequence como bridge inesperado | Betweenness centrality 0.170 | Documentar antes de extracción de paquetes |

---

## Recomendación de orden de ataque

1. **Ahora (Phase 2.9):** Cerrar T631, verificar T632/T633/T634 funcionalmente.
   No refactorizar — estabilizar primero.

2. **T639 — Capa de integración GrapesJS/React:** Definir contrato formal
   (`EditorBridge` o similar) antes de tocar más panels. Sin esto, cada fix
   genera el siguiente bug.

3. **T640 — `usePropertiesPanel` hook:** Extraer el patrón común de los 9 panels.
   Elimina la superficie de bug por duplicación y hace los futuros patches
   triviales.

4. **Post-Phase 2.9:** Refactorizar Community 0 (media/audio handlers) como
   parte de una limpieza general de cohesión, no como tarea urgente.

---

*Ficheros fuente del análisis: `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`*  
*Reproducible con: `/graphify packages/authoring-ui --mode deep`*
