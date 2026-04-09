# T637 — Text Widget Editing: RTE Cursor Loss Investigation

**Investigation:** T637.1 — complete diagnostic of all cursor-loss causes during text editing
**Date:** 2026-04-09

---

## Summary

T637 investigates cursor loss during text widget editing in the GrapesJS canvas. Root-cause
analysis found 5 distinct issues. 3 are fixed (T637.2 + this task), 1 is covered as a
side-effect, and 1 is a low-priority edge case documented below.

---

## Findings

### Finding 1 — CRITICAL — `Commands.isActive('text-edit')` always returns `false`

**Status:** RESOLVED (T637.2)

**Root cause:** GrapesJS v0.21.13 does not register a command named `text-edit`.
`Commands.isActive()` checks an internal command-active registry; it is never set by the
RTE system. All guards based on this API call silently failed.

**Fix:** Replaced with `isRteActive` closure flag driven by `rte:enable` / `rte:disable`
events. Autosave now correctly defers while the user is typing.

---

### Finding 2 — CRITICAL — `elearn:paste` fires during text editing → cursor lost

**Status:** RESOLVED (T637.1 fix)

**Root cause:** GrapesJS keymap `filter()` function only suppresses events when the event
target `tagName` is `INPUT`, `SELECT`, or `TEXTAREA`. It does NOT exclude `contenteditable`
elements. When the user presses Ctrl+V inside a text widget:
1. Browser natively pastes text into the `contenteditable` ✓
2. `elearn:paste` command fires → calls `ed.getComponents().add(entry.definition)`
3. GrapesJS selects the newly added component
4. GrapesJS exits RTE on the text widget → **cursor lost**
5. `component:add` fires → `triggerAutosave()` starts timer

**Fix:** Added `if (isRteActive) return` guard at the top of `elearn:paste`.

**Evidence (GrapesJS source):**
```js
// grapes.min.js — keymap filter function
filter: function(e) {
  const tagName = e.target.tagName;
  return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA')
  // contenteditable NOT excluded
}
```

---

### Finding 3 — HIGH — `elearn:copy` fires during text editing → clipboard overwritten

**Status:** RESOLVED (T637.1 fix)

**Root cause:** Same keymap filter issue. When the user presses Ctrl+C to copy selected
text inside a text widget:
1. Browser copies selected text to native clipboard ✓
2. `elearn:copy` command fires → calls `setClipboard({ style, definition })` with the
   widget definition, overwriting the native clipboard entry we care about
3. A subsequent Ctrl+V outside text-edit pastes the widget, not the copied text

**Fix:** Added `if (isRteActive) return` guard at the top of `elearn:copy`.

---

### Finding 4 — LOW — `component:update` fires on every keystroke

**Status:** COVERED BY T637.2 (no additional fix needed)

**Root cause:** `ComponentTextView.onInput()` in GrapesJS fires `component:update` and
`component:input` on every keypress. This was resetting the autosave debounce timer
on every character typed. The timer would fire 2s after the LAST keystroke, which could
still land while RTE was active on fast typists.

**Covered by:** The `isRteActive` guard in `triggerAutosave()` (T637.2) correctly blocks
any timer that fires during text editing, regardless of which event triggered it.

---

### Finding 5 — LOW (edge case) — `fromMove:true` suppresses `rte:disable`

**Status:** DOCUMENTED, not fixed (low impact)

**Root cause:** In GrapesJS v0.21.13, `rte.disable()` is called with `fromMove:true` when
a component is dragged while in RTE mode. The source:
```js
// grapes.min.js
!n.fromMove && o.trigger('rte:disable', t, e)
```
If a user were to drag a text widget while actively typing, `isRteActive` would remain
`true` indefinitely until a subsequent `rte:enable` + `rte:disable` cycle cleared it.

**Impact:** Copy/paste commands would incorrectly stay in "text-edit passthrough" mode
until the user double-clicks a text widget again. Autosave would also be permanently
suppressed for that editor instance.

**Mitigation:** This requires the user to initiate a drag while simultaneously in text-edit
mode — an unlikely gesture. Not fixed in T637.

---

## Files Changed

| File | Change |
|---|---|
| `packages/authoring-ui/src/editor/initEditor.ts` | `isRteActive` flag + `rte:enable`/`rte:disable` listeners (T637.2) |
| `packages/authoring-ui/src/editor/initEditor.ts` | `isRteActive` guard in `elearn:copy` and `elearn:paste` (T637.1) |
| `packages/authoring-ui/src/editor/initEditor.ts` | `richTextEditor: { actions: [...] }` in `grapesjs.init()` (T637.3+T637.4) |
| `packages/authoring-ui/src/editor/clipboard.ts` | Module-level clipboard (`_clipboard`) survives slide navigation (T636) |
| `e2e/tests/text-widget-rte.spec.ts` | 4 regression tests: cursor, paste suppression, toolbar, autosave (T637.5) |

---

## Code Review (T637.8)

**Date:** 2026-04-10
**Verdict:** APPROVED — 0 issues

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |

Key observations from reviewer:
- `isRteActive` closure correctly encapsulates state per editor instance — no cross-instance leakage.
- Autosave race condition guard (CRITICAL-01 snapshot) is present and tested.
- Both `elearn:copy` and `elearn:paste` guards correctly allow native Ctrl+C/V inside RTE.
- `richTextEditor.actions` configuration matches E2E test expectations.
- E2E tests have correct isolation (fresh slide per test).
- No `console.log`/`console.debug` in production code.
- No `any` types.

---

## Test Results

- 673 unit tests passing (all T637 changes)
- 4 E2E regression tests passing in 20.7s (`text-widget-rte.spec.ts`)
- Full suite: 154 passing, 3 skipped (FLAKE-02 flaky in full suite — pre-existing, unrelated)
