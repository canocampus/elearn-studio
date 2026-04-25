## Decision: Adopt a shared `simulationTheme.ts` module + app-chrome UX conventions across the 5 simulation namespace surfaces

Extract the duplicated inline `styles` objects from `SimulationEditor.tsx`, `RecorderLauncherDialog.tsx`, `RecorderLiveView.tsx`, `SessionsPickerDialog.tsx`, and `StepForm.tsx` into a single `packages/authoring-ui/src/components/simulation/simulationTheme.ts` source of truth covering colours, fonts, and spacing tokens (the three categories TD-014.24 explicitly enumerates). Concurrently unify three UX dimensions: (a) error message format to the canonical `'X failed: ${msg}'` template, (b) button label-change behaviour to the project-wide rule "widget buttons get label-change, app-chrome buttons do NOT" (so `'Starting…'` on RecorderLauncher and `'Uploading…'` on StepForm are removed — both are app-chrome), (c) testID coverage on `SessionsPickerDialog` (currently zero, blocking future E2E).

## Context

TD-014.24 (the post-sweep refine task that follows the audit-externo Phase A closure) mandates a "consistency pass across all new components" with three explicit deliverables in the spec:

1. Extract shared dark-theme tokens (colours/spacing/fonts) into `simulationTheme.ts`.
2. Unify loading/error UX (all async buttons use the same spinner + disabled pattern).
3. Remove TS `any` / `as any`; respect the TD-004 `ELearnComponent` narrowing discipline.

Survey findings before drafting:

- **6 files** with `styles` objects in `components/simulation/`: 5 listed in spec + `StepForm.tsx` (omission, shares tokens with the rest). Spec also names `AssetPickerModal.tsx` which **does not exist** — the asset library path uses GrapesJS's built-in `editor.AssetManager.open()` instead.
- **High token overlap**: 12 colours used across 4+ files; 4 button patterns (`btnPrimary`, `btnSecondary`, `btnDanger`, `btnDisabled`) duplicated 4× each; the "uppercase label" composite (5 properties) appears identically in 3 files.
- **Production `any`/`as any`: 0 hits.** Tests have 5 `as unknown as Editor`/`CourseDoc` casts — legitimate test scaffolding (mocking the entire grapesjs Editor type would explode the test surface; the narrow casts are the canonical pattern). TD-004's narrowing discipline applies to production code, not test mocks.
- **Real inconsistencies surfaced** by the survey (not anticipated by the spec): dialog heading 15px vs 16px, input fontSize 12px vs 13px, button vertical padding 6px vs 7px, error-banner horizontal padding 10px vs 16px, label-change applied to 2 of ~10 async buttons with no semantic rule explaining the split.
- **Missing testIDs**: `SessionsPickerDialog.tsx` exposes zero testIDs — its only entry point (`sim-import-btn`) is testable but the dialog's internal interactions (close, refresh, per-row import/delete, error, empty) are not. Blocks future E2E work.

The label-change inconsistency turned out to be a project-wide convention I had inverted in my initial proposal — owner correction during planning surfaced the rule and now codifies it for future tasks. See sub-decision §11 below + `~/.claude/projects/D--dev-git-elearn-studio/memory/feedback_button_label_change.md`.

## Alternatives considered

At the top level the alternatives are about HOW to refactor, not WHETHER. Three forks evaluated:

**A. Per-file styles, no shared module** — leave each `styles` object inline; document the duplication as accepted tech debt. Rejected: the spec explicitly mandates extraction; would not close TD-014.24.

**B. Aggressive design-system extraction** — full token scale (`spacing.xs/sm/md/lg/xl/xxl`, `fontSize.tiny/.../display`, etc.) reconciling every divergent value to a canonical scale. Rejected: scope creep into redesign territory; would cause subtle visual changes (1-2px shifts everywhere) without justification beyond "consistency for its own sake"; deviates from the surgical refactor the spec asks for.

**C. Pragmatic extraction (selected)** — extract tokens where there is *measurable consensus* across files (e.g., `gap: 8` appears in 5+ files; `borderRadius: 4` is universal; `#cdd6f4` is the text-primary colour everywhere). Reconcile only the *small* divergences that have no semantic justification (1px button padding drift, 6px error-banner padding drift). Leave outliers inline (`gap: 10` in StepForm, `marginLeft: 24` in RecorderLiveView header, `padding: 24px 18px` for SessionsPicker.empty) where they reflect intentional layout-specific tuning.

Within the selected approach, 13 sub-decisions had branching alternatives. They are tabulated below.

## Reasoning

The pragmatic-extraction approach (C) wins because it captures the actual code's intent — there IS a shared dark-theme palette and a shared button vocabulary, but each surface has layout-specific tuning that the refactor should respect. Forcing every padding to a canonical scale would impose a design system the codebase doesn't have.

The 13 sub-decisions split into four buckets, each with its own rationale:

### Sub-decisions tabulated

| # | Topic | Pick | Reasoning |
|---|---|---|---|
| 1 | Scope StepForm.tsx | A — include | Same UX surface (Sim Editor right panel); shares 6 colour tokens; omission from spec is editorial accident, not intentional exclusion. |
| 2 | AssetPickerModal.tsx | confirm reduction to 5 files | File does not exist; asset library path uses `editor.AssetManager.open()` (GrapesJS built-in). Spec wrote against a planning state that didn't ship. |
| 3 | Spinner UX | A — keep `disabled + style` (no `<Spinner/>` glyph) | Pattern is already consistent across 5 files (all use `style={{ ...btn, ...(busy ? btnDisabled : null) }} disabled={busy}`). Adding a spinner glyph is feature creep, not consistency unification. |
| 4 | RecorderLiveView's green button naming | A — rename `btnPrimary` → `btnSuccess` | Real semantic conflict: `btnPrimary` is BLUE in 4 files (Save/Start/Import) but GREEN in RecorderLiveView (Capture step). Extracting both as `btnPrimary` would emit a name collision. `btnSuccess` matches the green semantic and is reusable for future success-coded actions. |
| 5 | Dialog heading 15px vs 16px | A — unify to 16px | RecorderLauncherDialog uses 16, SessionsPickerDialog uses 15. Same role (modal h2). 16px is the more common dark-UI pattern; SessionsPicker's 15 is unexplained drift. |
| 6 | Input fontSize 12px vs 13px | B — unify to 12px | RecorderLauncherDialog uses 13 (modal with 2 inputs), StepForm uses 12 (panel with 8 inputs in 260px width). Picking 13 reduces density in StepForm noticeably; 12 holds the panel together. |
| 7 | Typography export model | hybrid — primitives + composites | Export `fontSize`/`fontWeight` as primitive tokens (used by most call sites individually) AND export the "uppercase label" composite (`text.label`, 5 properties identical in 3 files). Pure primitives would force every label site to spread 5 props; pure composites would over-export for one-off usages. |
| 8 | Button vertical padding 6px vs 7px | A — unify to 6px | RecorderLauncher uses 7, the other 4 files use 6. No semantic explanation; aligning to majority. |
| 9 | Error banner horizontal padding 10px vs 16px | A — unify to 16px | RecorderLive + SessionsPicker use 16, RecorderLauncher uses 10. RecorderLauncher modal is 420-520px wide — fits 16px padding. |
| 10 | Spacing export model | B — consensus tokens only | Export `radius.default(4)`, `radius.dialog(6)`, `radius.small(3)`, `gap.tight(2)`, `gap.default(8)`, `gap.medium(12)`. Leave one-off paddings (`'12px 14px'`, `'24px 18px'`) inline — they're layout-specific tuning, not tokens. |
| **11** | **Label-change consistency** | **C — remove `'Starting…'`, `'Uploading…'`** | **Application of the project-wide rule codified in [`decisions/2026-04-25-button-label-change-convention.md`](2026-04-25-button-label-change-convention.md): widget buttons get label-change; app-chrome buttons do not. The 5 simulation files are entirely app-chrome; `Start recording`/`Upload…` had label-change by accident, not by convention. Adding label-change to the rest (my initial proposal) would have been the wrong direction — removing it from the two outliers is the right one. See the convention ADR for the full rule statement, alternatives evaluated, and trade-offs.** |
| 12 | Error message format | A — `'X failed: ${msg}'` | Drift surfaced: 4 sites use `'X failed: ${msg}'`, 3 sites use `'Could not X: ${msg}'`/`'Failed to X: ${msg}'`. Picking the majority pattern; it is also tersert + machine-grep'able. |
| 13 | SessionsPicker testIDs | A — add 6 IDs | Real coverage gap: dialog has zero testIDs. Adding `sessions-picker-{close,refresh,error,empty}` + `sessions-picker-row-${id}-{import,delete}` enables future E2E without DOM-position queries. ~10 LOC. |

### Decision #11 expanded — the project-wide rule

This sub-decision is the only one that establishes a convention beyond TD-014.24. Documented also in the saved memory and worth restating here:

> **Widget buttons** (draggable to slides; labels are user-editable in property panels and visible to the learner during preview/publish): label-change applies during async states. The label is the contract under edit; "Starting…"/"Uploading…" mirrors the lifecycle visibly.
>
> **App-chrome buttons** (authoring UI only; labels fixed by JSX; user cannot edit them; learner never sees them): label-change does NOT apply. `disabled` + `btnDisabled` style IS the complete state signal. Adding a textual echo is anti-pattern: visual noise without semantic value.
>
> When unifying inconsistencies, group by widget-vs-app-chrome FIRST. Within app-chrome, label-change drift = bug; remove it. Within widgets, missing label-change = bug; add it.

The owner's wording, captured for the audit trail: *"hay que dejar documentado el motivo real de las decisiones."*

### Action 3 — `any`/`as any` sweep — outcome documented

Pre-decision survey: production `components/simulation/*.tsx` had **0 hits** of `any`/`as any`/`as unknown as`. Test files have 5 `as unknown as Editor`/`CourseDoc` casts — legitimate scaffolding (the alternative is importing the entire grapesjs type surface into test mocks, which is heavier than the cast). TD-004's `ELearnComponent` narrowing discipline applies to production code only; tests can use narrow casts at boundaries. **No code changes required for Action 3** — the goal is already satisfied for production. The hallazgo is logged here as the "did the work, found nothing to change" outcome.

## Trade-offs accepted

- **New shared module to maintain.** `simulationTheme.ts` becomes the single source of truth — future style changes to any of the 5 files must check this module first. Mitigated by colocating the module alongside the components it serves (`components/simulation/`) rather than in a global theme dir, signalling its scope.
- **Diff footprint across 5 files.** Every styles object touches the new theme imports + replaces hardcoded tokens. Each individual change is mechanical; the aggregate diff is large but reviewable file-by-file.
- **Subtle visual reconciliations** in 4 places (decisions 5, 6, 8, 9). Dialog heading shifts 15→16 (1px taller), button padding shifts 7→6 (2px shorter vertical), error-banner padding shifts 10→16 (12px wider horizontal). These are below the user-perception threshold individually but visible if A/B-compared. No screenshot baselines exist for these surfaces; we accept the reconciliation as net-positive consistency vs net-negative micro-regression.
- **Layout-specific outliers stay inline.** `gap: 10` (StepForm.form), `marginLeft: 24` (RecorderLive.headerActions), and `'24px 18px'` (SessionsPicker.empty) are not extracted because they reflect intentional tuning. Future maintainers must understand the rule "tokens for consensus, inline for tuning" — documented in the module's docstring.
- **Decision #11 inverts an apparent feature.** Users currently see `Starting…` / `Uploading…` and may perceive their removal as a regression. Counter-argument: app-chrome label-change is anti-pattern by project convention; the previous behaviour was the regression; now we're returning to the convention. CHANGELOG v0.5.66 entry will note the UX change with the convention as justification.
- **Label-change rule is codified, not enforced.** No lint rule prevents future devs from adding `{busy ? 'Verbing…' : 'Verb'}` to a new app-chrome button. Mitigation: memory file `feedback_button_label_change.md` + this ADR + the rule explained in the closing TD-014.24 entry. A future ESLint custom rule could enforce it; out of scope for `.24`.
- **`SessionsPickerDialog` testID additions enlarge a rendering contract** that no E2E currently uses. Risk: testIDs land but the eventual E2E uses different selector strategies, leaving them as orphaned attributes. Mitigated by aligning the new IDs to the existing `recorder-dialog-*` / `recorder-live-*` naming convention so the eventual E2E author has zero discoverability friction.

---

**Cross-references:**
- Companion convention ADR: [`decisions/2026-04-25-button-label-change-convention.md`](2026-04-25-button-label-change-convention.md) — project-wide rule (widget vs app-chrome) that sub-decision #11 applies. Canonical source for the convention; this refactor ADR is its first consumer.
- Owner directive 2026-04-25: corrected my initial proposal that would have added label-change to all async buttons; surfaced the widget-vs-app-chrome rule that became the convention ADR.
- Spec: `tasks.md` § TD-014.24 (also enumerated in `WORKING_CONTEXT.md` § Phase B execution order).
- Predecessor: `decisions/2026-04-24-recorder-stop-semantics.md` — TD-014.34 introduced `btnDanger` and committed to migrating it to `simulationTheme.ts` at TD-014.24 (this ADR delivers on that promise).
