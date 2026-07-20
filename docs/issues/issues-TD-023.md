# Issues — TD-023: contratos duplicados → shared-types como autoridad

## TD-023.1 — Inventario de divergencias (2026-07-20)

### Familia simulación (3 copias)

| Tipo / campo | authoring `types/simulation.ts` | backend `types/simulation.ts` | runtime `sim/simPlayer.ts` | Veredicto |
|---|---|---|---|---|
| `SimHotspot` (x, y, width, height, tolerance) | requeridos | requeridos | requeridos | idéntico ×3 |
| `SimInteractionType` | `'click'\|'hover'\|'type'` | igual | igual | idéntico ×3 |
| `AuthoredSimStep.*` (13 campos base) | requeridos (+`expectedText?`) | igual | igual | idéntico ×3 |
| **`AuthoredSimStep.interactionType`** | **requerido** | **requerido** | **`?` opcional** | **ÚNICA divergencia** |
| `SimMode` / `SimConfig` | idéntico | idéntico | idéntico | idéntico ×3 |

**Fuera de alcance (deliberado)**: `RawSimStep` / `RawSession` viven SOLO en el
backend — son el formato de cable del recorder (espejo del `SimStep` de
`simulation-engine`, asimetría de nombre documentada en TD-014.26 R-M1), no una
copia del contrato de authoring. Se quedan donde están.

### Familia animaciones (2 copias)

| Tipo | authoring `AnimationPropertiesPanel.tsx` | runtime `animations/animator.ts` | Veredicto |
|---|---|---|---|
| `AnimationKeypoint` / `AnimationFill` / `AnimationPath` | shapes idénticos (sin doc comments) | shapes idénticos (con doc comments) | idéntico ×2 — divergencia solo documental |

## TD-023.2 — Decisión D2 ratificada

**`interactionType` es REQUERIDO en el contrato canónico.** Evidencia:
- Todos los productores lo emiten siempre: el import del backend emite `'click'`
  (el recorder solo captura clicks) y el StepForm de authoring lo inicializa.
- La opcionalidad del runtime no protegía a productores — protegía a paquetes
  SCORM **pre-T202** ya exportados, cuyos steps pueden llegar sin el campo.
- Esa tolerancia es de FRONTERA de lectura, no de contrato: `simPlayer.ts:219`
  ya hace `step.interactionType ?? 'click'` y ese default legacy documentado se
  CONSERVA (patrón suspend-v2). El tipo pasa a requerido; el dato viejo sigue
  reproducible.

## Diseño de la migración (TD-023.3/.4)

- Canónicos en `@elearn-studio/shared-types`: `src/simulation.ts` (Hotspot,
  InteractionType, AuthoredSimStep, SimMode, SimConfig) y `src/animation.ts`
  (Keypoint, Fill, Path) — doc comments fusionados de las copias más ricas.
- Las copias locales pasan a **re-exports** (estabilidad de rutas para sus
  importadores); `import type` en todos los sitios → cero impacto en bundles.
- **Guard permanente (TD-023.5)**: tests `expectTypeOf` por paquete consumidor
  comparando el tipo local re-exportado contra el canónico. Disparan en
  `tsc`/verify:types (los mismatches de `expectTypeOf` son de compilación, no
  de runtime) — si alguien redefine una copia local, CI rompe.
- **RED honesto**: antes de migrar, el test del runtime falla en tsc por la
  opcionalidad de `interactionType` (la divergencia real); authoring/backend
  nacen verdes (shapes ya idénticos).
