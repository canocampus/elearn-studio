# Issues — T648: Zustand/Backbone duality fix

> Reviewer: code-reviewer agent + manual | Date: 2026-04-17 | Status: APPROVED

## Summary

T648 closes the Zustand/Backbone duality gap across all PropertiesPanel components.
Root cause: `selectedComponentType` (Zustand, may lag ~20ms) was used for both render
gating AND within-panel sub-form routing. If a component was deselected mid-render,
`selected.get('type')` returned falsy and the panel fell back to Zustand's stale value,
potentially rendering the wrong sub-form. Fix: Backbone is authoritative for all routing;
Zustand is render gate only.

## Key Changes

| File | Change |
|---|---|
| `src/hooks/useComponentProperty.ts` | `component: Component \| null` — null guards in useState, useEffect, update() |
| `src/hooks/useComponentProperty.ts` | `useExtendedProperty` same null-safety treatment |
| `src/components/sidebar/ButtonPropertiesPanel.tsx` | Removed `\|\| selectedComponentType` fallback; added T648 comment; `setValue` → `update` in NavButtonChildLabel |
| `src/components/sidebar/QuestionPropertiesPanel.tsx` | Removed `\|\| selectedComponentType` fallback; added T648 comment |
| `src/__tests__/hooks/useComponentProperty.test.ts` | 10 new tests: null component (4), A→B→A rapid selection (2), Undo/Redo simulation (2) → 35/35 pass |
| `GRAPESJS_REACT_PATTERNS.md` | Full rewrite with battle-tested patterns post-T648 |
| `CLAUDE.md` | Hook rules + Zustand/Backbone source-of-truth table updated |
| `decisions/2026-04-17-panel-selection-source.md` | ADR: Option C — Zustand for render gating only |

## ADR Reference

`decisions/2026-04-17-panel-selection-source.md` — documents why Zustand cannot be used
for within-panel routing (5–20ms lag window during rapid selection causes wrong sub-form
render) and why Backbone `selected.get('type')` is the authoritative synchronous source.

## Validation

| Check | Result |
|---|---|
| `npx vitest run` | ✅ 724/724 pass (35/35 T648-specific) |
| `tsc --noEmit` | ✅ 0 errors |
| ESLint | ⚠️ pre-existing crash (see below) |
| `git diff --name-only` | ✅ 8 files, all expected |
| Push to remote | ✅ `master` updated |

## Issues Found

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW
None.

---

## Known Issues / No Blockers

> ⚠️ **ESLint crash: `es-abstract/2024/AddEntriesFromIterable` not found** — pre-existing,
> unrelated to T648. `eslint-plugin-react@7.37.5` depends on `object.fromentries@2.0.8`
> which requires an `es-abstract` version that exposes the `2024/` subfolder. TypeScript
> (`tsc --noEmit`) is the current type-correctness gate and is unaffected. Tracked in
> [#21](https://github.com/canocampus/elearn-studio/issues/21) — P4, address in next
> dependency hardening phase after Phase 10 closes.

---

## Closing Checklist

- [x] `tasks.md` — T648.1–T648.6 marked `[x]`
- [x] `docs/issues/issues-T648.md` — generated, no CRITICAL/HIGH issues
- [x] `CHANGELOG.md` — entry under v0.5.51
- [x] `WORKING_CONTEXT.md` — updated
- [x] Tests — 724/724 pass, TypeScript clean
- [x] git commit + push — `96c5247` on master

## Verdict

**APPROVED** — 0 blocking issues. T648 safe to close.
