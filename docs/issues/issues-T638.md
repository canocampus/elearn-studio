# T638 — Fix typography changes not affecting Quiz Score and Score Field

**Investigation:** T638.1–T638.5 — root cause + fix + E2E regression tests
**Date:** 2026-04-10

---

## Summary

Typography changes (font-size, color) applied via the GrapesJS Style Manager had no visible
effect on the canvas preview of `quiz-score` and `score-field` widgets. The root cause was
that `onRender()` injected hardcoded inline styles into the widget's innerHTML, overriding
any styles GrapesJS tried to apply.

Two approaches were considered:

- **T638.1 (not taken):** Replace inline styles with CSS classes so Style Manager overrides
  work at the class level.
- **T638.2 (taken, then revised):** Listen to `change:style` and re-render. This worked in
  development but was unreliable in the production build — the Backbone event did not fire
  consistently after `setStyle()` in the minified bundle.

The final fix uses CSS inheritance, which is GrapesJS-idiomatic and build-independent.

---

## Findings

### Finding 1 — HIGH — Inline styles in `onRender()` block Style Manager

**Status:** RESOLVED

**Root cause:** Both `quiz-score` and `score-field` widget views injected `style="font-size:Xpx;color:#..."` directly onto inner HTML elements. When GrapesJS applied a user-specified `font-size` to the component's `el` via its CSS rule system, the inner inline styles had higher CSS specificity and won, so nothing changed visually.

**Attempted fix (d22fb16):** Added `change:style` listener to re-render on style changes,
reading `model.getStyle()` at render time. This removed hardcoded values but introduced a
production build regression — `change:style` did not fire reliably in the minified bundle
after `setStyle()`.

**Final fix (7bae6ec):** Removed all inline `font-size`/`color` from `onRender()` output.
GrapesJS applies `setStyle()` to `el` via a CSS rule (not inline). Inner elements without
explicit inline styles inherit automatically. No event listener needed.

```typescript
// Before (T638.2 — unreliable in production)
view: {
  initialize(this: unknown) {
    ;(this as any).listenTo((this as any).model, 'change:style', () => (this as any).onRender())
    ;(this as any).listenTo((this as any).model, 'change:attributes', () => (this as any).onRender())
  },
  onRender(this: unknown) {
    const self = this as any
    const style = self.model.getStyle() as Record<string, string>
    const fontSize = style['font-size'] || '28px'
    const color = style['color'] || '#4f46e5'
    self.el.innerHTML = `<div style="font-size:${fontSize};color:${color};">0 / 0</div>`
  },
}

// After (CSS inheritance — idiomatic GrapesJS, reliable in all builds)
view: {
  initialize(this: unknown) {
    // Only attribute changes (quizTitle trait) need an explicit re-render
    ;(this as any).listenTo((this as any).model, 'change:attributes', () => (this as any).onRender())
  },
  onRender(this: unknown) {
    const self = this as any
    const title = (self.model.getAttributes().quizTitle as string | undefined) || 'Quiz Score'
    // font-size and color are NOT inlined — inherited from el's GrapesJS CSS rule automatically
    self.el.innerHTML = `<div style="font-size:13px;color:#64748b;margin-bottom:4px;">${title}</div><div style="font-weight:bold;">0 / 0</div>`
  },
}
```

---

### Finding 2 — MEDIUM — `change:style` Backbone event unreliable in production build

**Status:** DOCUMENTED (avoided by design)

**Root cause:** GrapesJS's Backbone model emits `change:style` when `setStyle()` is called.
In the development build this fires synchronously. In the minified production bundle (Vite,
rollup), event registration order or tree-shaking may cause `listenTo` bindings to miss the
event. This is a known GrapesJS community issue with production builds.

**Evidence:** T638.5a and T638.5d E2E tests failed in CI (production build) but passed
locally in dev mode. T638.5b (reload-based test) and T638.5c/5e (attribute listener tests)
all passed, confirming the issue was specific to `change:style`.

**Resolution:** Rely on CSS inheritance instead of `change:style` for style propagation.
The `change:attributes` listener (for trait changes) continues to work reliably.

---

### Finding 3 — MEDIUM — Reviewer flagged CSS inheritance assumption unverified in code

**Status:** VERIFIED BY E2E TESTS

The code-reviewer (T638.8) flagged that the CSS inheritance assumption was undocumented
and relied on GrapesJS internals. This concern was resolved by the E2E test suite:

- T638.5a: `score-quiz` font-size changes immediately reflect in canvas (inherited)
- T638.5d: `score-field` font-size changes immediately reflect in canvas (inherited)

Both tests pass in the production CI build, confirming GrapesJS applies `setStyle()` via
a CSS rule (not inline style on `el`), enabling clean inheritance.

---

## Changes

| File | Change |
|------|--------|
| `packages/authoring-ui/src/editor/registerBlocks.ts` | Remove `change:style` listener and inline font-size/color from `onRender()` for both `quiz-score` and `score-field` |
| `e2e/tests/score-widgets.spec.ts` | 5 new `@regression` E2E tests (T638.5a–T638.5e) covering style updates, reload persistence, and trait edits |

## Commits

- `d22fb16` — feat(T638): re-render widgets on change:style + editable traits (initial fix)
- `7bae6ec` — fix(T638): use CSS inheritance for score-field style updates (CI fix)

## Status

**CLOSED** — all 5 E2E tests pass in CI. Typography changes work for both widgets.
