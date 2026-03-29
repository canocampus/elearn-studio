# Informe de Errores de Persistencia y Sincronización (GrapesJS + React)

Este documento detalla los problemas críticos detectados en el sistema de guardado de diapositivas y widgets, las causas técnicas identificadas y las soluciones implementadas para garantizar la integridad de los datos.

## 1. Problemas Detectados

### A. Pérdida de Atributos de Widgets (Traits)
**Síntoma**: Al añadir una imagen y cambiar su texto alternativo (`alt`) o al configurar un reproductor de medios, los cambios se perdían tras navegar entre diapositivas o recargar la página.
**Causa**: El convertidor `widgetsFromGrapesjs` solo guardaba un conjunto limitado de propiedades (`style`, `content`, `src`). GrapesJS guarda la mayoría de las propiedades editadas en la barra lateral (Traits) dentro del objeto `attributes` del modelo. Al no mapear estos atributos al objeto `properties` de nuestra base de datos, los valores volvían a sus valores por defecto al cargar.

### B. Pérdida de Contenido de Texto Editado
**Síntoma**: Tras editar el texto de un widget, el contenido aparecía vacío o volvía al texto anterior ("Double-click to edit text") al cambiar de slide.
**Causa**: GrapesJS utiliza un DOM editable para el texto. Los cambios en el DOM no siempre se sincronizan con el atributo `content` del modelo de forma inmediata. Si el autoguardado se disparaba antes de que el usuario "confirmara" la edición (perdiendo el foco o pulsando Escape), se guardaba el estado antiguo. Además, si el usuario añadía etiquetas HTML (como negrita), el atributo `content` plano de GrapesJS dejaba de ser la fuente de verdad.

### C. Fallo en el Guardado de Widgets Recién Creados
**Síntoma**: Un widget recién arrastrado al lienzo a veces no aparecía al recargar si el usuario no lo movía primero.
**Causa**: El autoguardado solo escuchaba el evento `component:update`. El evento `component:add` no disparaba el ciclo de persistencia, por lo que el widget solo existía en la memoria del navegador hasta que se produjera un cambio de posición o estilo.

### D. Desincronización en Paneles de React
**Síntoma**: Los cambios en las propiedades de preguntas (opciones, puntuación) o en configuraciones de simulaciones no siempre se guardaban de forma fiable.
**Causa**: Los paneles de React llamaban a `component.set('extendedProperties', ...)` pero confiaban ciegamente en el temporizador de autoguardado de 2 segundos. Si el usuario cambiaba de diapositiva rápidamente, la condición de carrera causaba que el cambio no se persistiera.

## 2. Soluciones Aplicadas

### A. Refactorización del Convertidor (`converters.ts`)
- **Captura Global de Atributos**: Ahora `widgetsFromGrapesjs` itera sobre todos los atributos del modelo de GrapesJS y los guarda en `properties`, filtrando solo los internos (`class`, `id`, `style`).
- **Uso de `getInnerHTML()`**: Para widgets de texto y botones, ahora capturamos el contenido usando `c.getInnerHTML()`. Esto garantiza que todo el HTML generado por el editor de texto (hijos del componente) se preserve íntegramente.
- **Robustez en Carga**: Se han añadido protecciones contra valores `null` o `undefined` en el objeto `properties` para evitar que el editor falle al cargar diapositivas con datos antiguos o incompletos.

### B. Mejora del Ciclo de Vida del Editor (`initEditor.ts`)
- **Nuevos Disparadores de Autoguardado**: Se han añadido escuchadores para `component:add`, `component:remove` y `component:update:content`.
- **Sincronización Forzada**: Antes de cada llamada a `editor.store()`, se ejecuta `editor.stopCommand('text-edit')`. Esto fuerza a GrapesJS a volcar cualquier edición de texto activa del DOM al modelo, asegurando que lo que el usuario ve es exactamente lo que se envía al servidor.

### C. Persistencia Inmediata en Paneles Laterales
- Se ha actualizado `QuestionPropertiesPanel.tsx`, `PhaserSimPropertiesPanel.tsx` y `SimulationEditor.tsx` para llamar explícitamente a `editor.store()` tras cualquier modificación significativa. Esto elimina la dependencia del temporizador de autoguardado para cambios realizados fuera del lienzo.

### D. Estabilización de Tests E2E (`persistence.spec.ts`)
- Se ha añadido un "clic fuera" automático tras la edición de texto en los tests para simular el comportamiento real del usuario y asegurar que los eventos de desenfoque (`blur`) consoliden los datos.

## 3. Conclusión técnica
La integración de GrapesJS con un backend de base de datos requiere una sincronización bidireccional muy estricta. La arquitectura anterior pecaba de optimismo al asumir que el modelo de GrapesJS siempre estaba actualizado. Las nuevas medidas de **persistencia de atributos completa** y **sincronización forzada pre-guardado** cierran los agujeros de fuga de datos identificados.
