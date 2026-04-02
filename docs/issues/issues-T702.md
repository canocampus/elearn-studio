# Issues — T702: Fix & Test: `resolveAndSetSrc` stale DOM reference in `registerBlocks.ts`
> Generated: 2026-04-01
> Status: reviewed

## Summary
Review of T702 covering two fixes in the image widget's `resolveAndSetSrc()` method:
(a) a `el.isConnected` guard that prevents `setAttribute` on detached canvas elements
when the presigned-URL request returns after the component has been removed, and (b)
replacing the silent `.catch()` with a `console.warn` that includes the `objectName`
and the error, enabling diagnosis of Garage connectivity issues. Four unit tests cover
the guard conditions and the warning behaviour.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — `resolveAndSetSrc` uses `(this as any)` casts but has no explicit type annotation
File: packages/authoring-ui/src/editor/registerBlocks.ts lines 123–143

Issue: The method is defined in a plain object literal cast via `as unknown as object`
to satisfy the GrapesJS view API. The `this` parameter is typed as `unknown` throughout,
requiring two `(this as any)` casts to read `this.model` and `this.el`. This is a
necessary workaround for the GrapesJS view object pattern, but there is no comment
explaining why the casts are acceptable rather than a sign of a type error.

Impact: LOW — The casts are confined to this method and the test suite mocks the same
shape. No runtime risk; type safety is restored at the method boundaries.

Status: OK — GrapesJS view objects cannot be typed via standard TypeScript without
the cast. Acceptable given the existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
suppression that acknowledges this intentionally.

---

#### M-02 — `el.isConnected` guard does not cover the `change:src` re-render path
File: packages/authoring-ui/src/editor/registerBlocks.ts lines 117–121

Issue: The `initialize()` method registers a `listenTo(model, 'change:src', resolveAndSetSrc)`
listener. This listener fires synchronously on the GrapesJS model change event, which
happens during canvas load when GrapesJS re-applies model properties to freshly
recreated view elements. At that point `el` is always connected; the guard in
`resolveAndSetSrc` correctly protects only the async `.then()` callback, not the
synchronous entry path. The current architecture is correct, but the comment on line
133 says "the component may have been removed while the request was in-flight" —
the guard is in the right place.

Impact: INFO — No bug exists here. This is a documentation note to prevent future
confusion about why the guard is inside `.then()` rather than at the top of the method.

Status: OK — Guard placement is intentional and correct.

---

### LOW / INFO

#### L-01 — `console.warn` message prefix uses `[registerBlocks]` but the method is inside `registerImageWidget`
File: packages/authoring-ui/src/editor/registerBlocks.ts line 141

Issue: Log prefix is `'[registerBlocks] resolveAndSetSrc failed for'`. The file is
`registerBlocks.ts`, which is accurate, but developers searching for the origin of
this warning in a minified build may find it easier with `[registerBlocks:image]`
to indicate the widget type.

Impact: INFO — Developer-only diagnostic; no runtime impact.

Status: OK — Current prefix is unambiguous enough. The file name is sufficient context.

---

#### L-02 — T702 tests use `await new Promise(resolve => setTimeout(resolve, 0))` for async settling
File: packages/authoring-ui/src/__tests__/registerBlocks.test.ts lines 416, 426, 437

Issue: Tests resolve microtasks by awaiting a zero-delay `setTimeout`. This is a
common and correct pattern for settling resolved/rejected promise callbacks in
`jsdom`, but it is fragile if the implementation gains additional async hops (e.g.,
a second `await` inside `.then()`). The test would silently pass without actually
reaching the assertion.

Impact: LOW — Current implementation has a single `.then()` hop, so the pattern is
correct. A future refactor adding a second hop would require updating the settle delay.

Status: OK — Pattern is idiomatic for single-hop promise tests in Vitest/jsdom.

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 0     | 0     | 0    |
| HIGH     | 0     | 0     | 0    |
| MEDIUM   | 2     | 2     | 0    |
| LOW      | 2     | 2     | 0    |

## Verdict

APPROVED — The stale DOM guard (`el.isConnected`) correctly prevents `setAttribute`
from being called on detached elements. The improved `.catch()` logging provides
actionable diagnostics when Garage presigned-URL requests fail. All four unit tests
are correctly structured and cover both the guard path (disconnected → no call,
connected → call proceeds) and the warning path (reject → `console.warn` with
object name and error).

Key decisions made in this task:
- Guard placed inside `.then()` callback (not at method entry) — because the element
  may be connected at the time of the synchronous call but disconnected by the time
  the async request completes
- `console.warn` chosen over `console.error` — broken presigned URL is a degraded
  mode (canvas shows broken-image placeholder) not a crash
- `objectName` included in the warn arguments — allows Garage object path correlation
  without inspecting the full error object
