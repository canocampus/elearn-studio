/**
 * Test utilities — shared across all packages.
 *
 * Lives in @elearn-studio/shared-types because:
 *   - It is generic (no domain types in its signatures).
 *   - All packages can import it without introducing new dependency edges.
 *
 * Currently exposes only `unsafeCast`. See decisions/2026-04-26-as-unknown-as-
 * test-stub-cast.md for the rationale and the lint rule that enforces its use
 * in test files.
 */

/**
 * Build a typed test stub from a `Partial<T>` with a documented reason.
 *
 * Use **instead of** `as unknown as T` in test files.
 *
 * Why this helper exists
 * ----------------------
 * The pattern `{ ... } as unknown as T` bypasses TypeScript's structural check
 * and allowed a real bug to ship: a stub used `id: 'x'` where `T` (CourseDoc)
 * actually requires `_id`. The cast hid the typo, the test passed locally, CI
 * caught the divergence at the build phase. Commit `2bbf3b7` (2026-04-26)
 * fixed the immediate symptom but did not prevent the next instance.
 *
 * `unsafeCast` closes that gap by typing the input as `Partial<T>`. The TS
 * compiler now rejects field-name typos (`id` does not exist on `Partial<CourseDoc>`)
 * while still allowing partial construction (only the fields the test actually
 * needs).
 *
 * The cast is named `unsafe` deliberately:
 *   - At runtime, the returned value is still a partial — accessing fields
 *     not provided will be `undefined`. The helper does NOT make the cast
 *     safe; it makes the cast **honest** (typo-checked, reason-documented).
 *   - The `reason` parameter forces the author to articulate why the partial
 *     is sufficient for the test in question. The reason lives in code and
 *     surfaces in code review and `git grep`.
 *
 * @param partial Fields of `T` to set on the stub. TS rejects field-name typos.
 * @param reason  Short justification for the partial cast (one sentence).
 * @returns       The partial typed as `T` for use in code that expects `T`.
 *
 * @example
 *   // ❌ Before — typo hidden by `as unknown as`:
 *   const stub = { id: 'course-1', title: 't' } as unknown as CourseDoc
 *
 *   // ✅ After — TS catches the `id` vs `_id` typo at compile time:
 *   const stub = unsafeCast<CourseDoc>(
 *     { _id: 'course-1', title: 't' },
 *     'test stub for SessionsPickerDialog Import button',
 *   )
 */
export function unsafeCast<T>(partial: Partial<T>, reason: string): T {
  // The `reason` argument exists for documentation and discoverability; it is
  // intentionally not used at runtime. Reading it suppresses unused-arg warnings.
  void reason
  return partial as T
}

/**
 * Narrow an opaque `unknown` value to a specific type with a documented reason.
 *
 * Use **instead of** `value as unknown as T` when narrowing an existing value
 * (e.g., a callback returned by an external library typed opaquely, or a
 * runtime-known shape that the compiler cannot infer).
 *
 * Why a separate helper from `unsafeCast`
 * ---------------------------------------
 * `unsafeCast<T>(partial: Partial<T>, ...)` is for **constructing** a stub
 * from an object literal — its `Partial<T>` signature catches field-name typos.
 * That signature does NOT fit the narrowing case, where the source is already
 * an existing value of type `unknown` (not an object literal we are building).
 *
 * `unsafeCoerce<T>(value: unknown, reason)` covers the narrowing case
 * symmetrically: source is `unknown`, target is `T`, the cast is documented
 * with a reason. The compiler does no shape verification (the input is
 * `unknown`), so this helper is genuinely **less safe** than `unsafeCast`.
 * Use it only when narrowing is the actual intent.
 *
 * @param value  The runtime value to narrow.
 * @param reason Short justification for narrowing without runtime check.
 * @returns      `value` typed as `T`.
 *
 * @example
 *   // ❌ Before — bare double-cast:
 *   const fn = (cfg.customFetch as unknown as CustomFetchFn)
 *
 *   // ✅ After — narrowing intent + documented reason:
 *   const fn = unsafeCoerce<CustomFetchFn>(
 *     cfg.customFetch,
 *     'narrowing GrapesJS opaque customFetch to test-asserted signature',
 *   )
 */
export function unsafeCoerce<T>(value: unknown, reason: string): T {
  void reason
  return value as T
}

/**
 * TD-023 — compile-time type-equality guard for contract consolidation.
 *
 * `TypeEquals<A, B>` resolves to `true` only when A and B are IDENTICAL
 * types (mutual-assignability trick catches optionality and readonly
 * differences that plain `extends` misses). Combine with `AssertTrue` in a
 * PRODUCTION-compiled module — several packages exclude `__tests__` from
 * `tsc`, so a guard living in a test file would never fire.
 *
 * @example
 *   type _guard = AssertTrue<TypeEquals<LocalShape, SharedShape>>
 */
export type TypeEquals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

export type AssertTrue<T extends true> = T
