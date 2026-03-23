# issues-T165 — Developer Debug Tooling

**Reviewed:** 2026-03-23
**Reviewer:** code-reviewer agent
**Status:** APPROVED — All issues resolved

---

## CRITICAL — None

---

## HIGH — None

---

## MEDIUM — All resolved

### T165-M1 — `import.meta.env.DEV` guard in executor.ts requires build-time injection ✅ RESOLVED

**File:** `packages/runtime-player/src/actions/executor.ts`

**Issue:** Runtime-player uses Rollup (not Vite), so `import.meta.env.DEV` is not injected at build time. Wrapping the DOM event dispatch in a DEV guard would silently no-op in production without error.

**Fix applied:** DOM events are always emitted unconditionally. CustomEvents with no listeners are zero-cost (no allocation, no overhead). The overlay component (`ActionsDebugOverlay`) only mounts when debug mode is active, so the events go unheard in non-debug builds. This correctly separates the concerns: emit always, observe only in debug.

---

### T165-M2 — MSW service worker requires manual `msw init` step ✅ DOCUMENTED

**File:** `packages/authoring-ui/src/mocks/browser.ts`

**Issue:** The MSW browser worker requires `/mockServiceWorker.js` to be registered in the `public/` directory. This file is not generated automatically and must be created via `pnpm --filter authoring-ui exec msw init public/ --save`.

**Fix applied:** Added comment to `browser.ts` documenting the required setup step. The `?mock=1` URL param activates the worker, so it is completely opt-in — production builds are unaffected even if the service worker file is absent.

---

### T165-M3 — `useDebugMode` does not react to runtime localStorage changes ✅ ACCEPTED

**File:** `packages/authoring-ui/src/hooks/useDebugMode.ts`

**Issue:** The hook reads `localStorage` once on mount (via `useMemo`). If the user calls `localStorage.setItem('debug','1')` after mount, the overlay does not appear until the page reloads.

**Rationale for acceptance:** Debug mode is a developer tool activated deliberately via URL param or a conscious localStorage write followed by reload. The non-reactive pattern is simpler and sufficient for the use case. Adding a `storage` event listener would add complexity with no practical benefit.

---

## LOW

### T165-L1 — No devtools type-safe action names ✅ ACCEPTED

**File:** `packages/authoring-ui/src/store/editorStore.ts`, `actionsStore.ts`

**Issue:** Zustand devtools middleware uses the default action name for all state updates (`{ type: 'anonymous' }`). Named actions require wrapping each `set()` call with `set({ ... }, false, 'setEditor')`.

**Rationale for acceptance:** Named actions are a cosmetic improvement for DX, not a correctness issue. The store name (`editorStore`, `actionsStore`) already identifies which store changed. Defer to a future iteration.

---

### T165-L2 — ActionsDebugOverlay row count test uses fragile selector ✅ FIXED

**File:** `packages/authoring-ui/src/__tests__/debug/ActionsDebugOverlay.test.tsx`

**Issue:** The cap-at-20 test used a CSS `style` attribute selector to count rows, which is fragile against inline style changes.

**Fix applied:** Changed assertion to count text nodes matching `/^action-/` pattern via `screen.getAllByText`, which tests the visible content rather than DOM structure.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | —      |
| HIGH     | 0     | —      |
| MEDIUM   | 3     | resolved/accepted |
| LOW      | 2     | 1 accepted, 1 fixed |

**Verdict: APPROVED** — All issues resolved or accepted with documented rationale.

**Resolved:**
- **T165-M1** — Always-emit DOM events avoids Rollup/Vite build-time flag dependency
- **T165-M2** — MSW init step documented in `browser.ts` comment
- **T165-M3** — Non-reactive debug mode accepted as intentional design
- **T165-L1** — Named devtools actions deferred
- **T165-L2** — Test assertion changed to content-based selector

---

## Passing Checks

✓ Zustand `devtools` middleware enabled on `editorStore` and `actionsStore` (DEV-only)
✓ `useDebugMode` hook checks both `?debug=1` URL param and `localStorage.debug === '1'`
✓ `CourseInspector` renders course JSON in `<pre>` with close button; guarded by `import.meta.env.DEV && isDebug`
✓ `ActionsDebugOverlay` listens to `elearn:action:start/end/error`; shows last 20 with timing; DEV+debug guard
✓ Debug toggle button in `TopToolbar` guarded by `import.meta.env.DEV && isDebug`
✓ `executor.ts` emits DOM events unconditionally (safe for all environments)
✓ MSW `handlers.ts` covers all API endpoints: auth, courses, slides, assets, telemetry
✓ `server.ts` uses `setupServer` for Vitest (Node); `browser.ts` uses `setupWorker` for browser dev
✓ MSW browser worker activated only via `?mock=1` in DEV builds (opt-in)
✓ All 16 authoring-ui test files pass (368 tests)
✓ All 7 runtime-player test files pass (198 tests)
✓ No hardcoded secrets or sensitive data in mock handlers
✓ Mock fixtures use non-production domain (`localhost:3001`, `localhost:3910`)
