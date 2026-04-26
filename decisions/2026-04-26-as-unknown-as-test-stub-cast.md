# ADR — `as unknown as <T>` test stub typing convention

**Date:** 2026-04-26
**Status:** Accepted (Phase 1 — test files only; Phase 2 deferred for production code)

## Context

Commit `2bbf3b7` (2026-04-26) fixed two test stubs whose `as unknown as CourseDoc` cast hid a `course.id` vs `course._id` typo. The casts compiled clean locally; CI's fresh build correctly rejected them once production code was migrated to the canonical `_id`. Lesson surfaced in the commit message: *"future test stubs should construct real shapes or use a typed factory rather than double-casting."* This ADR codifies that lesson with enforcement.

The pattern `expr as unknown as <T>` is dangerous when `<T>` is a domain type defined in our codebase: TS's structural compatibility check is bypassed, so field-name typos in the partial expression do not surface at compile time. The pattern is benign when `<T>` is from an external library (`Component`, `Editor`, `Window`, etc.) where the cast is a coping mechanism for complex types we cannot construct directly.

## Options considered

- **A — Sweep + real shapes inline.** Replace the dangerous casts with real-shape constructions; no infrastructure. Convention-only. Future regression possible.
- **B — Sweep + typed factories.** Add a factory file with builders. Convention-only enforcement. Future regression possible.
- **C — Sweep + factories + scoped lint rule (allowlist of domain types).** B + a lint rule with a maintained list of domain types to flag. Maintenance: ~1-2 list updates per quarter; new domain types not in the list silently re-open the gap.
- **D — Sweep + custom lint rule with provenance check.** Custom typescript-eslint rule that uses the type checker to determine whether the cast target is from our codebase (declaration outside `node_modules/`) or external. Future-proof: any new domain type is automatically covered without list maintenance.
- **D' (chosen) — D plus `unsafeCast<T>(partial: Partial<T>, reason): T` helper.** The lint rule blocks bare `as unknown as <T>` for our types; the helper provides an ergonomic safe path that types the input as `Partial<T>` (TS now catches field-name typos at construction). During implementation a second pattern surfaced — narrowing an existing `unknown` value — and a paired `unsafeCoerce<T>(value: unknown, reason): T` helper was added for that case.

## Decision

**D'** with two helpers:

- `unsafeCast<T>(partial: Partial<T>, reason: string): T` — for partial-stub construction. Source typed as `Partial<T>` so the TS compiler rejects field-name typos.
- `unsafeCoerce<T>(value: unknown, reason: string): T` — for narrowing existing opaque values (e.g., callbacks returned by external libraries with opaque types). Source is `unknown`; the cast is genuinely unverified at compile time, so the helper's value is in **documenting intent + reason**, not in adding type safety.

Both helpers live in `@elearn-studio/shared-types/src/test-utils.ts` and are re-exported from the package root.

The lint rule lives in `eslint-rules/no-unsafe-domain-cast.cjs`, registered as part of the local plugin `eslint-plugin-elearn-local`. The plugin is a workspace package (`pnpm-workspace.yaml` entry + workspace devDep at root) so pnpm symlinks it into `node_modules/` and ESLint resolves it normally as `elearn-local`.

The rule is type-aware (uses `parserServices.program` + `getTypeChecker()` + `getAliasedSymbol` to follow imports to the actual declaration's source file). Provenance: any declaration whose `getSourceFile().fileName` does NOT contain `node_modules/` is treated as ours and flagged.

Type-aware lint requires `parserOptions.project`. To avoid issues with per-package tsconfigs that exclude tests (e.g., runtime-player, phaser-simulations), a root `tsconfig.eslint.json` is used as the dedicated lint-only project.

### Phase boundaries

- **Phase 1 (this ADR):** rule scoped to test files only (`**/__tests__/**`, `*.test.*`, `*.spec.*`). Existing 6 partial-stub casts replaced with `unsafeCast`; existing 8 narrowing casts replaced with `unsafeCoerce`; 2 malformed-input test cases retained bare cast with `eslint-disable` + reason.
- **Phase 2 (deferred, separate ADR):** ~5 production-code casts in `src/` outside `__tests__/`. Different risk profile (runtime mocks, type erasure at library boundaries). Will revisit rule scope after Phase 2 is implemented.

## Rationale (why D' over A/B/C)

The recurring failure mode that motivated this ADR is the gap between "convention exists" and "convention enforced". Options A and B leave that gap intact — a future test under deadline pressure can still introduce `as unknown as <NewDomainType>` and bypass the structural check. Option C closes the gap with a maintained list, but the list is itself a structural weakness: when a new domain type is added without remembering to add it to the list, the gap reopens silently. D's provenance-based check derives the answer from codebase structure rather than from a maintained inventory; new types are automatically covered.

The helpers (`unsafeCast`, `unsafeCoerce`) are not just ergonomics — they make the safe path easier than the unsafe one. `unsafeCast<T>(partial, reason)` types the input as `Partial<T>`, which is what TS would have caught the original `id` vs `_id` typo against. `unsafeCoerce<T>(value, reason)` documents narrowing intent without pretending to verify shape.

The `reason: string` parameter on both helpers is intentional: it forces the author to articulate why the cast is needed. The reason lives in code (surfaces in `git grep`) rather than in commit messages or comments that decay over time.

## Implementation summary

Files added:
- `eslint-rules/package.json` — workspace plugin manifest (`name: eslint-plugin-elearn-local`, private).
- `eslint-rules/index.cjs` — plugin entry exporting rules map.
- `eslint-rules/no-unsafe-domain-cast.cjs` — the rule itself (~120 LoC).
- `tsconfig.eslint.json` — root lint-only TS project that includes test files excluded by per-package build configs.
- `packages/shared-types/src/test-utils.ts` — `unsafeCast` + `unsafeCoerce` helpers.

Files modified:
- `pnpm-workspace.yaml` — add `eslint-rules` package.
- `package.json` (root) — add `eslint-plugin-elearn-local: workspace:*` to devDeps.
- `.eslintrc.cjs` — register `elearn-local` plugin; add override for test files with `parserOptions.project: './tsconfig.eslint.json'` and rule `'elearn-local/no-unsafe-domain-cast': 'error'`.
- `packages/shared-types/src/index.ts` — re-export from `test-utils`.
- 8 test files refactored:
  - 6 partial-stub casts → `unsafeCast<T>(partial, reason)`.
  - 8 narrowing casts → `unsafeCoerce<T>(value, reason)`.
  - 2 malformed-input cases → bare cast retained with `// eslint-disable-next-line elearn-local/no-unsafe-domain-cast -- reason`.

## Verification

- `pnpm lint` — 0 errors (2 pre-existing `react-hooks/exhaustive-deps` warnings in `useComponentProperty.ts`, unrelated to this ADR).
- `pnpm vitest` against the 6 affected test files — 255/255 pass.

## Future work

- **Phase 2 (production-code casts):** ~5 occurrences in `src/` outside `__tests__/`. Separate ADR. Will reassess rule scope (likely extend to production code) after the manual sweep.
- **ESLint 9 migration:** the local plugin uses legacy config. When migrating to flat config, restructure plugin loading via `import` rather than `plugins: ['name']`. The rule itself is config-format-agnostic.
- **Rule tests:** the rule has no formal `RuleTester` cases yet. Validation is "lint passes against real code"; adding tests would harden against future regressions in the rule itself.
- **`unsafeCoerce` ergonomics:** if narrowing patterns become very common, consider a branded-type pattern (`Brand<T>`) instead of the helper to push verification earlier.

## References

- Commit `2bbf3b7` — original symptom fix that triggered this work.
- AGENTS.md §4.1 — local vs CI environment parity (the false-green pattern).
- AGENTS.md §11.8 — lint suppression policy (governs the eslint-disable form for the 2 malformed-input cases).
- AGENTS.md §2.2/§2.2.1 — protocols that shaped the deliberation between A/B/C/D/D'.
