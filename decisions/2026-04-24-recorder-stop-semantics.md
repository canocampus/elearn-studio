# Decision: Split recorder stop semantics into three distinct actions (Stop & import / Stop / Discard)

**Date:** 2026-04-24
**Task:** TD-014.34 (F2 from audit externo 2026-04-24)
**Status:** Accepted (delivered 2026-04-24 — see TD-014.34 closing notes in `tasks.md` for the delivery summary)
**Author:** self (pair-review with owner)
**Related:** `docs/issues/issues-TD-014.md` § "Audit externo 2026-04-24 — F2 resolution"

---

## Context

`RecorderLiveView.tsx` currently exposes two exit paths from a live recording session:

| Action | UI today | What it actually does |
|---|---|---|
| "Stop & import" button | Primary blue | `stop()` → persist to Garage → `importSimulation` → `setConfig` → `reset()` |
| "Cancel" button | Neutral outline | `stop()` → persist to Garage → `reset()` |
| Esc key | `window.confirm('Stop and discard this recording?')` → same path as Cancel | Persists the session to Garage despite the "discard" wording |

The audit externo (2026-04-24) flagged F2 as a contradiction: the user-facing copy says *"discard"*, but the effect is preservation — the session lands in `recordings/{sessionId}/session.json` and reappears in `SessionsPickerDialog`. Two orthogonal problems:

1. **Semantic overload of "Cancel"**. Western UI convention reads *Cancel* as *abort + discard*. Reusing the button for *stop + preserve* (Option B below) keeps the bug in a different dimension: the copy matches what the code does, but the word on the button still means something else to the user.
2. **No in-overlay path for real discard**. A user who realises mid-recording they captured something sensitive (credentials visible, PII in a screenshot) has no way to destroy the recording from the live view. They must stop, close the overlay, open SessionsPicker, and delete manually.

The existing `deleteSession` API (`DELETE /recorder/sessions/:id`) exists and is already used by the E2E cleanup in `simulation-recorder.spec.ts` — the missing piece is wiring it into the live-view exit path.

### Relevant backend / store invariants

- `POST /recorder/stop` (in `packages/simulation-engine/src/routes/recorder.ts:174`) persists the full session to Garage **before** returning. It does NOT delete.
- `recorderStore.stop()` (in `packages/authoring-ui/src/store/recorderStore.ts:98`) only flips `recording: false` on success — a failed stop deliberately leaves `recording: true` so the user can retry. Quoting the in-source comment:
  > "Only flip `recording: false` on success — a failed stop leaves the session alive on the backend so the user can retry."
- `recorderApi.deleteSession` (in `packages/authoring-ui/src/api/recorderApi.ts:73`) resolves on 204; rejects with `/404/` in the message on 404, `/500/` on 500 (see `recorderApi.test.ts:110-117`).

These invariants constrain the shape of any correct `handleDiscard` — see Implementation Notes below.

---

## Options Evaluated

### A — Cancel = destructive (single button, honours current "discard" copy)

Keep a single exit button; make `handleCancel` call `deleteSession` after `stop`. Add `window.confirm` to the Cancel button (the Esc path already has one).

**Pros**
- Honours the existing copy — *discard* means *discard*.
- Privacy-friendly by default.
- Minimal net storage growth.

**Cons**
- **Destructive without recovery.** A misclick on Cancel = N minutes of work gone unless a confirm is added (which pushes diff size to near-parity with Option C).
- Eliminates the iterative workflow (record → test → re-import from picker) that `SessionsPickerDialog` already supports.
- Network race: if `stop` persists but `deleteSession` fails, an orphan lands in Garage and the user believes they discarded.

### B — Preserve + rename copy (single button, rename to "Stop")

Rename the confirm copy to *"Stop recording? You can re-import it later from the Sessions list"* and (optionally) relabel the button from "Cancel" to "Stop". No `deleteSession` wiring.

**Pros**
- Minimal diff (copy-only).
- Accident-safe — nothing ever gets destroyed by mistake.
- Directly supports the iterative workflow.

**Cons**
- **Cancel is still semantically overloaded** — even relabelled, users who learn the app through muscle memory from other Western UIs will read *"Stop"* as *"abort + discard"*. The word is merely a different shade of the same overloading.
- **No in-overlay discard path.** Privacy-motivated destruction requires a round-trip through SessionsPicker.
- Garage grows monotonically until manual cleanup.

### C — Split into three actions (Stop & import / Stop / Discard) ✅ Selected

Keep "Stop & import" as the primary button; split the current "Cancel" into two distinct exits with single-responsibility semantics:

- **Stop** (secondary, neutral) — `stop()` → persist to Garage → reset local state. Re-importable from `SessionsPickerDialog`. Toast reports the real captured-step count.
- **Discard** (destructive, requires confirm) — `stop()` → `deleteSession()` → reset local state. Real destruction, honours the word.

Esc key maps to `handleDiscard` (with its own confirm) — consistent with the *"Esc = throw away my pending work"* convention in dialog UX.

**Pros**
- Each button has exactly one semantic — no overloading.
- Copy = real verbs (*Stop & import* / *Stop* / *Discard*); zero "Cancel" ambiguity.
- Supports both legitimate workflows (iterative + privacy) without forcing a global philosophy.
- Each exit path is independently testable.

**Cons**
- Three exits in the overlay header increase visual noise.
- Slightly more test surface (three handlers × happy/sad paths).
- Adds a `btnDanger` style variant not currently in the overlay theme.

### Rejected: D — Split-button / overflow menu

Collapse "Stop" + "Discard" into a split-button or kebab menu. Rejected at design time because it hides the destructive action behind an extra click, which is worse for a user who *does* want to destroy sensitive content quickly. Single-click explicit buttons keep the menu discoverable; visual hierarchy (see Implementation Note 4) handles the accidental-click risk.

---

## Selected Design — Option C

### Handler contracts

```ts
// handleStopAndImport — unchanged from current implementation
async function handleStopAndImport() {
  /* existing code */
}

// New — secondary stop, preserves session in Garage
async function handleStopPreserve() {
  const persisted = await stop()
  if (!persisted) {
    // stop() failed — recorderStore has set error + kept recording=true.
    // Do NOT reset(); the user can retry Stop or switch to Discard.
    toast.error(`Failed to stop recording: ${useRecorderStore.getState().error ?? 'unknown error'}`)
    return
  }
  const count = persisted.steps.length
  toast.info(`Recording stopped — ${count} step${count === 1 ? '' : 's'} saved to Sessions`)
  reset()
}

// New — destructive path, requires confirm
async function handleDiscard() {
  if (!window.confirm('Discard this recording? This cannot be undone.')) return

  const persisted = await stop()
  if (!persisted) {
    // Same invariant as handleStopPreserve — don't reset on failed stop.
    // The user can retry Discard or fall back to Stop.
    toast.error(`Failed to stop recording: ${useRecorderStore.getState().error ?? 'unknown error'}`)
    return
  }

  try {
    await recorderApi.deleteSession(persisted.id)
    toast.info('Recording discarded')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 404 === success (resource is already gone). Any other failure means the
    // session survives in Garage — surface it and still reset local state,
    // otherwise the user is trapped in the overlay. They can delete from
    // SessionsPicker as a manual fallback.
    if (/404/.test(msg)) {
      toast.info('Recording discarded')
    } else {
      toast.warning(`Recording stopped but cleanup failed: ${msg} — remove it from Sessions list.`)
    }
  }
  reset()
}
```

### Button layout

Left-to-right, grouped with explicit spacing:

```
[Discard]       ·       [Stop] [Stop & import]
```

- **Discard** — leftmost, separated from the Stop group with a spacer or visible divider. Rationale below (Implementation Note 4).
- **Stop** — neutral styling (`btnSecondary` or existing `btnCancel` — reuse the outlined variant).
- **Stop & import** — rightmost, retains `btnSave` primary styling.

Esc → `handleDiscard` (with its confirm). Keyboard `c` → `capture` (unchanged).

### Test IDs

- `recorder-live-stop` → kept but **semantic change**: now represents "Stop & import". E2E `simulation-recorder.spec.ts:71` already uses it for the happy path — no test change needed.
- `recorder-live-preserve` → **new**, for the Stop (preserve) button.
- `recorder-live-discard` → **new**, for Discard.
- `recorder-live-cancel` → **removed** (replaced by the two new ids). No existing test references it.

---

## Implementation Notes (acordadas con owner 2026-04-24)

Four refinements over the raw Option C sketch, captured after owner review:

### 1. `stop()` failure in both `handleStopPreserve` and `handleDiscard` must NOT call `reset()`

The `recorderStore.stop()` action deliberately keeps `recording: true` on failure so the user can retry. The initial sketch of Option C called `reset()` unconditionally, which would wipe local state while the backend still believed the session was live — producing a zombie session with a lost `activeSessionId`, unreachable from both Stop and Discard paths.

**Contract:** after `stop()`, both handlers check the return value. If `undefined` (failure), surface the error via `toast.error` and **return without calling `reset()`**. The user stays in the overlay and can retry Stop or click Discard as a fallback. Recorder store's `error` field is already populated by `performCourseMutation`'s `onError` hook — read it for the toast message.

Mirrors the deliberate design of `recorderStore.stop` (`packages/authoring-ui/src/store/recorderStore.ts:105-107`) and aligns with `SaveErrorBanner`'s "retry" mental model.

### 2. DELETE returning 404 is functional success, not warning

`recorderApi.deleteSession` rejects with `/404/` in the error message when the session is already gone. Semantically this is the happy path — we wanted the resource destroyed, and it is.

**Contract:** `handleDiscard`'s catch block inspects the error message. If it matches `/404/`, emit the same `toast.info('Recording discarded')` as the happy path. Any other error (500, network, etc.) surfaces as `toast.warning` with a manual-fallback hint pointing at the Sessions list. Local state resets in the non-404 warning path too (the session is orphaned in Garage but the author is not stranded in the overlay).

### 3. Stop-preserve toast reports real captured-step count

The generic copy *"Recording saved — import from the Sessions list when ready"* glosses over the edge case where the user opened the recorder and stopped without capturing anything: a zero-step session lands in Garage and the toast is technically truthful but misleading.

**Contract:** toast copy is `Recording stopped — ${count} step${count === 1 ? '' : 's'} saved to Sessions`, where `count = persisted.steps.length`. If `count === 0` the user reads *"0 steps saved"* and can act accordingly (either open SessionsPicker and delete, or ignore).

Rejected the more-complex alternative of auto-discarding zero-step sessions inside `handleStopPreserve` — that would hide a destructive action behind a button labelled "Stop", exactly the kind of implicit rule the split was meant to eliminate.

### 4. Discard button is leftmost, separated from the Stop group

Western reading order conditions users to expect the rightmost button in a row to be the "close / final / commit" action. Putting Discard at the right end (adjacent to "Stop" and "Stop & import") creates a misclick target for users who merely wanted to end the session cleanly — the `window.confirm` catches the accident but the fricción is bad UX.

**Contract:** button ordering in the header `headerActions` flex row is:

```tsx
<div style={styles.headerActions}>
  <button data-testid="recorder-live-discard" style={styles.btnDanger} ... />
  <div style={styles.actionSpacer} />      {/* flex: 1 OR visible divider */}
  <button data-testid="recorder-live-capture" style={styles.btnPrimary} ... />
  <button data-testid="recorder-live-preserve" style={styles.btnCancel} ... />
  <button data-testid="recorder-live-stop" style={styles.btnSave} ... />
</div>
```

The spacer creates unambiguous visual grouping: destructive exit on the margin, capture + stop-group on the right-hand flow line. Pattern borrowed from editor-class UIs (Figma, Notion) where destructive actions are deliberately removed from the eye's natural path to the primary action.

---

## Guardrails

1. **`recorderStore.stop()` return-value discipline.** `undefined` means failure; handlers MUST check before side-effecting. A future handler that ignores the return value and calls `reset()` reintroduces the zombie-session bug flagged in Implementation Note 1. Documented in the store's docstring.
2. **`deleteSession` 404-is-success discipline.** Any future caller that invokes `deleteSession` in a cleanup/retry loop should mirror the 404-silent pattern; document inline at `recorderApi.deleteSession`.
3. **Button styling: `btnDanger` is new to the overlay.** Add the style token to the shared `simulationTheme.ts` already scoped for TD-014.24 so it's reusable by future destructive actions in the overlay (e.g., "Delete step").
4. **Esc = destructive path with confirm.** Consistent with the current Esc behaviour; document in the user-manual §13 update (TD-014.25 already open).

## Tests to add

In `packages/authoring-ui/src/__tests__/simulation/RecorderLiveView.test.tsx` (new describe block `TD-014.34 — stop semantics`):

1. **`handleStopPreserve` happy path** — `stop()` resolves with a 2-step session → `deleteSession` NOT called → `toast.info` text matches `/2 steps saved/` → `reset()` called (assert `recorderStore.recording === false`).
2. **`handleStopPreserve` zero-step session** — `stop()` resolves with `steps: []` → toast text matches `/0 steps saved/` (asserts Implementation Note 3's count-aware copy).
3. **`handleStopPreserve` on stop failure** — `stop()` resolves with `undefined`, `recorderStore.error = 'network'` → `toast.error` matches `/network/` → `reset()` NOT called → `recording` stays `true` (asserts Implementation Note 1).
4. **`handleDiscard` confirm cancelled** — `window.confirm` returns `false` → neither `stop` nor `deleteSession` called → `reset()` NOT called.
5. **`handleDiscard` happy path** — confirm accepted → `stop` resolves → `deleteSession` resolves → `toast.info('Recording discarded')` → `reset()` called.
6. **`handleDiscard` delete 404** — confirm accepted → `stop` resolves → `deleteSession` rejects with `/404/` → `toast.info('Recording discarded')` (NOT warning) → `reset()` called (asserts Implementation Note 2).
7. **`handleDiscard` delete non-404 failure** — `deleteSession` rejects with `/500/` → `toast.warning` with "remove it from Sessions list" hint → `reset()` still called (user not stranded).
8. **`handleDiscard` on stop failure** — `stop` returns `undefined` → `deleteSession` NOT called → `toast.error` → `reset()` NOT called, `recording` stays `true` (asserts Implementation Note 1 applies to Discard too).
9. **Esc key triggers `handleDiscard`** — assert the window `keydown`/Escape listener reaches the Discard path (confirm gated).
10. **Button DOM contract** — assert `recorder-live-discard` is the first child of `headerActions` and `recorder-live-stop` the last (asserts Implementation Note 4 layout).

Integration test `SimulationEditor.integration.test.tsx` updates: add one test exercising the overlay's Stop button (count-aware toast verified) and one exercising Discard's happy path (asserts `deleteSession` called).

E2E test `simulation-recorder.spec.ts` unchanged — already uses `recorder-live-stop` for the happy import path; no new id dependencies introduced for the E2E.

## Risks & rollback

- **Risk**: author confusion during the migration window (they press the now-renamed buttons and get unexpected behaviour). **Mitigation**: short user-manual §13 paragraph documenting the three verbs; CHANGELOG entry flags the UX change at v0.5.66.
- **Risk**: `btnDanger` styling clashes with toast error styling (both red). **Mitigation**: reuse the toast accent `#f38ba8` as border only, neutral background — matches `ToastProvider`'s `error` palette without full red fill.
- **Risk**: 404-silent pattern hides a real backend bug where DELETE systematically returns 404 because the session key is wrong. **Mitigation**: `recorderApi` already logs the URL + status on reject; if cleanup silently returns 404 in production, Grafana-style log search catches it. Acceptable — the user-visible outcome ("gone") matches the intent either way.
- **Rollback**: purely additive UI split; revert the RecorderLiveView + tests commit and Option C reverts cleanly. Decision file stays as historical record with a rollback note.
