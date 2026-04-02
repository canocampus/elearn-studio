# Issues — T701: Fix & Test: `converters.ts` null/content edge cases
> Generated: 2026-04-01
> Status: reviewed

## Summary
Review of T701 covering two root-cause fixes: (a) null guards in `buildMCPreviewHTML()`
and related question preview builders for missing `answers`/`questionText`, and (b)
documentation of the known `getInnerHTML()` fallback behavior for nested HTML content.
Unit tests cover null/empty inputs and the button-label round-trip.

## Issues Found

### CRITICAL

_None_

---

### HIGH

_None_

---

### MEDIUM

#### M-01 — `buildTFPreviewHTML` and `buildFillPreviewHTML` null guards added but not in task spec
File: packages/authoring-ui/src/__tests__/registerBlocks.test.ts lines 529–547

Issue: The T701 fix adds null guards to all three question preview builders, but the
task spec only called out `buildMCPreviewHTML`. The TF and Fill variants were fixed
proactively. This is correct behavior, but the coverage was not explicitly requested
and may not have been reviewed with the same rigor.

Impact: LOW — The guards are simple `?? []` / `?? 'Question'` defaults matching the
MC pattern. No regression risk.

Status: OK — Proactive fix follows DRY principle. Correctly applied.

---

#### M-02 — `getInnerHTML()` fallback to `component.get('content')` documented but not guarded
File: packages/authoring-ui/src/editor/converters.ts

Issue: T701.4 documents the known limitation: when a text widget has nested HTML
(e.g., `<em>` inside the component tree), GrapesJS moves child tags from `content`
into the `components` array, leaving `content` as an empty string. The fallback
silently returns empty string instead of attempting to reconstruct nested HTML.

The test documents the current behavior so any regression is visible — but the
underlying issue (silent data loss for nested HTML) remains.

Impact: LOW — Affects only rich-text content with nested inline elements. Users
typing plain text or using the TipTap widget are not affected.

Fix: Consider using `editor.CodeManager.getCode(component, 'html')` to serialize
nested component trees accurately in `getInnerHTML()`.

Status: DEFERRED — Documented known limitation. Low priority; only affects text
widgets with nested inline HTML typed directly into the GrapesJS editable.

---

### LOW / INFO

#### L-01 — T701.5 round-trip test verifies button label but not button style
File: packages/authoring-ui/src/__tests__/converters.test.ts lines 829+

Issue: The button-label round-trip test confirms the `content` property survives
`grapesjsFromWidgets → widgetsFromGrapesjs`, but does not verify that the
`style.background-color` or other button-specific styles survive.

Impact: INFO — Style round-trip is covered by other tests (T011.6 suite).

Status: OK

---

## Resolution Status

| Severity | Count | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 0     | 0     | 0    |
| HIGH     | 0     | 0     | 0    |
| MEDIUM   | 2     | 1     | 1    |
| LOW      | 1     | 1     | 0    |

## Verdict

APPROVED — Null guards are in place and prevent the `TypeError` on null `answers`.
The nested HTML limitation (M-02) is a pre-existing GrapesJS constraint correctly
documented by the T701.4 test; it is not a regression introduced by this task.

Key decisions made in this task:
- Null guard uses `?? []` for answers and `?? 'Question'` for question text — matches the type defaults in `registerQuestionBlocks.ts`
- `getInnerHTML()` fallback documented via test rather than "fixed" — correct choice since a fix requires GrapesJS CodeManager integration
- TF and Fill builders guarded proactively under the same task scope
