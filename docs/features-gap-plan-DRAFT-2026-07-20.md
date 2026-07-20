# BORRADOR NO VERIFICADO — Esqueleto de plan para la fase de features

> ⚠️ **Contexto de fiabilidad.** Un agente planner generó un plan completo de gap
> `features.md` vs implementado, pero ejecutó **cero lecturas/greps** sobre el repo:
> sus tablas de estado por feature (SHIPPED/PARTIAL/MISSING) eran inferencia sin
> evidencia y se han DESCARTADO deliberadamente. Lo que sigue es solo el
> **esqueleto estructural** (agrupación en bloques, orden, riesgos genéricos),
> que sí es razonable como punto de partida. La fase de features arrancará con
> un gap-analysis REAL (verificado fila a fila contra el código) cuando el owner
> cierre su revisión manual de app + manual.

## Esqueleto de bloques propuesto (a validar con el gap real)

1. **Animación** — path editor (Konva sobre el canvas) + panel + playback runtime. Fundacional para feedback visual.
2. **Widgets interactivos** — hotword, hyperlink, text input, checkbox/radio, list box, combo box (panel + converter + renderer cada uno).
3. **Question engine avanzado** — rating scale + refinamientos de scoring (randomize, pesos negativos) donde falten.
4. **Media y eventos** — onDoubleClick/onExitSlide/onMediaFinished/onTimerElapsed, cue points de media, embed de vídeo externo.
5. **Phaser sims restantes** — Physics Demo y Concept Animator (los tipos definidos sin builder/runtime completos), onPhaserSimComplete.
6. **Authoring UX** — thumbnails de slide, import de slides entre cursos, preview responsive.
7. **Exports** — SCORM 2004, AICC, validador de paquete, test harness local.
8. **Canvas polish** — grid/snap, alineación, grouping, menú contextual, tab order.
9. **Accesibilidad y runtime polish** — teclado, ARIA, suspend/resume hardening.
10. **Backend nice-to-have** — multi-autor, plantillas, optimización de assets, versionado. (Candidato a descope.)

## Riesgos genéricos anotados por el planner (válidos aunque el estado no lo sea)

- Hotword dentro del text widget = extensión TipTap no trivial → spike previo.
- Grid/snap puede chocar con el drag libre de T646 → spike previo.
- SCORM 2004/AICC: probar contra Moodle real, mantener matriz de compatibilidad LMS.
- Thumbnails: render bajo demanda + caché, no en cada save.
- Accesibilidad teclado en Phaser: prototipo antes de comprometer alcance.

## Próximo paso cuando toque

Gap-analysis verificado: por cada Fxx de `features.md`, evidencia real (fichero/test o su ausencia vía grep) antes de convertir bloques en tareas. No heredar ningún estado de este borrador sin verificar.
