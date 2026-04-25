## Decision: Label-change on async buttons is reserved for widget buttons; app-chrome buttons use disabled-only as the complete state signal

For any async button in the codebase, the decision of whether to show `{busy ? 'Verbing…' : 'Verb'}` (label-change) or stop at `disabled={busy}` + a dimmed style (disabled-only) is made by classifying the button's **identity**, not its async duration or perceived UX value:

- **Widget button** — a component draggable to a slide whose label is user-editable in a property panel and visible to the learner during preview/publish. Lives under `packages/runtime-player/` and `packages/authoring-ui/src/widgets/` (or wherever GrapesJS blocks are registered). **Label-change applies.** The label IS the contract under edit; "Starting…"/"Uploading…" mirrors the lifecycle visibly, in the same surface the learner will eventually see.
- **App-chrome button** — a component that is part of the authoring UI itself: dialogs, modals, overlays, side panels, headers, footers. Lives under `packages/authoring-ui/src/components/`. Labels are fixed by JSX strings. The user cannot edit them; the learner never sees them. **Label-change does NOT apply.** `disabled` + a `btnDisabled` style overlay (opacity 0.5, cursor not-allowed) IS the complete state signal.

When unifying inconsistencies across a group of buttons, classify by identity FIRST. Within app-chrome, label-change drift = bug, remove it. Within widgets, missing label-change = bug, add it.

## Context

This convention surfaced during TD-014.24 planning (post-audit refine task). The 5 simulation files in scope (`SimulationEditor.tsx`, `RecorderLauncherDialog.tsx`, `RecorderLiveView.tsx`, `SessionsPickerDialog.tsx`, `StepForm.tsx`) had ~10 async buttons. Two of them showed label-change ("Start recording" → "Starting…" in RecorderLauncher; "Upload…" → "Uploading…" in StepForm). The other ~8 (Save & Close, Add step, Stop, Discard, Capture step, Stop & import, Import, Refresh) did not. No documented rule explained the split.

My initial planning proposal was to *add* label-change to the buttons that lacked it (Save & Close, Import, Refresh) under the rationale "consistency across async buttons that take ≥500ms and are uniquely-in-flight". Owner correction (2026-04-25) inverted the direction: the inconsistency was that "Starting…" and "Uploading…" should never have been there — both are app-chrome (RecorderLauncher dialog and StepForm side panel), so the right fix was to *remove* the label-change from those two, not propagate it everywhere. The rule the owner articulated and codified here:

> *"hay que distinguir dos tipos de botones, botones que son widgets arrastrables a los slides, todos tienen que tener label-change, botones que pertenecen a la interface de la app, estos nunca se van a editar sus propiedades, no tiene sentido el label-change"*

Without this convention, every async button in the codebase becomes an ad-hoc judgment call (does this take long enough? is the user anxious about the delay? would a label give comfort?). Identity-based classification removes the judgment: who edits the label, and who sees it.

## Alternatives considered

**A — Label-change on every async button.** Apply `{busy ? 'Verbing…' : 'Verb'}` to all buttons that fire an async handler, regardless of identity. This was my initial proposal during TD-014.24 planning. Argument: maximum feedback for the user during in-flight states.

**B — Time-based rule (label-change if duration ≥ N ms).** Wire a per-button timer; show label-change only when the action is expected to exceed a threshold (e.g., 500ms). Argument: only "slow" actions need textual feedback; "fast" actions don't.

**C — Identity-based rule (selected): widget = label-change; app-chrome = disabled-only.** Classify by who edits the label and who sees it. Widget labels are user-editable + learner-visible; their visible lifecycle states are part of the contract under edit. App-chrome labels are fixed; the visible state is `disabled`.

**D — Disabled-only universally; no label-change anywhere.** Strip "Starting…" and "Uploading…" from the existing two outliers; never add label-change to any button. Argument: simplest possible rule.

## Reasoning

C wins because identity is a **stable, observable property** of every button in the codebase — you can answer "is this widget or app-chrome?" by looking at where the file lives and whether a property panel can edit the label, in O(1) time, without judgment. The other alternatives all require subjective evaluation:

- **A** requires no judgment but generates anti-pattern UX on app-chrome: a button labelled "Save & Close" → "Saving…" is meaningless feedback because the user cannot edit "Saving…", the learner never sees "Saving…", and the disabled state already communicates "in flight". The label change is pure visual noise echoing a state the surface already shows.
- **B** requires per-button judgment of expected duration AND a wiring change (timer) AND a threshold pick. Threshold drift between buttons would re-introduce the inconsistency the rule was meant to eliminate. Worse: actual duration depends on network, server load, and dataset size; a button that's 200ms in dev tests can be 2s in production for a slow user.
- **D** is simpler than C but throws away genuinely useful UX in widget contexts. A widget button whose label is `Submit` and runs an `onSubmit` async handler benefits from `Submitting…` in preview/publish — the learner sees it, the author edits the verbs in the property panel, the lifecycle states are part of the widget's contract.

C also aligns with how the codebase is already organized: `packages/runtime-player/` (widgets — runtime surface, learner-facing) is a different concern from `packages/authoring-ui/src/components/` (chrome — authoring surface, author-facing). The rule mirrors the architectural separation already enforced by the package layout.

## Trade-offs accepted

- **Codified, not enforced.** No ESLint rule prevents a future developer from adding `{busy ? 'Verbing…' : 'Verb'}` to a new app-chrome button. Mitigation: this ADR + the opening section of any TD-related task that touches buttons should re-state the rule. A future custom ESLint rule could detect `style={{ ...btn, ...(flag ? btnDisabled : null) }} disabled={flag}` paired with conditional textContent and warn — out of scope here.
- **Inverts apparent feature in TD-014.24.** Users who memorized "Starting…" and "Uploading…" on the existing two buttons will perceive their removal as a regression. Counter-argument: app-chrome label-change is anti-pattern by this rule; the previous behaviour was the regression vs convention; restoring disabled-only is the correction. CHANGELOG entry must explain this so the change isn't filed as accidental UX loss.
- **Boundary cases require thought.** A widget mounted INTO an app-chrome surface for preview (e.g., the in-overlay preview of a `<ButtonWidget>`) is structurally a widget and follows the widget rule, even though it temporarily renders inside chrome. Conversely, an app-chrome button that happens to expose a customizable label via prop drilling is still app-chrome (the prop is dev-time wiring, not user-time editing). Rule of thumb: who can edit the label at *runtime* via the property panel? If yes → widget. If no → app-chrome.
- **Doesn't address loading indicators beyond the button itself.** Surfaces with prolonged async work (e.g., `RecorderLiveView` polling at 500ms) still need their own loading affordances (preview placeholder, progress UI). This rule covers buttons; broader loading UX is a separate concern.

---

**Cross-references:**
- Triggered by: TD-014.24 planning (Phase B refine after audit-externo sweep).
- Owner correction: 2026-04-25 chat — reversed my initial "add label-change everywhere" proposal.
- Companion ADR: `decisions/2026-04-25-simulation-style-consistency.md` — the TD-014.24 refactor that applies this rule to the 5 simulation app-chrome surfaces (sub-decision #11).
- Memory mirror: `~/.claude/projects/D--dev-git-elearn-studio/memory/feedback_button_label_change.md` — private agent-side cache pointer to this ADR; canonical source is THIS file.
