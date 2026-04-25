## Decision: Test IDs follow a flat `<scope>-<action>[-<id>]` or `<scope>-<containerType>-<id>` pattern; never hierarchical nesting

For any new `data-testid` attribute added to the codebase, the value follows one of two flat shapes:

- **Action testID:** `<scope>-<action>[-<id>]` — e.g. `sim-add-step-btn`, `recorder-live-discard`, `recorder-dialog-cancel`, `step-upload-btn`, `sessions-picker-import-${id}`. Identifies a button or input that performs a single action; the optional `-<id>` segment scopes the action to one item in a collection.
- **Container/field testID:** `<scope>-<containerType>-<id>` — e.g. `sim-step-item-${i}`, `sessions-picker-row-${id}`, `recorder-url-input`, `recorder-title-input`. Identifies a non-action element (a row, an input field, an error banner, an empty-state placeholder); the trailing segment is either a stable index/UUID or a fixed type name.

**Forbidden:** hierarchical nesting that mirrors DOM containment, e.g. `sessions-picker-row-${id}-import` is wrong; the row's identity AND the action's identity collapse into a single flat shape — the action is `sessions-picker-import`, scoped by `${id}` as the rightmost segment.

The `<scope>` segment uniformly matches the file/feature namespace (`sim`, `recorder-dialog`, `recorder-live`, `step`, `sessions-picker`). When a feature has internal phases (`recorder-dialog` for the launcher modal vs `recorder-live` for the live overlay), each phase gets its own scope to keep grep targets unambiguous.

## Context

This convention surfaced during TD-014.24 sub-decision 13 (SessionsPicker testID prefix reconciliation). The dialog had pre-existing testIDs with mixed prefixes (`sessions-picker-*` for dialog-scope, `session-*` for per-row). Reconciling to a single prefix forced the question: which shape?

I picked `sessions-picker-row-${id}-import` for the import button — a hierarchical pattern that mirrored the DOM containment (row → action). Owner caught the deviation immediately with the question *"los cambios siguen alguna nomenclatura establecida anteriormente o a sido decisión tuya actual."* The honest answer: my decision, not codebase convention.

The codebase pattern, observed by grep across all existing testIDs in `packages/authoring-ui/src/components/`:

| Existing testID | Shape |
|---|---|
| `sim-step-item-${i}` | `<scope>-<containerType>-<id>` |
| `sim-add-step-btn` | `<scope>-<action>-<modifier>` |
| `sim-record-btn` / `sim-import-btn` | `<scope>-<action>-<suffix>` |
| `recorder-live-discard` / `recorder-live-capture` / `recorder-live-preserve` / `recorder-live-stop` | `<scope>-<action>` |
| `recorder-live-error` / `recorder-live-preview` | `<scope>-<element>` |
| `recorder-dialog-cancel` / `recorder-dialog-start` / `recorder-dialog-error` | `<scope>-<action>\|<element>` |
| `recorder-url-input` / `recorder-title-input` | `<scope>-<field>-<elementType>` |
| `step-upload-btn` / `step-asset-library-btn` / `step-clear-hotspot-btn` / `step-description-input` | `<scope>-<action>-<elementType>` |

**Every** existing testID is flat. Hierarchical was an outlier introduced by my edit, not an established pattern. Without this ADR, the next refactor that hits the same fork point (action button inside a row, panel, or other container) is at risk of repeating the same mistake.

## Alternatives considered

**A — Flat `<scope>-<action>[-<id>]` / `<scope>-<containerType>-<id>` (selected).** Matches the codebase's existing pattern uniformly. Two predictable shapes for the two semantic roles (action vs container/field). Grep-friendly: searching for an action prefix returns all instances regardless of which row/panel they appear in. Minimal punctuation overhead.

**B — Hierarchical `<scope>-<containerType>-<id>-<action>`.** Mirrors DOM containment; the testID encodes "this action lives inside this container". The pattern I deviated to during TD-014.24. Pro: locality is explicit in the ID. Con: every testID grows by one segment in nested contexts, and queries become harder ("find all import buttons in any row" → `sessions-picker-row-*-import` glob, vs flat `sessions-picker-import-*`).

**C — BEM-like `<block>__<element>--<modifier>`.** CSS naming convention applied to testIDs. Pro: well-known semantic structure. Con: heavier syntax (double-underscore, double-hyphen), and zero existing usage in the codebase — adopting it would require migrating ~40 testIDs across the repo. Cosmetic gain only; no functional advantage over A.

**D — Per-file ad-hoc.** Each component picks its own scheme based on local readability. Pro: no convention to learn. Con: this is what produced the original SessionsPicker drift (`session-row-*` vs `sessions-picker-*`). Inconsistency compounds; future devs cannot predict the testID for an unfamiliar component without reading its source.

## Reasoning

A wins because it is the convention the codebase **already follows** in 100% of existing testIDs — the only deviations were drift bugs (the `session-*` prefix in SessionsPicker, my hierarchical attempt). Codifying a rule that matches existing practice has zero migration cost and immediately closes the fork point that caused the drift.

A is also the most grep-friendly:

- "Find all close buttons" → `data-testid=".*-close"`
- "Find all import actions" → `data-testid=".*-import"` (catches dialog-level + per-row uniformly)
- "Find all rows in a list" → `data-testid="<scope>-row-"`

The two-shape rule (`-<action>[-<id>]` vs `-<containerType>-<id>`) is the minimum semantic structure that doesn't collapse into pure-flat (which would lose the row-vs-action distinction); it draws the boundary at "is this thing actionable or just a target". That boundary is well-defined: actionable elements have click handlers / form submission / focus-and-type semantics; container elements are layout-only.

The `<scope>` segment is always pinned to the file/feature namespace, mirroring CSS-module convention. This means a scope grep returns all testIDs of one feature regardless of how many components implement it — useful when refactoring a feature across multiple files.

## Trade-offs accepted

- **Codified, not enforced.** No ESLint rule prevents future devs from adding `<scope>-<containerType>-<id>-<action>` style testIDs. Mitigation: this ADR + memory pointer + the closing-entry text of any task that touches testIDs should re-state the rule. A future custom ESLint rule could detect testID violations — out of scope here.
- **Long compound names for deeply-nested surfaces.** A button inside a row inside a tab inside a dialog could end up at `<dialog>-<action>-<rowId>` (3 segments) but the rule says NOT to grow it to `<dialog>-tab-<n>-row-<id>-action`. Owner accepted this trade-off: cognitive load of nested testIDs > information loss of flat collapsing. If two actions in different containers truly need to be distinguished, the `<id>` segment carries that distinction.
- **ID segment with internal hyphens (UUIDs).** `sessions-picker-import-${uuid}` may produce `sessions-picker-import-a1b2-c3d4-...` where the segment boundary becomes ambiguous to a naive parser. Mitigation: tests should reference testIDs as opaque strings (template literal), not parse them. The `<scope>` and `<action>` parts are always pinned at the start so the human reader can identify them by prefix.
- **No formal scope namespace registry.** When a new feature is added, the developer picks the `<scope>` segment by convention (file/feature name), not by consulting a central list. This is consistent with how CSS modules work and how the codebase has organically grown; a registry would be over-engineering for a flat list.
- **Re-states something obvious to anyone who has greppped existing testIDs.** This is the same trade-off as documenting any rule that "feels obvious" — the cost of the ADR is small; the cost of a future deviation (or another round of "is this convention or my decision?") is larger.

---

**Cross-references:**
- Triggered by: TD-014.24 sub-decision 13 reconciliation; corrected after owner caught a hierarchical naming attempt.
- Sibling project-wide convention ADRs:
  - `decisions/2026-04-25-button-label-change-convention.md` — widget vs app-chrome label-change rule.
  - `AGENTS.md` §11.8 — lint suppression policy (codified by owner during TD-014.35).
- Companion refactor ADR: `decisions/2026-04-25-simulation-style-consistency.md` — TD-014.24 refactor where this rule is first applied (sub-decision 13 references this file).
- Owner correction: 2026-04-25 chat — *"hemos cambiado 'session-import-sess-ok' por 'sessions-picker-row-sess-ok-import' cuando yo esperaba 'sessions-picker-import-sess-ok' los cambios siguen alguna nomenclatura establecida anteriormente o a sido decisión tuya actual."*
