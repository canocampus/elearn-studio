# TD-014 — Self-review & Gap-matrix audit

**Block:** TD-014 — Screenshot Simulation Recorder UI: build missing authoring surface (blocks user-manual §13)
**Status:** 🟡 IN PROGRESS — TD-014.1 complete (this audit); TD-014.2–.28 pending
**Target version:** v0.5.66
**Source trigger:** TD-013.5 pre-block investigation (2026-04-24)

---

## Scope

Produce an objective gap matrix between the workflow `docs/user-guide/13-software-walkthrough.md` promises to the end user and the authoring-side surface actually shipped in `packages/authoring-ui`. Output the matrix + an inventory of backend endpoints already in place so the remaining TD-014 subtasks (.2–.28) are sized against real gaps, not hypotheticals.

Primary sources audited:

- `docs/user-guide/13-software-walkthrough.md` (full)
- `packages/authoring-ui/src/components/simulation/SimulationEditor.tsx` (346 LOC, full)
- `packages/authoring-ui/src/components/simulation/HotspotCanvas.tsx` (117 LOC, full)
- `packages/authoring-ui/src/components/simulation/StepForm.tsx` (162 LOC, full)
- `packages/authoring-ui/src/store/simStore.ts` (84 LOC, full)
- `packages/authoring-ui/src/editor/registerSimBlock.ts` (99 LOC, full)
- `packages/authoring-ui/src/editor/assetManager.ts` (reuse pattern for asset picking)
- `packages/authoring-ui/src/components/sidebar/ButtonPropertiesPanel.tsx` (canonical `editor.AssetManager.open()` pattern — L90-107)
- `packages/authoring-ui/src/api/courseApi.ts` (`importSimulation` client fn — L196)
- `packages/simulation-engine/src/routes/recorder.ts` (310 LOC, full)
- `packages/simulation-engine/src/index.ts` (58 LOC, CORS audit)
- `packages/simulation-engine/src/recorder/types.ts` (63 LOC, full)
- `backend/api/src/routes/simulations.ts` (import route — L92-170)
- `backend/api/src/routes/assets.ts` (POST + GET/:name + DELETE — no list route)

---

## Gap matrix — §13 promises vs. current surface

Columns:
- **§13 promise** — the exact affordance the user-manual chapter promises in prose
- **UI today** — what is reachable in `packages/authoring-ui` right now
- **Backend today** — what the API layer exposes for the affordance
- **Gap type** — `missing-ui` (backend ready, no UI) / `partial-ui` (UI exists but incomplete) / `backend-gap` (UI would need a new backend endpoint) / `implemented` / `not-applicable`

| # | §13 promise (source quote) | UI today | Backend today | Gap type |
|---|---|---|---|---|
| 1 | "Drag **Screenshot Sim** from the **Blocks** tab onto your slide" (§Creating) | ✅ BlockManager.add('screenshot-sim') in `registerSimBlock.ts:93`; appears in "Simulations" category | N/A (client-only) | `implemented` |
| 2 | "**Double-click** the block" (§Creating) | ✅ `view.events.dblclick: 'onDblClick'` in `registerSimBlock.ts:68`; fires `useSimStore.openPanel()` | N/A | `implemented` |
| 3 | "Three columns: **step list**, **screenshot canvas**, **step form**" + header with Mode + Passing + **Save & Close** (§Creating L26) | ✅ Full layout in `SimulationEditor.tsx:48-166`; header controls, body flex, `handleSave` closure | N/A | `implemented` |
| 4 | "click **Add step**" (§Adding steps L32) | ❌ **No button** anywhere in `SimulationEditor.tsx` or `StepForm.tsx` | N/A (pure client state) | `missing-ui` |
| 5 | `simStore.addStep()` action (implied by #4) | ❌ `simStore.ts` exports `openPanel/closePanel/selectStep/updateStep/reorderStep/deleteStep/updateMode/updatePassingScore` — no `addStep`, no `setConfig` | N/A | `missing-ui` |
| 6 | "**Upload** the screenshot for this step" (§Adding steps L33) | ❌ `StepForm.tsx` has no upload control; there is no `<input type="file">` or Upload button anywhere in the simulation components | ✅ `POST /assets` (multipart, returns `{ objectName, url }`); `GET /assets/:name/presigned` for browser-loadable URL | `missing-ui` |
| 7 | "or pick one from the Asset Library" (§Adding steps L33) | ❌ No picker mounted for sim steps. **BUT** canonical pattern exists: `editor.AssetManager.open({ types: ['image'], select(asset, complete) { … } })` used in `ButtonPropertiesPanel.tsx:90-107` — reusable from the overlay since `SimulationEditor.tsx:19` already reads `editor` from `useEditorStore` | ✅ GrapesJS AssetManager config via `assetManager.ts` proxies to `POST /assets`; modal provides browse+upload in one UI. **Caveat**: AM shows only in-memory assets — no persistent `GET /assets` list endpoint exists (see row 28) | `missing-ui` |
| 8 | "The screenshot appears in the centre canvas" (§Adding steps L34) | ✅ `HotspotCanvas.tsx:27-42` — `new window.Image()` loads `step.screenshotUrl`, Konva.Image renders on Stage | ✅ `GET /simulations/screenshot?key=…` proxies Garage (src: `simulations.ts:173-225`) | `implemented` |
| 9 | "Edit the step's fields in the right panel" (§Adding steps L35) | ✅ `StepForm.tsx` — 9 fields: Description, Instruction, Hint, Correct/Incorrect feedback, Demo delay, Max attempts, Hotspot tolerance, Interaction type, Expected text (T202) | N/A (client state) | `implemented` |
| 10 | "drag them up or down to reorder" (§Adding steps L38) | ✅ ↑ ↓ icon buttons in `SimulationEditor.tsx:112-125` → `simStore.reorderStep` | N/A | `implemented` (but not drag-drop — the manual says "drag them"; implementation uses icon buttons. Minor copy mismatch; flagged as I-01) |
| 11 | "drag a rectangle over the area" (§Marking a hotspot L51) | ❌ **Cannot draw new Rect.** `HotspotCanvas.tsx:92-104` renders a single draggable+resizable `<Rect>` bound to `step.hotspot`; there is no `onMouseDown→onMouseMove→onMouseUp` draw-mode. Authored-side manual steps have no hotspot; recorder-imported steps get `deriveDefaultHotspot(raw)` (backend `simulations.ts:143`) but nothing draws one from scratch | N/A | `missing-ui` |
| 12 | "Adjust the rectangle's size by dragging its corner handles" (§Marking a hotspot L52) | ✅ Konva `<Transformer>` in `HotspotCanvas.tsx:105-111`; `handleTransformEnd` writes back via `onChange` | N/A | `implemented` |
| 13 | Interaction type select (§Marking a hotspot L53) | ✅ `StepForm.tsx:91-100` `<select>` with options click/hover/type; conditional Expected text field | N/A | `implemented` |
| 14 | "fill in the **Expected text**" (§Marking a hotspot L54) | ✅ `StepForm.tsx:102-109` conditional on `interactionType === 'type'` | N/A | `implemented` |
| 15 | Mode selector (Demo/Practice/Assessment) (§Mode) | ✅ `SimulationEditor.tsx:56-64` `<select>` in header; wired to `simStore.updateMode` | N/A | `implemented` |
| 16 | Passing Score input (§Passing Score) | ✅ `SimulationEditor.tsx:66-74` `<input type="number">`; wired to `simStore.updatePassingScore` | N/A | `implemented` |
| 17 | "Click **Save & Close**" (§Saving L102) | ✅ `handleSave()` at `SimulationEditor.tsx:25-42` — writes config back to GrapesJS component + triggers `requestSave()` + `closePanel()` | ✅ Persistence via existing `PATCH /courses/:id/slides/:slideId` (atomic) | `implemented` |
| 18 | Delete step (implied) | ✅ ✕ icon button in `SimulationEditor.tsx:126-131` → `simStore.deleteStep`; no confirmation dialog (flagged as I-02) | N/A | `partial-ui` (works, no confirmation) |
| 19 | **"Record" from a real application** (§Adding steps L30 "by recording them from a real application") | ❌ **No UI anywhere in authoring-ui** for starting a recorder session | ✅ `POST /recorder/start {url, title}` → `{ sessionId, status, startedAt }` (recorder.ts:103-141); SSRF + URL length validation; 429 on max-browsers | `missing-ui` |
| 20 | Capture step during recording | ❌ No UI | ✅ `POST /recorder/capture {sessionId}` → `{ steps }` (recorder.ts:143-171); 404 on session-not-found | `missing-ui` |
| 21 | Stop recording + persist to Garage | ❌ No UI | ✅ `POST /recorder/stop {sessionId}` → finalized `Session`; writes `recordings/{id}/session.json` (recorder.ts:173-215) | `missing-ui` |
| 22 | List existing recordings | ❌ No UI | ✅ `GET /recorder/sessions` → `{ sessions: SessionSummary[], total }`; sorted newest-first; `Promise.allSettled` for corrupt-JSON tolerance (recorder.ts:217-252) | `missing-ui` |
| 23 | Live preview of active recording | ❌ No UI | ✅ `GET /recorder/sessions/:id/screenshot` → JPEG with `Cache-Control: no-store` (recorder.ts:285-310) | `missing-ui` |
| 24 | **Import a recorded session into the course** (§Adding steps L30) | ❌ `importSimulation(courseId, sessionId)` exists in `courseApi.ts:196` but **no component calls it** | ✅ `POST /courses/:courseId/simulations/import {sessionId}` → `{ success: true, data: SimConfig }`; derives `AuthoredSimStep[]` with `deriveDefaultHotspot` + `/simulations/screenshot?key=…` URLs (simulations.ts:92-170) | `missing-ui` |
| 25 | `simStore.setConfig(simConfig)` (needed to apply imported result) | ❌ Store has no `setConfig`; `openPanel(config, componentId)` sets initial config but there's no action to swap config mid-session | N/A (client state) | `missing-ui` |
| 26 | Preview via top-toolbar Preview button (§Saving L103) | ✅ `T641` preview (postMessage handshake, `AppLayout.handlePreview`); runtime-player plays Sim via `T025.SimulationPlayer` | ✅ Covered | `implemented` |
| 27 | CORS: authoring-ui (:3000) calls simulation-engine (:3002) | ⚠️ Browser will block cross-origin fetches | ❌ **`packages/simulation-engine/src/index.ts` has no CORS middleware** — only `express.json({ limit: '100kb' })`. Current clients (backend-to-backend import via `simulations.ts`) don't hit CORS. The moment authoring-ui calls `/recorder/*` from the browser, Chrome rejects. | `backend-gap` |
| 28 | Persistent asset listing for the Asset Library (§Adding steps L33) | ❌ No `GET /assets` list endpoint → GrapesJS AM shows only in-memory session uploads | ❌ `backend/api/src/routes/assets.ts` exposes `POST /`, `GET /:name`, `GET /:name/presigned`, `DELETE /:name` — no list route | `backend-gap` (optional — GrapesJS AM's session-only browse is acceptable per manual L33 "Asset Library"; a proper persistent picker is a UX upgrade, not a §13 promise) |
| 29 | Session cleanup (implicit — for tests and for users who want to discard recordings) | ❌ No UI | ❌ No `DELETE /recorder/sessions/:id` endpoint (recorder.ts exposes start/capture/stop/list/get/screenshot only) | `backend-gap` (nice-to-have; only E2E needs it for cleanup — `simulation-recorder.spec.ts`, TD-014.23) |
| 30 | `sessionId` value on manually-created (non-recorded) simulations | ⚠️ `registerSimBlock.ts:82` sets `sessionId: ''` for empty scaffolds — fine today but bleeds into persistence (`SimConfig.sessionId` is a required string in `types/simulation.ts:45`; empty string passes but is semantically wrong) | N/A | `partial-ui` (design decision — I-03) |

**Row count**: 30 rows → **15 gaps, 13 implemented, 2 partial**.

---

## Gap classification by TD-014 subtask

Mapping audit rows → existing TD-014 subtasks (proposed in `tasks.md`). Rows not covered by any subtask become refinement proposals (R-01…).

| Audit row | Fix lives in subtask |
|---|---|
| 4, 5 | TD-014.2 (simStore.addStep) + TD-014.3 (button) |
| 6 | TD-014.4 (Upload button in StepForm) |
| 7 | TD-014.4 + TD-014.5 — **revised**: collapse `AssetPickerModal` into a single `editor.AssetManager.open({ types:['image'], select(…) })` call (existing pattern from `ButtonPropertiesPanel.tsx`). The new component proposed in TD-014.5 is unnecessary; the modal GrapesJS already mounts handles browse + upload in one. See R-01 |
| 11 | TD-014.6 (draw-mode in HotspotCanvas) |
| 18 (confirmation) | TD-014.17 (covered by existing confirmations pass) |
| 19 | TD-014.10 (RecorderLauncherDialog) |
| 20 | TD-014.11 (RecorderLiveView: Capture button) |
| 21 | TD-014.11 (RecorderLiveView: Stop button) |
| 22 | TD-014.12 (SessionsPickerDialog) |
| 23 | TD-014.11 (RecorderLiveView: live JPEG poll) |
| 24 | TD-014.12 (Import button → `importSimulation`) |
| 25 | **NEW** — add to TD-014.2: extend `simStore` with `setConfig(config)` alongside `addStep`. Without this, the Import flow (TD-014.12) cannot write the imported `SimConfig` into the active editing session. See R-02 |
| 27 | **NEW subtask required** — simulation-engine CORS middleware. Cheap fix (`npm i cors` + one-liner). See R-03 |
| 28 | Not addressed in TD-014. Reuses GrapesJS AM's session-only browse; acceptable per manual. Flagged I-04 as a follow-up candidate for a later backend TD |
| 29 | **NEW optional subtask** — `DELETE /recorder/sessions/:id` endpoint + corresponding `recorderApi.deleteSession(id)` client. Only needed for E2E cleanup in TD-014.23. See R-04 |
| 30 | **NEW** — `simStore.addStep` initialises `simConfig.sessionId` on first addStep if empty; or generate a `nanoid` on empty-scaffold creation in `registerSimBlock.ts:82`. See R-05 |

---

## Refinements to the proposed TD-014 plan

### R-01 — Collapse `AssetPickerModal` (TD-014.5) into AM reuse
**Severity**: MEDIUM (scope reduction)
**Rationale**: `editor.AssetManager.open({ types: ['image'], select(asset, complete) { ... if (complete) editor.AssetManager.close() } })` is the canonical pattern (`ButtonPropertiesPanel.tsx:90-107`). `SimulationEditor.tsx` already reads `editor` via `useEditorStore`. Building a new `AssetPickerModal.tsx` duplicates the GrapesJS AM for no gain and creates a divergent pattern.
**Action**: update TD-014.5 in `tasks.md` to read: *"`StepForm.tsx` → Asset Library button invokes `editor.AssetManager.open()` with `types:['image']` + a `select` callback that patches `step.screenshotUrl`. No new component. Drop `AssetPickerModal.tsx` from TD-014 scope."* TD-014.17 (AssetPickerModal.test) becomes unnecessary — remove.

### R-02 — Add `simStore.setConfig(config)` alongside `addStep`
**Severity**: HIGH (blocker for Import flow)
**Rationale**: The Import path (TD-014.12) resolves a `SimConfig` from `courseApi.importSimulation(courseId, sessionId)` and must replace the currently-open editing session's config. There is no store action to do that today; the only entry point is `openPanel(config, componentId)` which resets `selectedStepIndex` and is semantically wrong for an already-open overlay.
**Action**: extend TD-014.2 scope: add `setConfig(config: SimConfig): void` that replaces `config` but preserves `panelOpen`, `editingComponentId`, and clamps `selectedStepIndex` to `[0, steps.length - 1]`.

### R-03 — Add simulation-engine CORS middleware as a first-class subtask
**Severity**: HIGH (blocker for any browser→:3002 call)
**Rationale**: Without CORS, every recorder call from `RecorderLauncherDialog` / `RecorderLiveView` / `SessionsPickerDialog` will hit a CORS error in Chrome and the whole recorder lifecycle UI is DOA. Plan anticipated this but filed it as a risk note, not a subtask.
**Action**: insert **TD-014.8a** *before* the client `recorderApi.ts` work:
> TD-014.8a — Add `cors` middleware to `packages/simulation-engine/src/index.ts`. Allowed origin: env var `SIMULATION_ENGINE_ALLOWED_ORIGIN` (default `http://localhost:3000`). Methods: GET, POST, DELETE. Headers: Content-Type, Authorization. Test: unit test asserts `Access-Control-Allow-Origin` header on a valid origin and rejects an unexpected origin. Do not merge the rest of the block (.8→) until this is in.

### R-04 — Add optional `DELETE /recorder/sessions/:id` + client for E2E cleanup
**Severity**: LOW (quality-of-life + test cleanup)
**Rationale**: TD-014.23 E2E `simulation-recorder.spec.ts` needs to clean up the session it creates, or runs accumulate in Garage. The manual doesn't promise session deletion to users but ergonomically it matters.
**Action**: insert **TD-014.8b**:
> TD-014.8b — `DELETE /recorder/sessions/:id` in `recorder.ts` — validates sessionId format, deletes `recordings/{id}/session.json` + `recordings/{id}/screenshots/*` from Garage. Returns 204 on success, 404 if the session.json is absent. Paired client: `recorderApi.deleteSession(id)`. Not exposed in the user-manual UI (no delete button); internal only for test cleanup until a UX decision makes it user-facing.

### R-05 — Remove `SimConfig.sessionId` entirely (revised 2026-04-24 — Option E)
**Severity**: LOW (data-model hygiene, dead-code removal)
**Investigation (owner request 2026-04-24)**: full monorepo sweep to confirm whether the field has any live consumer.

**Producers (writes):**
- `backend/api/src/routes/simulations.ts:162` — import route copies request-body `sessionId` into the returned `SimConfig`
- `packages/authoring-ui/src/editor/registerSimBlock.ts:82` — manual scaffold sets `sessionId: ''`

**Consumers (reads):**
- **Zero.** Only references are type declarations in 3 packages (`packages/authoring-ui/src/types/simulation.ts:45`, `packages/runtime-player/src/sim/simPlayer.ts:49`, `backend/api/src/types/simulation.ts:57`), OpenAPI schema (`swagger.ts:131-133`), and a single round-trip assertion in `backend/api/src/__tests__/simulations.test.ts:139` (`expect(config.sessionId).toBe('sess-abc')`) which only validates the write path has no functional side effect.
- The runtime player's `mountSimPlayer(el, config, callbacks)` at `simPlayer.ts:104-109` destructures `const { steps, mode } = config` — `sessionId` and `passingScore` are in the interface but not read by the function body. (`passingScore` is read elsewhere via `callbacks`; `sessionId` is not read at all.)

**Note on parameter vs. field**: the `sessionId` parameter passed into `/recorder/*` routes and used as a Garage S3 path key (`recordings/{sessionId}/...`) is **a different identifier** — it is a live value used by the recorder backend + simulation-engine but never reaches the authoring-side `SimConfig`. The recorder's sessionId life ends when `POST /courses/:id/simulations/import` fetches the session JSON, transforms to `SimConfig`, and — currently — copies it into the result. This last copy is the dead write; the parameter itself remains valid and untouched by this change.

**Owner decision (2026-04-24)**: **Option E — remove the field entirely**. Rationale: repo coding-style (`rules/common/coding-style.md`) and patterns (`rules/common/patterns.md`) are explicit — *"Don't design for hypothetical future requirements. No half-finished implementations."* Future features like *"replay the recorder session from this sim"* will plan their own provenance model when they land with real consumers; no need to carry an unconsumed field in the meantime.

**Action**: new subtask **TD-014.2b** (refactor, cross-package) — remove `sessionId` from `SimConfig` interface in 3 packages + OpenAPI schema + the writes in `simulations.ts:162` and `registerSimBlock.ts:82` + the round-trip test assertion. 0 runtime-behaviour change.

---

## Findings summary

| ID | Severity | Title | Resolution |
|---|---|---|---|
| R-01 | MEDIUM | `AssetPickerModal` duplicates GrapesJS AM | Collapse into `editor.AssetManager.open()` reuse. Update tasks.md |
| R-02 | HIGH | `simStore.setConfig` missing — blocks Import flow | Add to TD-014.2 scope |
| R-03 | HIGH | simulation-engine has no CORS — blocks all browser → :3002 | New TD-014.8a subtask |
| R-04 | LOW | No `DELETE /recorder/sessions/:id` for cleanup | New TD-014.8b subtask (optional, scoped to test cleanup) |
| R-05 | LOW | `SimConfig.sessionId` is dead data — producers but zero consumers | **Option E — remove entirely** (owner decision 2026-04-24). New TD-014.2b (cross-package deletion). |
| I-01 | INFO | Manual says "drag them up or down to reorder"; UI uses ↑↓ icon buttons | **Option B — implement drag-drop** (owner decision 2026-04-24). New TD-014.7b reusing `SlideList.tsx::handleDrop` pattern; ↑↓ buttons retained as keyboard/accessibility fallback (Alt+↑/↓). Manual copy augmented, not replaced. |
| I-02 | INFO | No confirmation on step delete | Covered by TD-014.17 |
| I-03 | INFO | `SimConfig.sessionId` semantic clarity | Covered by R-05 |
| I-04 | INFO | No persistent asset listing (`GET /assets`) — GrapesJS AM shows session-only | Deferred; not a §13 promise. Candidate for a future backend TD |

---

## Amendments applied to tasks.md (2026-04-24)

All owner-confirmed amendments landed in `tasks.md`:

1. ✅ **TD-014.2** — extended scope: `addStep` + `setConfig(config)` (R-02).
2. ✅ **TD-014.2b** (new, refactor) — remove `SimConfig.sessionId` entirely (R-05 → Option E). Cross-package deletion covering 3 type files + OpenAPI schema + 2 write sites + 1 test assertion. 0 runtime-behaviour change.
3. ✅ **TD-014.4** — updated to invoke `editor.AssetManager.open({ types:['image'], select(...) })` directly (R-01). No new modal.
4. ✅ **TD-014.5** — marked `[-]` (cancelled, merged into TD-014.4 per R-01).
5. ✅ **TD-014.7b** (new) — drag-drop reorder of step list (I-01 → Option B); reuses `SlideList.tsx::handleDrop` pattern; ↑ ↓ buttons retained as keyboard/accessibility fallback (Alt+↑/↓).
6. ✅ **TD-014.8a** (new, must land before .8) — simulation-engine CORS middleware (R-03). `SIMULATION_ENGINE_ALLOWED_ORIGIN` env var, default `http://localhost:3000`.
7. ✅ **TD-014.8b** (new) — `DELETE /recorder/sessions/:id` endpoint + `recorderApi.deleteSession(id)` client (R-04). Not surfaced in user-manual UI; internal-only for test cleanup.
8. ✅ **TD-014.12** — wires `simStore.setConfig(result)` after successful `importSimulation` (R-02 runtime wire-up; not `openPanel`).
9. ✅ **TD-014.14** — test coverage extended for `setConfig`; `sessionId` assertions dropped.
10. ✅ **TD-014.16** — Asset Library test path reworked: mock `editor.AssetManager.open`, trigger the passed-in `select` callback, assert step patched.
11. ✅ **TD-014.17** — marked `[-]` (cancelled per R-01; Asset Library test coverage merged into TD-014.16).
12. ✅ **TD-014.22** — E2E happy path now includes a drag-drop reorder step validating TD-014.7b + persistence preserves order across reload.
13. ✅ **TD-014.25** — docs copy reconciled: manual line augmented to *"drag them up or down to reorder, or use the ↑ ↓ buttons on each step (keyboard: Alt+↑ / Alt+↓)"*; architecture doc reflects removed `sessionId`.

**Subtask count**: 28 original → **32 total** (+4 new: .2b, .7b, .8a, .8b; 2 cancelled: .5, .17 kept as history markers with `[-]`). Active pending after TD-014.1 close: **29**.

---

## OpenAPI client drift — cleanup guidance (TD-014.27.d)

### Why this section exists

`packages/authoring-ui/src/api/generated.ts` is produced by the pipeline:

```
backend/api/src/lib/swagger.ts (JSDoc annotations)
  ↓ (pnpm --filter api run gen:openapi → ts-node scripts/gen-openapi.ts)
backend/api/openapi.json
  ↓ (npx openapi-typescript ../../backend/api/openapi.json -o src/api/generated.ts)
packages/authoring-ui/src/api/generated.ts
```

Only `pnpm --filter @elearn-studio/authoring-ui run gen:api-client` chains both steps. Any TD-014 subtask that adds/changes/removes a `swagger.ts` annotation OR a JSDoc `@swagger` block in `backend/api/src/routes/*.ts` invalidates `generated.ts` until the regen runs. There is no `lint`/`tsc` check that catches schema drift because `generated.ts` is not imported by any production code in authoring-ui (the type surface is still unconsumed — the file is declarative, used by future OpenAPI-typed fetches).

### Known drift introduced during TD-014

| Source change | Effect on `openapi.json` / `generated.ts` | Detection |
|---|---|---|
| **TD-014.2b** — removed `SimConfig.sessionId` from `swagger.ts:131-133` (`required` list + `properties.sessionId`) | `components.schemas.SimConfig.sessionId: string` still present at `generated.ts:1672` after swagger.ts edit landed. Three other `sessionId` occurrences at lines 1257, 1272, 1288 are **live** — they describe the `POST /courses/:id/simulations/import` request-body parameter (= recorder-session identifier used as a Garage S3 path key via `recordings/{sessionId}/session.json`) and must stay. | `grep -nE "sessionId" packages/authoring-ui/src/api/generated.ts` during TD-014.4 pre-flight check. |
| **TD-014.8b** (pending) — adds `DELETE /recorder/sessions/:id` to simulation-engine backend | N/A for `generated.ts` — simulation-engine has its own HTTP surface; authoring-ui already exposes its client via `recorderApi.ts` (TD-014.8), not via `gen:api-client` (which targets backend/api only). No drift here. | — |
| **Other TD-014 subtasks** (.2, .3, .4, .6, .7b, .8a, .9–.13) | None affect `swagger.ts` or backend routes. | — |

**Net**: only TD-014.2b introduces a stale line in `generated.ts`. A single regeneration at block closure is sufficient; doing it now would be repeated if a future subtask adds a schema change, so the decision (2026-04-24 — owner option B) is to run the regen once as part of TD-014.27.

### Command sequence (run from repo root)

```bash
# 1. Regenerate backend openapi.json from swagger.ts + route JSDoc annotations
#    AND regenerate generated.ts in one command via the authoring-ui script:
pnpm --filter @elearn-studio/authoring-ui run gen:api-client

# 2. Verify the stale line is gone
grep -n "SimConfig" packages/authoring-ui/src/api/generated.ts
#   Expected: interface declares only `mode`, `passingScore`, `steps`
#   Expected: NO `sessionId: string` inside the SimConfig block

# 3. Verify live sessionId references are preserved
grep -nE "sessionId" packages/authoring-ui/src/api/generated.ts
#   Expected: 3 matches — all describing the POST /courses/:id/simulations/import
#   request body (recorder-session identifier, not the removed field)

# 4. Verify tsc still clean across all packages
npx tsc -b packages/authoring-ui packages/runtime-player backend/api
#   Expected: exit 0
```

### What to commit

Two files are regenerated and must be committed together:
- `backend/api/openapi.json` (source of truth, generated from swagger.ts + route annotations)
- `packages/authoring-ui/src/api/generated.ts` (downstream TypeScript types)

Both carry the `do not edit manually` marker in their headers — any manual hand-edit would be overwritten by the next `gen:api-client` run. If the regeneration produces a diff in either file **beyond** the expected removal of `SimConfig.sessionId`, flag it before committing: it means another `swagger.ts` edit in this block was not accounted for in this section. Update this section before proceeding.

### Scope boundary

This cleanup is about **schema drift in downstream-generated files**. It is NOT about:
- The `SimConfig.sessionId` field itself (removed in TD-014.2b — done)
- The live recorder-session `sessionId` parameter (unchanged, stays)
- `docs/api-reference/simulations.md` (hand-written markdown — separate sweep in TD-014.25d)
- `backend/api/openapi.json` commit timing (included in TD-014.27 block closure)

---

## Verdict

**TD-014.1 — COMPLETE + owner decisions applied to `tasks.md` (2026-04-24).**

Two high-severity amendments (R-02 setConfig, R-03 CORS), two scope-cleanups (R-01 AssetPicker collapse, R-04 optional DELETE), one dead-code removal (R-05 → Option E), and one UX upgrade (I-01 → drag-drop in TD-014.7b). No CRITICAL blockers — every gap has a concrete subtask owning its resolution.

Block TD-014 is implementable as amended. Next subtask: **TD-014.2** (simStore: `addStep` + `setConfig`).

**Not in scope for this audit**: implementing any fix. Per AGENTS.md §2, TD-014.1 stops here; TD-014.2 awaits owner confirmation before execution.

---

## Audit externo — findings 2026-04-24 (post-TD-014.23)

**Source**: external audit ran after `AUDIT_BASELINE_SYMPTOMS.md` + `RUNTIME_PLAYER_CHANGES.md` were delivered and subtasks TD-014.1–.23 landed on the working tree. Reviewer read both the production code and the test files in depth, raised **4 initial findings (F1–F4)** then **6 follow-up findings (F5–F11)** after scrutinising the tests themselves. All 11 findings were re-verified by the TD-014 author via `grep`/`read` against the current tree before acceptance.

### Findings table

| ID | Severity | Title | Root symptom | Resolution subtask |
|---|---|---|---|---|
| F1 | HIGH | Drift `interactionType` / `expectedText` backend↔authoring | Backend `simulations.ts` import does NOT set `interactionType`; authoring type declares it required; tests mock-patched the gap with pre-seeded fixtures so the drift stayed invisible | **TD-014.33** |
| F2 | HIGH | Cancel copy says "discard" but session persists to Garage | `RecorderLiveView.handleCancel` calls `stop() + reset()` — never `deleteSession()`. `window.confirm` says "Stop and discard this recording?" — copy lies | **TD-014.34** (owner decision deferred to execution time) |
| F3 | MEDIUM | `?t=${tick}` cache-bust contradicts `getLiveScreenshotUrl` docstring | Docstring says no query needed; code adds one anyway. Mocks replace the helper in tests so the contradiction is invisible | **TD-014.36** — owner decision: **Option B** (fix docstring, keep code; `no-store` is ignored by some corporate proxies and React `<img>` needs query change to re-fetch when string is identical) |
| F4 | MEDIUM | Swagger `SimConfig.steps: array<object>` opaque | `swagger.ts:135` types `steps` as `{ type: 'array', items: { type: 'object' } }` — generated client has no field-level typing | **Merged into TD-014.27.d** (regen OpenAPI also models AuthoredSimStep + SimHotspot as named schemas) |
| F5 | CRITICAL | Drag-drop E2E assertion is a no-op | `toContain(expect.stringContaining(''))` matches every string; comment admits *"keeps spec non-flaky"* — renounced correctness for flake-avoidance | **TD-014.30** |
| F6 | CRITICAL | E2E persistence verifies only presence, not content | After reload, three `toBeVisible()` — no read of instruction values, screenshot src, or post-drag order | **TD-014.31** |
| F7 | HIGH | `__recorderSessionId` never exposed → E2E cleanup silently skipped | Spec reads `window.__recorderSessionId` which no production code sets; `DELETE` never fires; Garage accumulates orphan sessions across CI runs | **TD-014.29** |
| F8 | LOW | URL length limit has an error branch with no test | `RecorderLauncherDialog.tsx:60-63` validates `url.length > MAX_RECORDER_URL_LENGTH` — rama ejecutable sin cobertura | **TD-014.37** |
| F9 | LOW | Test file header promises click-outside + isBusy guards that don't exist | File header line 10 says *"Escape + click-outside close unless isBusy"*; only basic Escape test landed | **TD-014.38** |
| F10 | MEDIUM | Draw-mode gesture not covered end-to-end | `HotspotCanvas.test.tsx:12` says *"validated in TD-014.22 with real page.mouse events"* — the spec only uses mouse events for reorder; Konva Stage → `getPointerPosition` → `rectFromPoints` → `onChange` pipeline untested | **TD-014.35** |
| F11 | CRITICAL | `handleSave` has zero test coverage | `grep handleSave src/__tests__/` → 0 matches. 3 execution paths (component found, component missing, requestSave rejects) all uncovered; silent data loss possible | **TD-014.32** |

### Execution order (enforced by subtask numbering)

The sequence matters — each step unblocks verification of the next:

1. **TD-014.29** — Expose `__recorderStore` + `__simStore` on window in dev/E2E. Unblocks the cleanup path in `.30`/`.31`/`.35` and the assertions in `.34`.
2. **TD-014.30** — Rewrite drag-drop E2E assertion. Depends on `.29` only for the `__simStore` read (optional — can read DOM too).
3. **TD-014.31** — E2E persistence content verification.
4. **TD-014.32** — `handleSave` test coverage (CRITICAL — current state allows silent data loss).
5. **TD-014.33** — Backend `interactionType` initialisation + contract test. Requires fixing `simulations.ts` import route + removing the pre-seed in integration fixture so the mock reflects what the backend really returns.
6. **TD-014.34** — Cancel semantics. **Owner decision pending at execution time**: (A) call `deleteSession(id)` for real discard + match the copy, or (B) rename copy to acknowledge persistence. Do not pre-commit the decision — revisit when the subtask is reached.
7. **TD-014.35** — E2E draw-mode gesture. Depends on `.29` for `__simStore` read.
8. **TD-014.36** — F3 docstring fix (Option B). Confirmed now.
9. **TD-014.37** — URL length test.
10. **TD-014.38** — Click-outside + isBusy guard tests.

### Meta pattern diagnosed

All 11 findings fall under the pattern in `~/.claude/rules/common/ai-regression.md`: **mocked tests pass but production contract is violated**. Tests validated the implementation as written, not the contract they should enforce. Specific sub-patterns:

- **Mocks that lie about the contract**: F1 (pre-seed interactionType), F10 (mock Konva render mode but not the pointer pipeline).
- **Paths that are never tested**: F2 (handleCancel), F11 (handleSave).
- **Mocks substituting the thing being contradicted**: F3 (mock `getLiveScreenshotUrl` stub hides the contradiction).
- **No contract test on downstream artifacts**: F4 (generated client never consumed by prod code → tsc misses drift).
- **Structural matcher chosen to pass, not to verify**: F5 (`expect.stringContaining('')`).
- **Presence assertion substituting content assertion**: F6 (`toBeVisible` without `toHaveValue`).
- **Test code references fictitious API**: F7 (`window.__recorderSessionId` never exposed).
- **Uncovered branch with no documentation of the gap**: F8 (URL length), F9 (click-outside declared but not tested).

### Response strategy

TD-014.29–.38 introduces **contract-first test additions**. The reviewer in TD-014.26 must explicitly check, for every `vi.mock` in the codebase: *"does the mock's return shape match what the real backend returns at this time?"* — adding this to the review checklist closes the loop.

The subtasks are executed in the numerical order above. Each one adds both the fix AND the test that would have caught the original gap — the test protects against future regressions of the same class.

---

## TD-014.25d sweep (2026-04-25)

Cross-cutting user-manual reconciliation per spec line 651 (item d): grep `docs/user-guide/*.md` + `docs/user-manual-v2-scope.md` for `simulation`, `recording`, `recorder`, `screenshot-sim`, `session`, `hotspot`, `Software Walkthrough`. Decision per file (no speculative updates — the rule was: only edit if the sweep surfaces an actual inconsistency).

| File | Hits | Decision | Action |
|---|---|---|---|
| `01-welcome.md` | 3 generic mentions of "simulations" as a block category | No-op — language matches reality (Software Walkthrough + Interactive Scenario both live in the **Simulations** category in the Blocks tab). The annotated `01-full-ui-annotated.png` documents the four main editor areas + five right-sidebar tabs, NOT the Simulation Editor overlay; the new **Record…** / **Import…** buttons live inside that overlay and would not appear in this capture. | None |
| `02-getting-started.md` | none | No-op | None |
| `03-slides.md` | none | No-op | None |
| `04-blocks-basic.md` | none | No-op | None |
| `05-blocks-navigation.md` | none | No-op | None |
| `06-blocks-media.md` | none | No-op | None |
| `07-blocks-assessment.md` | none | No-op | None |
| `08-blocks-questions.md` | none | No-op | None |
| `09-actions-editor.md` | none | No-op | None |
| `10-actions-triggers-reference.md` | none | No-op | None |
| `11-actions-expressions-recipes.md` | none | No-op | None |
| `12-simulations-overview.md` | Software Walkthrough section, generic comparison | **Update** — added one-line summary of the three authoring paths (record / import / manual upload) so chapter 12 acknowledges the recorder workflow before chapter 13 elaborates. | Edited |
| `13-software-walkthrough.md` | full chapter | **Updated in TD-014.25a** — button labels, reorder line, header buttons, Step fields table, Clear hotspot mention, Tip on Record. Audit I-01 closed. | Edited |
| `14-interactive-scenario.md` | "hotspot" hits are scenario-internal (Interactive Diagram) — circular regions on a background image, semantically distinct from Software Walkthrough rectangle hotspots. | No-op — different feature. Disambiguation handled in 20-glossary instead. | None |
| `15-preview.md` | one generic "simulation behaves" mention | No-op — accurate | None |
| `16-publish-scorm.md` | none | No-op | None |
| `17-worked-example.md` | none — worked example does not include a Software Walkthrough slide | No-op | None |
| `18-troubleshooting.md` | (no recorder entry yet) | **No-op (reverted)** — initial draft added §10 "The Software Walkthrough recorder fails to start, capture, or stop". Owner caught that it leaked engineering vocabulary into the user manual ("simulation-engine process", "CORS error in the browser console", "the recorder's allowed origin"). Reverted to baseline. Recorder failure-mode docs deferred until they can be expressed in pure user-observable symptoms. | Reverted |
| `19-qa-developer-guide.md` | one mention of `simulation-engine` package path | No-op — package name accurate | None |
| `20-glossary.md` | Simulations section had Hotspot defined only for Interactive Diagram | **No-op (reverted)** — initial draft broadened **Hotspot** and added **Record**, **Recording session**, **Session ID**. The Session ID entry leaked engineering vocabulary ("persisted recording manifest", "recorder service") that should not appear in a user glossary. Reverted to baseline. **Hotspot** disambiguation and the Record / Recording-session terms can be re-introduced in a follow-up only with strictly user-facing phrasing. | Reverted |
| `index.md` | already references §12-§13 | No-op | None |
| `user-manual-v2-scope.md` §4 §12-§13 | scope file already declares "Recording a sequence" for §13 | No-op — scope and chapter content now aligned | None |

**Files edited:** 2 (`12-simulations-overview.md`, `13-software-walkthrough.md`).
**Files inspected with no change required:** 18 + scope file.
**Files reverted after owner review:** 2 (`18-troubleshooting.md`, `20-glossary.md`) — content was technically accurate but used developer vocabulary that does not belong in the user manual.
**Cross-link to architecture:** the new `docs/developer-guide/11-simulation-recorder-architecture.md` (TD-014.25c) is referenced from `developer-guide/index.md` and `docs/developer-guide.md`; user-guide links remain limited to user-guide siblings (per the AGENTS.md docs-discipline split).
**Lesson recorded** (codified in feedback memory): user-manual files describe author-observable behaviour only. Developer concepts — HTTP status codes, CORS, ports, service names, internal manifests, store internals — belong in `developer-guide/`. When a spec mentions technical shortcuts ("add CORS / 503 / session-not-found" or "Session ID lives in recorder-backend state"), translate them into user symptoms before drafting; do not import the spec phrasing verbatim.

---

## TD-014.26 — reviewer pass (2026-04-25)

Two reviewer agents (code-reviewer + typescript-reviewer) ran in parallel against the uncommitted TD-014.24 production code (`simulationTheme.ts` + 5 component refactors + 3 test updates) and the new TD-014.25c architecture doc. Phase A subtasks (.29-.38) and the user-guide markdown (.25a/d) were out of scope — already verified in their own closure notes / owner-reviewed in-session.

### Severity ranking and dispositions

| ID | Severity | Source | Concern (1-line) | Disposition |
|---|---|---|---|---|
| R-H1 | HIGH | code-reviewer | `SimulationEditor.tsx:293,306,318` — three hardcoded `#6c7086` literals that should reference `colors.textMuted`. Refactor missed them. | **Fixed** in this block — three sites replaced with `colors.textMuted`. |
| R-M1 | MEDIUM | code-reviewer | `11-simulation-recorder-architecture.md` — interface block named `RawSimStep` does not exist under that name in `simulation-engine` or `authoring-ui` (they call it `SimStep`). The `RawSimStep` alias only exists in `backend/api/src/types/simulation.ts`. A developer copying the doc shape will get an import error in 2 of 3 packages. | **Fixed** — primary name renamed to `SimStep` throughout (8 sites: data-shape block, `Session` field, sequence-diagram comment ×2, boundary table ×2, HTTP table, lifecycle prose ×2). Added an explicit "Naming asymmetry" callout near the SimStep block explaining the `RawSimStep` alias is `backend/api`-local. Two intentional cross-references to the alias kept where the prose discusses the import mapper. |
| R-T1 | INFO (was HIGH) | typescript-reviewer | `simulationTheme.ts:180` — composite button styles spread `btnBase` and may widen the exported type's literal narrowing. | **Kept for traceability** — the agent's own notes acknowledge "works in practice"; `tsc --noEmit` passes; no consumer relies on literal narrowing of theme values. Re-classified from HIGH→INFO. No change. |
| R-M2 | MEDIUM | typescript-reviewer | Spread-with-`null` pattern `{ ...base, ...(condition ? buttons.disabled : null) }` used at 6 callsites obscures intent. Consistent across files but not the most readable. | **Deferred to follow-up** — the pattern is project-wide consistent (introduced as part of the .24 ADR's button-composite contract). Refactoring 6 callsites uniformly would be a follow-up cleanup, not a .24 correction. The current pattern works and is type-safe (null-spread is a valid no-op in TS). Filed as TD-014-followup-1 below. |
| R-L1 | LOW | code-reviewer | `RecorderLiveView.tsx:246-248` — verbose comment listing variables that no longer exist. | **Kept for traceability** — comment is accurate (the variables WERE removed); verbosity adds historical context for someone reading the migration. No change. |
| R3 | INFO | typescript-reviewer | Pre-existing `course.id` access on `CourseDoc` type that doesn't expose `id`. Two sites: `RecorderLiveView.tsx:95`, `SessionsPickerDialog.tsx:61`. | **Out of scope (pre-existing)** — not introduced by .24 refactor; the type drift is in `@elearn-studio/shared-types` and predates this block. Surface for a future TD ticket; do not fold into TD-014. |
| R4 | INFO | typescript-reviewer | `SimulationEditor.tsx:138` — `config` access inside `handleStepKeyDown` not narrowed by the early-return at line 48 because the closure outlives it. | **Kept for traceability** — runtime-correct (the function is unreachable when `config` is null); TS narrows to a false-positive only because of closure semantics. Idiomatic Zustand-store pattern across this codebase; not worth a localised fix. |
| R5 | INFO | typescript-reviewer | Theme module typing audit — all 9 composites use `satisfies CSSProperties`; no `as React.CSSProperties` casts; consistent imports across the 5 consumers. | **Affirmation** — recorded as a baseline pass for future regressions to compare against. No action. |
| R-I1 | INFO | code-reviewer | Button disabled-state composition (`buttons.disabled` = `{opacity:0.5, cursor:'not-allowed'}` overlays cleanly on top of any variant). | **Affirmation** — recorded as the canonical pattern. Cross-referenced from `simulationTheme.ts` JSDoc. No action. |
| R-I2 | INFO | code-reviewer | Test ID naming uniformly follows the flat `<scope>-<action>[-<id>]` convention from `decisions/2026-04-25-testid-naming-convention.md`. | **Affirmation** — confirmed across 3 test files updated by the .24 refactor. No action. |

### Verification of fixes

After R-H1 + R-M1 fixes:

- `grep "'#6c7086'\|\"#6c7086\"" packages/authoring-ui/src/components/simulation/SimulationEditor.tsx` → 0 hits.
- `grep RawSimStep docs/developer-guide/11-simulation-recorder-architecture.md` → 3 hits, all intentional (asymmetry callout + 2 alias cross-references in prose).
- `grep "color: '#6c7086'" packages/authoring-ui/src/components/simulation/` → 0 hits production-wide; only `simulationTheme.ts:44` retains the literal as the source-of-truth definition (intentional).
- Architecture doc still type-checks against the source: `SimStep` exists in both `simulation-engine` and `authoring-ui`; `Session.steps: SimStep[]` matches `recorder/types.ts:45`.

### Follow-up ticket — TD-014-followup-1 (out of block) — ✅ CLOSED 2026-07-20

**Closure (v0.5.74):** the helper option was implemented as
`withDisabled(base, isDisabled)` exported from `simulationTheme.ts`
(immutable — always returns a new object; overlays `buttons.disabled` only
when disabled). By closure time the pattern had grown from the 6 callsites
counted below to **13** across the same 5 components (recorder work reused
it); all 13 migrated, including the two multi-line object-literal forms
(`SessionsPickerDialog` Import row, `StepForm` Clear-hotspot) and the
theme's JSDoc usage example. `StepForm` no longer imports `buttons` at all.
TDD: 3 RED→GREEN tests in `simulationTheme.test.ts` (overlay, no-op,
immutability). Post-fix grep: `buttons.disabled : null` → 0 hits in
components. authoring-ui 1055/1055; tsc 0; lint 0 errors.


**MEDIUM | Pattern review: spread-with-null for conditional state styles** — across the 5 simulation components (six callsites), the disabled-state composition uses `{ ...base, ...(condition ? buttons.disabled : null) }`. This is type-safe and works correctly; however, an explicit ternary `condition ? { ...base, ...buttons.disabled } : base` or a small helper `applyDisabled(base, condition)` would make intent clearer at the callsite. Owner to decide whether the cosmetic gain warrants a follow-up PR. Filed for tracking; not blocking TD-014 closure.

### Summary

- **CRITICAL: 0**, **HIGH: 1 (fixed)**, **MEDIUM: 2 (1 fixed, 1 deferred)**, **LOW: 1 (kept)**, **INFO: 5 (3 affirmations + 2 pre-existing out-of-scope)**.
- **Block-blocking issues: 0** after R-H1 + R-M1 fixes.
- **Spec compliance:** "resolve all CRITICAL/HIGH" → done. "MEDIUM addressed if quick; otherwise documented with explicit follow-up ticket" → R-M1 fixed (quick); R-M2 deferred with TD-014-followup-1 above. "INFO/LOW kept in the file for traceability" → done.
