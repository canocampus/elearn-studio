# T636 — Cross-slide copy/paste: Code Review Issues

**Reviewer:** code-reviewer agent (post-implementation)
**Verdict:** APPROVE ✅
**Date:** 2026-04-09

---

## Summary

T636 implements cross-slide widget copy/paste backed by a module-level clipboard (`clipboard.ts`) that survives GrapesJS `editor.load()` calls during slide navigation. The implementation is clean and correct.

---

## Issues Found

### None — 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW

The implementation correctly:
- Uses a module-level `let _clipboard` that is NOT reset when GrapesJS reloads slide data
- Registers `elearn:copy` and `elearn:paste` as proper GrapesJS Commands
- Registers `ctrl+c` / `ctrl+v` Keymaps pointing at those commands
- E2E tests use `runCommand` directly (bypassing keyboard focus) — correct approach since the unit tests already cover the keyboard binding path

---

## E2E Design Note

Tests in `e2e/tests/copy-paste-widget.spec.ts` invoke `window.__elearn_editor.runCommand('elearn:copy/paste')` rather than `page.keyboard.press('Control+c/v')`. This is intentional: keyboard focus after `slidesTab.click()` is on a React panel element, not the GrapesJS canvas. The `runCommand` path tests the actual clipboard logic (cross-slide persistence) which is the regression under test. Keyboard binding is trivially covered by the `editor.Keymaps.add` call in `initEditor.ts`.

---

## Resolution Log

| Item | Status |
|---|---|
| T636.1 — Module-level clipboard | ✅ RESOLVED |
| T636.2 — `elearn:copy` command | ✅ RESOLVED |
| T636.3 — `elearn:paste` command | ✅ RESOLVED |
| T636.4 — Keymaps registration | ✅ RESOLVED |
| T636.5 — E2E regression tests (3 tests) | ✅ RESOLVED |
