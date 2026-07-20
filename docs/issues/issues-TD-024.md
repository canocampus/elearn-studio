# Issues — TD-024: frontera OpenAPI tipada para el dominio Course

## Hallazgos durante la ejecución (2026-07-21)

1. **El fallo actual era 500, no silencio**: los RED tests revelaron que un
   widget inválido no se "colaba" — reventaba como `ValidationError` de
   Mongoose SIN manejar (500 genérico, sin mensaje útil). La frontera zod lo
   convierte en 400 con path cualificado (`widgets[0].bounds: ...`).
2. **El guard de paridad encontró huecos antes de compilar**: el schema
   `Slide` de swagger omitía `templateId` y `transition` (presentes en el
   contrato). Añadidos — la igualdad de claves generado↔contrato ahora se
   cumple y queda vigilada.
3. **Fuera de alcance (candidatos futuros)**: `Course.templates/resources/
   settings/metadata` siguen como objetos genéricos en swagger (13 hits
   `Record<string, never>` en el cliente generado). El hallazgo del audit
   cubría `Slide.widgets`/`Slide.actions`; tipar el resto es un follow-up
   natural si algún bug lo justifica.
4. **D3 ejecutada como se recomendó**: zod en PATCH slide (widgets+actions) y
   PUT course (slides). Schemas loose — extras pasan (Mongoose strict los
   descarta), la exigencia es sobre los campos del contrato. Recursión de
   `ActionNode` con el patrón getter de zod v4 (sin casts, regla domain-cast
   intacta).
5. **Triángulo TD-019b cerrado con 3 guards**: Mongo↔contrato (test de
   reflexión sobre `WidgetSchema` en backend), OpenAPI↔contrato
   (`apiContractGuard.ts` en authoring, compile-time), y la validación
   runtime en la frontera HTTP. La ausencia de `name` que causó TD-019b
   dispararía hoy los tres.
