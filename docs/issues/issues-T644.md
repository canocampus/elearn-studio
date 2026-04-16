# Issues — T644 Code Review

> Reviewer: code-reviewer agent (claude-sonnet-4-6)
> Date: 2026-04-17
> Scope: PhaserSimPropertiesPanel.tsx, PhaserSimPropertiesPanel.test.tsx,
>        useComponentProperty.ts, useComponentProperty.test.ts
> Commits: 9fcaf6d · df52fdf · b5e2a20

## Summary

T644 correctly aligns `PhaserSimPropertiesPanel` with the established panel pattern. The implementation replaces the previous direct `getExtendedProps`/`editor.store()` path with a proper `useComponentProperty` subscription, splits the component into a null-guard outer shell and a hooks-enabled inner component, and converts `PhaserSimSceneDefEditor` to a pure controlled component. The `useComponentProperty` hook received two improvements: exported `GjsComponent` type (U2) and optimistic `setValue()` in `useExtendedProperty.update()` (U1) for parity with `useComponentProperty`. All architecture rules from CLAUDE.md and GRAPESJS_REACT_PATTERNS.md are followed.

## No issues found

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |

**Verdict: APPROVED**

## Areas checked and found clean

- **Backbone subscription correctness** — Both hooks subscribe on mount via `useEffect`, initialize state from the model, and clean up via `comp.off()` in the return function. Dependency arrays `[component, key]` / `[component, subKey]` are correct and intentionally exclude `defaultValue` (stable per panel, documented with eslint-disable comment).
- **Memory leaks** — All event listeners are removed in `useEffect` cleanup. Hook tests verify `listenerCount()` drops to 0 after unmount.
- **T639.1 patch-merge compliance** — `PhaserSimPropertiesPanelInner.update()` (line 160–163) calls `getLatest()` before spreading, correctly avoiding stale-closure patch-merge loss.
- **Controlled component pattern** — `PhaserSimSceneDefEditor` (lines 356–374) has no internal `useState`/`useEffect`; all state (value, onChange, onBlur) is owned by the parent. The `key` prop on the usage site (line 326) correctly resets the sub-component on selection change.
- **Save path isolation** — `editor` mock in tests intentionally has no `store()` method. The test at line 195–208 proves that any call to `editor.store()` from the panel would throw; the test passes without error, confirming the removal of the direct `editor.store()` call (T644.2).
- **sceneDefJson sync (T644.3)** — `useEffect([ep.sceneDef])` (lines 155–158) fires after any external Backbone mutation, updating the textarea and resetting `jsonError`. Tests cover: initial null, initial object, external update, revert to null, and error-state reset.
- **Optimistic update parity (U1)** — `useExtendedProperty.update()` now calls `setValue(newValue)` before `comp.set()`. The double-set (optimistic + Backbone event) is safe under React 18 batching — no unnecessary re-render, no flicker.
- **GjsComponent export (U2)** — `GjsComponent` is now exported; test files can use it as the cast target instead of `as never` when needed. Existing `as never` casts in tests are pragmatic and acceptable for local mock objects that satisfy the interface structurally.
- **Accessibility** — `<select>` elements for simType and mode have `htmlFor`/`id` pairs (lines 237, 253). The label→select association fix in commit `9fcaf6d` resolves the `getByRole('combobox', { name: /type/i })` accessibility query used in tests.
- **Test coverage** — 16 tests across 4 `describe` blocks covering T644.1 (4 undo/redo re-render tests), T644.2 (4 save-path + patch-merge tests), T644.3 (5 textarea sync tests), and visibility guard (3 tests). All regressions are named after the task they prevent.
- **No production console.log** — Verified clean across all 4 files.
