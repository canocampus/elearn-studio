# Issues — TD-016: nav-buttons renders broken in the editor canvas

> Fix shipped 2026-07-19. Origin: TD-013.5c finding 3 (`issues-TD-013.md`).

## Symptom

In the editor canvas the `nav-buttons` widget rendered as a single "Next →"
button painted over a grey sliver — the "← Previous" button appeared to have
no label. Visible to every author and in every §05/§17 manual capture.
Published courses were unaffected (the runtime player renders from
`properties.prevLabel/nextLabel` with its own renderer).

## Investigation trail (2026-07-19)

A throwaway Playwright probe dumped the widget at three moments (fresh,
post-autosave, post-slide-switch round-trip):

1. **Model and DOM were always correct** — both child `<button>` components
   existed with their labels at every moment. Not a T634 regression (missing
   children) and not content loss.
2. **Computed styles exposed the defect**: both children had
   `position: absolute`. With no `left/top`, both anchored at the container
   origin and stacked — "Next →" (later sibling) painted over "← Previous";
   the grey sliver was Previous's wider right edge behind it.
3. **Culprit**: the global `component:add` handler in `initEditor.ts`
   (T010.11/T012.6) set `position: absolute` + `draggable: true,
   resizable: true` on EVERY added component — including the children of
   composite widgets, both on creation and again on every `loadData` (which
   is why the clean children injected by the T634 load branch re-broke
   immediately).

Scope check: `nav-buttons` is the only widget type with child components in
its defaults (grep over register*.ts), so the blast radius was limited to it.

## Fix

`initEditor.ts` — the handler now applies the absolute-layout treatment only
to top-level components (parent === wrapper):

```ts
editor.on('component:add', (component) => {
  const parent = component.parent?.()
  if (parent && parent !== editor.getWrapper()) return
  component.set({ draggable: true, resizable: true })
  if (component.getStyle('position') !== 'absolute') {
    component.addStyle({ position: 'absolute' })
  }
})
```

Nested children keep the layout (flex flow) and interaction flags
(`draggable: false`) their type definition declares. A detached component
(no parent yet) is treated as top-level — preserving pre-TD-016 behaviour
for that edge.

## Verification

- Unit (RED→GREEN): `initEditor.test.ts` TD-016.1 (nested child untouched —
  failed against the old code) + TD-016.2 (top-level control still
  absolutized). Full authoring-ui suite 1046/1046.
- E2E: `grapesjs-integration.spec.ts` `@regression TD-016` — both labels
  visible, child computed positions `static`, no overlap (bbox assertion),
  and the same contract after a slide-switch round-trip (the handler also
  fires on load). 19/19 with `widget-persistence-across-slides.spec.ts`.
- Manual captures: `docs:screenshots` re-run (56 writes, chained crop green) —
  §17 slides now show "← Previous | Next →" side by side.
- tsc -b 0; lint 0 errors (2 pre-existing TD-004 warnings unchanged).
