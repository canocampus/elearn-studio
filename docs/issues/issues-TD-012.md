# TD-012 — Self-review

**Block:** TD-012 — e2e/: typed `window.__elearn_editor` boundary + docs-screenshots playbook
**Status:** ✅ CLOSED (2026-04-23)
**Version bump:** v0.5.64 → v0.5.65
**Commits:** `b55d139` (playbook), `43ed28e` (typing refactor)

---

## Scope

Resolved 109 pre-existing TypeScript errors in the `e2e/` package that had accumulated since before TD-004 (2026-04-18, v0.5.56) codified the "narrow once at a typed boundary, never `as unknown as X` scattered" rule. The production side was swept by TD-004; e2e was missed because its CI path does not run `tsc --noEmit` (Playwright's own transformer parses specs independently, and `pnpm -r lint` / `pnpm -r test` skip the e2e typecheck).

Paired with the refactor: a developer-guide playbook documenting 12 non-obvious capture techniques in `docs-screenshots.spec.ts`, so the User Manual v2 screenshots can be re-generated reliably when the UI evolves.

---

## Error inventory (before fix)

| Error code | Count | Root cause |
|---|---:|---|
| TS2352 `Conversion of type 'Window & typeof globalThis' to type 'Record<string, unknown>' …` | ~70 | `(window as unknown as Record<string, unknown>).__elearn_editor` escape-hatch double cast repeated across every spec |
| TS2341 `Property 'page' is private and only accessible within class 'EditorPage'` | ~35 | `EditorPage.ts:36` declared `private readonly page: Page`; specs accessed `editorPage.page` directly |
| TS2339 `Property 'remove' does not exist on type 'Node'` | 1 | `docs-screenshots.spec.ts:138` passed the cleanup callback without narrowing `Node` → `Element` |
| **Total** | **109** | |

---

## Fix summary

### 1. Typed Window augmentation — `e2e/types/elearn-window.d.ts`

Minimal typed surface covering only the methods specs actually invoke:

```typescript
export interface E2EComponent {
  get(key: string): unknown
  set(key: string, value: unknown): void
  getId(): string
  getStyle(): Record<string, string>
  getStyle(prop: string): string
  setStyle(styles: Record<string, string>): void
  addStyle(styles: Record<string, string>): void
  addAttributes(attrs: Record<string, string>): void
  toJSON(): unknown
}

export interface E2EComponents {
  length: number
  first(): E2EComponent | undefined
  at(index: number): E2EComponent | undefined
  add(def: unknown): E2EComponent | E2EComponent[] | undefined
  toArray(): E2EComponent[]
  models: E2EComponent[]
}

export interface E2EEditor {
  addComponents(defs: object[]): E2EComponent | E2EComponent[] | undefined
  select(component: E2EComponent | null | undefined): void
  getSelected(): E2EComponent | null
  getWrapper(): E2EWrapper
  getComponents(): E2EComponents
  runCommand(command: string): unknown
  store(): Promise<unknown>
  BlockManager: E2EBlockManager
}

declare global {
  interface Window {
    __elearn_editor?: E2EEditor
  }
}
```

**Design decision:** minimal interface vs importing grapesjs types. Pulling `grapesjs` as a devDep in `e2e/package.json` would add ~400 kB of type definitions for test-only typing. The minimal interface:

- Covers every method specs actually call (verified by grep-inventory of all `page.evaluate()` callbacks).
- Self-documents the test-harness contract.
- Extends trivially when a new method is genuinely needed.

### 2. POM: public `page`

`EditorPage.ts:36`:

```diff
- constructor(private readonly page: Page) {
+ constructor(readonly page: Page) {
```

Standard Playwright POM pattern. Specs access `editorPage.page` for `waitForResponse`, `evaluate`, `waitForTimeout`, `reload`, etc. — making it public is the minimum-friction fix and matches the published Playwright examples.

### 3. Call-site collapse

Every `(window as unknown as Record<string, unknown>).__elearn_editor as { … }` becomes `window.__elearn_editor`:

```diff
- const ed = (window as Record<string, unknown>).__elearn_editor as {
-   getSelected: () => { get: (k: string) => unknown } | null
- } | undefined
- return ed?.getSelected()?.get('extendedProperties')
+ const ed = window.__elearn_editor
+ return ed?.getSelected()?.get('extendedProperties')
```

Zero scattered casts remain. 17 specs + 2 utils + 1 POM touched.

### 4. Spec-local spies — `preview-handshake.spec.ts`

`__previewSpy` / `__openerSpy` are only used in this one file — they instrument the postMessage handshake between the opener page and the preview popup. Adding them to the global ambient surface would pollute every other spec's type view.

Fix: declare inline at the top of the spec file:

```typescript
type OpenerSpyState = { messages: Array<{ origin: string; data: unknown }> }
type PopupSpyState = { … }

declare global {
  interface Window {
    __previewSpy?: PopupSpyState
    __openerSpy?: OpenerSpyState
  }
}
```

All `(window as unknown as { __previewSpy?: ... }).__previewSpy` → `window.__previewSpy`.

### 5. `Node.remove()` guard — `docs-screenshots.spec.ts:138`

Same pattern already used at lines 526 and 794:

```diff
- await style.evaluate((el) => el.remove())
+ await style.evaluate((el: Node) => {
+   if (el instanceof Element) el.remove()
+ })
```

`Node.remove()` does not exist; `Element.remove()` does. The runtime element is always an `HTMLStyleElement`, so the guard is a pure TS type-narrow — no behavioural change.

---

## Paired documentation — `docs/developer-guide/10-docs-screenshots-playbook.md`

Every non-obvious technique in `docs-screenshots.spec.ts` catalogued with the failing naive approach, the fix, and the affected manual section:

| # | Technique | Where | Why |
|---|---|---|---|
| T-1 | Defensive fallback per capture | whole spec | Missing panel never aborts campaign |
| T-2 | Tall-panel capture (viewport resize + CSS neutralisation) | §10, §11, §14 | `overflow: auto` + flex-shrink + viewport cap |
| T-3 | Native `<select>` size-expand trick | `14-builder-types.png` | Dropdown closes on screenshot |
| T-4 | `ensureWidgetIsCentered` after every `addBlockById` | all widget captures | `addComponents` places at (0,0) — clipped top-left |
| T-5 | Re-locate widgets after slide switches | §11 | GrapesJS regenerates IDs on reload |
| T-6 | `editor.select(null)` before slide captures | §17 | Props aside inherits stale selection |
| T-7 | Clean-filename bypass (direct `page.screenshot`) | §15, §17 | `captureFullPage` always appends `-fullpage` |
| T-8 | `pasteSceneDef` + `selectOption` sequencing | §14 | Builder only renders with matching simType + valid JSON |
| T-9 | Event-menu toggle close | §10 rows | Menu occludes subsequent captures |
| T-10 | Moodle context in §16 | §16 SCORM | Isolated session for LMS screenshots |
| T-11 | Category-by-index crops | §04–§08, §12 | `.gjs-block-category` has no stable text selector |
| T-12 | `ensureClickEvent` guard | §09 | `+ Event` button hidden once all events added |

Also documents the 6 deferred placeholders (02-create-course, 09-widget-name-field, 09-widget-dropdown-names, 13-overview, 13-hotspot-editor, 01-full-ui-annotated) with the structural reason each cannot be scripted.

Spec header updated with cross-reference so anyone editing the spec finds the playbook first.

---

## Verification

- `npx tsc --noEmit` in `e2e/` → **exit 0** (was 109 errors).
- `grep 'as unknown as' / 'Record<string, unknown>'` in `e2e/` → **0 matches**.
- `authoring-ui-layer.spec.ts` → **22/22 pass** in 1m 42s on `chromium` (covers T608.1 left-sidebar tabs, T608.2 right-sidebar tabs, T608.3 new-slide button, T608.4 publish dialog, T608.5 Props empty-state + MC panel + deselection, T608.6 delete slide, T622.7 save-error banner retry). Zero runtime regression introduced by the type refactor.
- Spec files touched: 17 specs + 2 utils (`screenshot.ts`, …) + 1 POM (`EditorPage.ts`) + 1 new `.d.ts`.

---

## Deliberate non-scope

- **Migrating `e2e/tsconfig.json` to the project's stricter lint profile** — out of scope. The current config (`strict: true` + `noUncheckedIndexedAccess` default) is sufficient to catch the patterns TD-012 cleaned up. A stricter profile would surface additional real issues that are not related to the escape-hatch pattern and deserve their own block.
- **Adding `pnpm --filter e2e exec tsc --noEmit` to CI** — flagged in the structural-lesson note of `tasks.md` but deliberately not added in this block. Wiring it changes CI behaviour and has its own review surface. Tracked as a follow-up.
- **Fixing the 6 deferred screenshot placeholders** — each requires a distinct UX decision (Name trait panel refactor for `09-widget-name-field`, Zustand/autosave rethink for `09-widget-dropdown-names`, Simulation Editor state seeding for `13-overview` / `13-hotspot-editor`, etc.). Documented in the playbook with the structural reason; not a type-safety concern.
- **Replacing `toArray()` / `models` / `length` / `at` / `add` on `E2EComponents` with a single canonical accessor** — the specs reach for whichever is most ergonomic per assertion. Collapsing them would force every call site to route through one API shape, generating churn without improving safety.

---

## Follow-ups (optional, tracked separately)

1. **CI integration** — add `pnpm --filter @elearn-studio/e2e exec tsc --noEmit` to the CI workflow so TD-012's invariant (`grep 'as unknown as' → 0 matches`, `tsc --noEmit → exit 0`) is enforced. Prevents a re-accumulation cycle.
2. **`09-widget-dropdown-names` structural fix** — requires the Zustand course store to be populated after session-level widget additions, not only at app bootstrap. Candidate for a future block.
3. **Grapesjs types experiment** — if `grapesjs` types ever become tree-shakeable at the `.d.ts` layer (currently they ship as one giant namespace), consider replacing `E2EEditor` with a direct import. Not a priority until the payload cost drops.

---

## Issues by severity

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW
None.

### INFO
- **I-01 — `e2e/tsconfig.json` does not extend a shared base.** It redeclares `target`, `module`, `strict`, etc. inline. Acceptable for a test-only package but a future refactor could extract a `tsconfig.base.json` at the monorepo root. Not in TD-012 scope.
- **I-02 — `E2EEditor.select(component: E2EComponent | null | undefined)` accepts `undefined` in addition to `null` for ergonomics.** The runtime grapesjs `select()` method accepts null and undefined equivalently (both deselect). Documented implicitly in the type; no caller would be surprised.
