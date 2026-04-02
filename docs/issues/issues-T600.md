# Issues — T600: Fix Initial Drag Positioning Bug (BETA-06)

**Reviewer:** Claude Code  
**Date:** 2026-04-02  
**Status:** CLOSED — all issues resolved

---

## Summary

T600 fixed BETA-06: four widgets (`done-button`, `question-tf`, `question-fill`, `media-player`)
landed at canvas origin (0,0) when dragged from the BlockManager onto the GrapesJS canvas.

**Root cause:** GrapesJS `dragMode: 'absolute'` requires the block `content` definition to include
`style: { position: 'absolute', left, top, width, height }`. Without it, GrapesJS cannot anchor
the drop coordinate — the `component:add` handler in `initEditor.ts` sets `position: absolute`
but provides no `left/top`, so the widget ends up at 0,0.

**Fix:** Added the missing initial `style` object to each broken block's `BlockManager.add()` call.
GrapesJS overrides `left/top` with the actual drop coordinates at runtime; the defaults are only
needed to prime the coordinate system.

---

## Issues Found

### CRITICAL — 0

None.

### HIGH — 0

None.

### MEDIUM — 1

#### M-01 — ✅ RESOLVED — Full block coverage (all remaining blocks patched)

The code reviewer noted that `question-mc`, `text`, `button`, `rectangle`, `nav-buttons`,
`score-quiz`, `score-field`, `screenshot-sim`, and `phaser-sim` blocks also lacked the explicit
`position: absolute` style in their block content definitions, sharing the same latent vulnerability.

**Resolution:** Applied `style: { position: 'absolute', left: '100px', top: '100px', width, height }`
to all remaining blocks in `registerBlocks.ts`, `registerQuestionBlocks.ts`, `registerSimBlock.ts`,
and `registerPhaserSimBlock.ts`. Every block definition in the codebase now has a consistent,
complete position style. TypeScript check passes; all 13 E2E tests pass.

### LOW — 1

#### L-01 — ✅ RESOLVED — Created `.gitattributes` to enforce LF line endings

Created `.gitattributes` at the repository root with `* text=auto eol=lf` and explicit
`eol=lf` rules for `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.md`, `*.yml`, `*.yaml`.
Binary assets (images, fonts) marked as `binary` to skip conversion.
This eliminates CRLF→LF conversion warnings on Windows for all source files.

---

## Changes Made

| File | Change |
|---|---|
| `packages/authoring-ui/src/editor/registerBlocks.ts` | Added `style` with `position: 'absolute'` + `left/top/width/height` to `done-button` and `media-player` block content (original fix); then added to `text`, `image`, `button`, `rectangle`, `nav-buttons`, `score-quiz`, `score-field` (M-01 resolution) |
| `packages/authoring-ui/src/editor/registerQuestionBlocks.ts` | Added `style` to `question-tf`, `question-fill` (original fix); then `question-mc` (M-01 resolution) |
| `packages/authoring-ui/src/editor/registerSimBlock.ts` | Added `style` to `screenshot-sim` block content (M-01 resolution) |
| `packages/authoring-ui/src/editor/registerPhaserSimBlock.ts` | Added `style` to `phaser-sim` block content (M-01 resolution) |
| `e2e/tests/grapesjs-integration.spec.ts` | Added T600 regression describe block with 4 parameterized tests (one per originally fixed widget) |
| `.gitattributes` | Created — enforces LF line endings for all source files (L-01 resolution) |

---

## Test Results

```
13 passed (49.7s)
  ✓ Done Button does NOT land at canvas origin (0,0) on drop (BETA-06 regression)
  ✓ True / False does NOT land at canvas origin (0,0) on drop (BETA-06 regression)
  ✓ Fill in the Blank does NOT land at canvas origin (0,0) on drop (BETA-06 regression)
  ✓ Media Player does NOT land at canvas origin (0,0) on drop (BETA-06 regression)
  + 9 pre-existing tests — all passing, no regressions
```
