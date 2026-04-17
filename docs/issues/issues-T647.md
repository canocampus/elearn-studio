# Issues Review — T647

**Reviewer:** code-reviewer agent  
**Date:** 2026-04-17  
**Scope:** EditorCanvas.tsx (saveAndLoad pre-navigation block) + EditorCanvas.test.tsx (new)  
**Result:** APPROVED — 0 issues found

## Files Reviewed

- `packages/authoring-ui/src/components/editor/EditorCanvas.tsx` — `saveAndLoad()` Effect 2 block
- `packages/authoring-ui/src/__tests__/EditorCanvas.test.tsx` — 4 new regression tests

## Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 0     |

## Notes

- Pattern is consistent with autosave path in `initEditor.ts` (lines 449–458)
- `getState()` called synchronously at block entry — avoids stale closure
- `finally { setIsSaving(false) }` guarantees reset on success, error, and timeout
- Non-`Error` rejection falls back to `'Pre-navigation save failed'`
- Tests use real Zustand store (not mocked) — ensures integration correctness
- `vi.hoisted()` mock pattern matches project convention
- All 716 tests pass; TypeScript compilation clean
