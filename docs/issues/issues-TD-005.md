# Self-Review — TD-005: `useExtendedProperty` shallow-merge risk

**Status:** RESOLVED (contract documented + dev-only lost-key detector + test coverage)
**Date:** 2026-04-18
**Version:** v0.5.60
**Scope:** `packages/authoring-ui/src/hooks/useComponentProperty.ts` — `useExtendedProperty.update()`
**Commit:** TBD (will be recorded after push)

---

## Summary

`useExtendedProperty.update()` performs a shallow merge on the top-level `extendedProperties` object: `{ ...current, [subKey]: newValue }`. When `subKey` points to a nested object (e.g. `scoring`), a caller that writes a partial-shape new value silently drops any sibling keys that were not re-included. TD-005 was filed to address this risk.

The resolution reframes TD-005: instead of imposing a "flat-only" contract (the original suggestion), it **documents the actual shallow-replace contract that the code has always had** and adds a dev-only detector that warns when a shallow replace is about to lose sibling keys from a nested object.

## Why the original "Option B" premise was rejected

The `tasks.md` entry for TD-005 described the risk as hypothetical:

> Safe today because all extendedProperties have flat structure, but risky if a widget introduces nested objects in extendedProperties.

Audit (2026-04-18) of the codebase shows that **`extendedProperties` already contains nested objects and arrays of objects in the shipped widget set**:

- `BaseQuestionExtendedProps.scoring` — `{ weight, attempts, mandatory? }` (nested object) — `packages/shared-types/src/questions.ts:46`
- `MCExtendedProps.options` — `MCOption[]` where `MCOption = { id, text, isCorrect }` (array of objects) — `packages/shared-types/src/questions.ts:76`
- `PhaserSimExtendedProps.sceneDef` — nested structure with `nodes`, `edges`, `steps` — `packages/authoring-ui/src/types/phaserSim.ts`

Therefore, typing `extendedProperties` as `FlatExtendedProperties = Record<string, Primitive | Primitive[]>` and warning on any `typeof newValue === 'object' && !Array.isArray` would:

1. **Break typecheck** — `QuestionPropertiesPanel` passes `MCExtendedProps` to the hook; `scoring` and `options` do not fit `Primitive | Primitive[]`.
2. **Spam warnings in a legitimate flow** — every `useExtendedProperty(selected, 'scoring', …)` / `useExtendedProperty(selected, 'options', …)` in question editing would trigger the warning on every keystroke.
3. **Fail to close TD-005** — the "risk" it describes is already current-state reality, not a future condition.

## Why deep-merge was rejected

A deep-merge implementation (`lodash.merge` or equivalent) was briefly considered. Rejected because:

1. **YAGNI**: no caller today needs deep-merge semantics. The `scoring`-style updates are already solved by the T639 get-latest-spread pattern at the call site (`updateEp({ ...getLatest(), scoring: { ...getLatest().scoring, weight: 50 } })`).
2. **Array semantics ambiguity**: deep-merge libraries treat arrays inconsistently (concat vs replace vs index-merge). The current contract — arrays are always replaced wholesale — is what every caller assumes (options list rewrites, phaser scene-def updates). Introducing deep-merge would flip that silently.
3. **Bundle cost**: lodash is not currently a dependency of `authoring-ui`; adding it for one function is disproportionate. A hand-rolled deep-merge would carry the same semantic-ambiguity risks without the library's test coverage.
4. **Debuggability**: deep-merge hides what the hook actually does. The current shallow-replace is transparent — callers read the code and see exactly what happens to each key.

## What was actually implemented

### 1. JSDoc contract on `useExtendedProperty.update()`

Explicit statement of the shallow-replace semantics + the canonical T639 pattern for partial nested-object updates:

```typescript
/**
 * Performs shallow merge on the TOP-LEVEL `extendedProperties` object:
 * `{ ...current, [subKey]: newValue }`.
 *
 * If `subKey` points to a nested object (e.g. `'scoring'`, `'options'`),
 * `newValue` REPLACES the entire nested object — it does NOT deep-merge.
 *
 * To update a field inside a nested object, use the T639 get-latest-spread
 * pattern at the caller:
 *   const [, updateEp, getLatest] = useExtendedProperty(selected, 'scoring', DEFAULT)
 *   updateEp({ ...getLatest(), weight: 50 })
 *
 * This prevents silent loss of sibling keys like `attempts` or `mandatory`.
 *
 * TD-005: In development mode only, a `console.warn` fires when a shallow
 * replace would lose keys from a previously-nested object.
 */
```

### 2. Dev-only lost-key detector

Runs inside `update()` before the shallow merge. Fires exactly when the contract mismatch matters: **previous value was a nested object AND new value is a nested object AND new value is missing keys that were present**. Does NOT fire for arrays (wholesale replace is intended), does NOT fire in production builds:

```typescript
if (import.meta.env.DEV) {
  const prev = current[subKey]
  if (isPlainObject(prev) && isPlainObject(newValue)) {
    const lost = Object.keys(prev).filter(k => !(k in newValue))
    if (lost.length > 0) {
      console.warn(
        `[TD-005] useExtendedProperty: shallow-replace at "${subKey}" lost keys: ${lost.join(', ')}. ` +
          `To preserve existing keys, use getLatest() + spread: ` +
          `updateEp({ ...getLatest(), ${subKey}: { ...getLatest().${subKey}, ...patch } })`,
      )
    }
  }
}
```

`isPlainObject(v)` is a local helper: `typeof v === 'object' && v !== null && !Array.isArray(v)`. Arrays are excluded because the shallow-replace contract for arrays is intentional (`options` lists, `sceneDef.nodes`, etc. are replaced wholesale by design).

### 3. No type changes

Kept `extendedProperties` typed as `Record<string, unknown>`. No `FlatExtendedProperties` introduced — the earlier audit showed the codebase legitimately needs nested objects and arrays of objects, and locking those out via a union type would cascade into every widget's `ExtendedProps` interface without producing a safety benefit the generic hook type cannot enforce anyway.

## Test coverage (4 new tests)

In `packages/authoring-ui/src/__tests__/hooks/useComponentProperty.test.ts` under the describe block `useExtendedProperty — TD-005 shallow-replace contract + lost-key warning`:

1. **`shallow replace of nested object works as documented (replaces entirely)`** — full-shape replacement of `scoring` succeeds without warning. Documents the happy path of the contract.
2. **`warning fires when shallow-replace of a nested object loses keys`** — partial-shape `{ weight: 50 }` over `{ weight, attempts, mandatory }` triggers one `console.warn` whose message contains `[TD-005]`, the subKey name, the lost key names, and the `getLatest()` suggestion. Behaviour (shallow-replace committed as requested) is still honoured — the warning is diagnostic, not blocking.
3. **`no warning when replacing a nested object with same-shape value`** — full-shape replacement does NOT warn. Guards against false positives that would erode signal-to-noise.
4. **`no warning for array-of-objects replacement (options)`** — replacing a 2-item `options` array with a 3-item array triggers no warning. Documents that the wholesale-replace contract for arrays is intentional.

All four tests use `vi.spyOn(console, 'warn').mockImplementation(() => {})` with `mockRestore()` in `finally` so no other test file sees the spy.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | EXIT=0 |
| `useComponentProperty.test.ts` | 40 → **44/44 pass** |
| `pnpm --filter @elearn-studio/authoring-ui test` | **750/750 pass** (32 files; was 746 before TD-005) |
| `npx eslint src/hooks/useComponentProperty.ts` | 2 warnings (TD-004 historical `defaultValue` / `readValue`; unchanged) |
| `grep isPlainObject src/hooks/useComponentProperty.ts` | 1 definition + 1 usage (dev-guard only) |

## What this does NOT do

- Does **not** change the shallow-merge behaviour for any caller — runtime semantics are identical to pre-TD-005.
- Does **not** emit in production builds — `import.meta.env.DEV` gate means the warning is tree-shaken by Vite in prod bundles. (Note: original draft used `process.env.NODE_ENV` but production `tsc -b && vite build` does not include `@types/node` in scope; switched to Vite-native `import.meta.env.DEV` which is the same thing without the type dependency. Caught by CI run `24605557979`.)
- Does **not** type-restrict `extendedProperties` — the existing heterogeneous shapes (primitives, arrays, nested objects) remain legal.
- Does **not** require callers to migrate — the T639 get-latest-spread pattern was already documented and used; TD-005 only adds a diagnostic for accidental misuse.

## Open issues

CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 0

Block closed.
