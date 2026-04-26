# eLearn Studio — Agent Operating Protocol

> **DOCUMENT STATUS: MANDATORY COMPLIANCE PROTOCOL.**
> This file defines the reasoning and execution framework for all coding agents
> (Claude Code, Gemini, Cursor, Copilot, and others).
> Every rule here exists because of a real observed failure in this project.
> Agent-specific files (CLAUDE.md, GEMINI.md, .cursorrules, etc.) extend this file
> with tool-specific commands and must always reference it at the top.

---

## ⚠️ STOP — READ THIS BEFORE EVERY ACTION

Before doing ANYTHING after completing a subtask:
1. Have you reported the result to the owner? → If no, STOP and report
2. Have you received explicit written confirmation? → If no, STOP and wait
3. Is the confirmation in this chat, not inferred? → If no, STOP and wait

Proceeding without explicit confirmation is a protocol violation.

---
## 🔍 Pre-Commit Self-Verification Checklist

The agent must validate changes against the patterns defined in .claude/skills/grapesjs-react-lifecycle/SKILL.md. The automatic pre-edit hook will report any deviations in resource cleanup.

**Verification commands MUST mirror CI** — `tsc -b` is incremental and skips cached-passed files; `tsc --noEmit` likewise. A green local `tsc -b` is NOT sufficient to claim "verified". The canonical pre-push command is `pnpm verify:ci` (defined in root `package.json`); use `pnpm verify:ci:debug` for diagnostic mode (`--fail-soft`, `--quick`, `--only`, `--from`, `--help`). See **§4.1 — Local vs CI environment parity** for the full asymmetry table and rationale. Skipping §4.1 produces false-greens that fail in CI's build phase (root cause of the TD-014 closure CI red on 2026-04-26).

---

## 1. Session Start Protocol

Before making any change or proposing any solution, the agent MUST execute these
steps in order:

**Step 1 — Sync operational context**
```
1. Read WORKING_CONTEXT.md — current state, known broken things, what NOT to retry
2. Read tasks.md — find the active block and its current status
3. Do NOT start coding until both files are read
```

**Step 2 — Knowledge graph (Graphify)**

Read `graphify-out/wiki/index.md` before modifying:
- Any `*PropertiesPanel.tsx` file
- `initEditor.ts`, `storageManager.ts`, `registerBlocks.ts`, `assetManager.ts`
- Any Phase T639 or T640 task

For specific queries: `/graphify query "<question>"` or `/graphify path "ModuleA" "ModuleB"`

After modifying code files in this session, keep the graph current:
```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

**Step 3 — Context window management (70% rule)**

When approaching 70% of the context window:
1. Update `WORKING_CONTEXT.md` with current state
2. Run the agent's compact/summarize command (see agent-specific file)
3. After compact: re-read **both** `WORKING_CONTEXT.md` AND `AGENTS.md` before
   continuing — the compact summary may not preserve rule precision

---

## 2. Sequential Execution — One Subtask at a Time

The agent does NOT have permission for multi-threaded or parallel decision-making.

**After completing ANY subtask (TXX.Y), STOP completely:**

1. Mark `[x]` on THIS subtask immediately in `tasks.md` — do not wait until block closure
2. Update `WORKING_CONTEXT.md` "Current State" if the observable system state changed
3. If the subtask introduces a fix — note the cause and solution in `docs/issues/issues-TXX.md`
4. Report result to owner
5. **WAIT for explicit owner confirmation before starting the next subtask**

There are NO exceptions: every subtask (T637.1, T637.2...) requires a stop
and owner confirmation before proceeding to the next one.

Do NOT automatically chain tasks even if they are in the same Phase block.
Do NOT interpret "implement Phase 2.9" as permission to execute all subtasks without pause.

Do NOT wait until the end of the block to mark subtasks — the owner must be able
to see actual progress in `tasks.md` at any time.

**Mutually exclusive subtasks** (marked with "Or:" in the task definition):
- Only ONE alternative is implemented
- The chosen one → `[x]`
- The skipped ones → `[-]` (not applicable — alternative not taken)
- Document the choice and reasoning in `docs/issues/issues-TXX.md`

**If a subtask has an implicit technical dependency on the next one:**
- Do NOT execute both automatically
- STOP after the authorized subtask
- Explain the dependency to the owner: "T642.1 requires T642.2 to be effective because..."
- Wait for explicit confirmation before proceeding

---

## 2.1. Refinement and Review subtasks (TXX.N — "Refine" or "Reviewer")

These subtasks require owner approval before executing any tool or making any change:

**For "Refine the generated code" subtasks:**
1. Read the files changed in this block manually
2. List what you consider candidates for refinement and why
3. STOP — wait for owner confirmation on what to apply
4. Only then make the approved changes

**For "A reviewer will generate issues-TXX.md" subtasks:**
1. State which files and commits you intend to review
2. STOP — wait for owner confirmation to proceed
3. Run the code-reviewer tool only after explicit approval
---

## 2.2. Solution Proposal Protocol

Agent and owner are a team covering each other's blind spots: the owner 
brings project trajectory, prior decisions, and business context; the 
agent brings structural alternatives, missing investigation depth, and 
options the owner may not have framed. The protocols in this section 
channel the agent's contribution in the right direction; they do NOT 
suppress it. A response that follows the rules to the letter but adds 
no substance — empty observations, procedural ceremony, frame-respect 
as cover for laziness, three weak alternatives where two genuine ones 
exist — violates the purpose even when it passes the literal filter. 
The owner retains final authority over important decisions; the agent 
never pre-empts that authority but is expected to contribute 
substantively, not merely procedurally.

When proposing a fix or solution to a problem (lint error, failing test, design 
question, refactor opportunity, bug report), the agent must order alternatives 
by **structural correctness first, diff size second**.

**Required ordering of presented options:**

1. **Root-cause solution** — addresses the underlying contract, design, or 
   architectural issue, even if it requires more code, more tests, or touches 
   more files.
2. **Hybrid / scoped versions** — when the root-cause solution is too large for 
   the current sprint, a hybrid that captures part of the structural fix while 
   deferring the rest, with the deferred work documented as an explicit 
   follow-up task.
3. **Pragmatic mitigations** — smaller-diff alternatives that paper over the 
   symptom without addressing the cause. These may be presented as additional 
   options. They are NEVER the default recommendation. They MAY become the 
   recommended option only if and when the owner has explicitly stated a 
   constraint (time, scope, risk tolerance) that overrides structural 
   correctness; the constraint must be cited verbatim as the justification in 
   the recommendation.

**Rules:**

- The agent does NOT default to "smallest diff" as the recommended option. 
  Smallest diff wins only when it IS the structurally correct solution.
- **Sufficiency over maximality:** structural correctness is the minimum 
  sufficient set of changes addressing the root cause; it is not the maximal 
  refactor that the cause might motivate. Related cleanup that does not block 
  the fix should be surfaced as a follow-up task, not bundled.
- When unsure which option is "more correct", surface the ambiguity to the 
  owner — do not silently pick minimal scope.
- When generating alternatives, produce at least three structurally distinct 
  options spanning different points on the design space (not three variants of 
  the same approach with different naming). If only two genuinely distinct 
  options exist, say so explicitly and explain why a third was considered and 
  rejected.
- Disabling rules, silencing errors, suppressing warnings, or modifying tests 
  to match broken behaviour are NEVER root-cause solutions. They belong in 
  category (3) and require the explicit justification described in Rule 8 
  (Lint Suppression Policy).

**Anti-patterns to avoid:**

- Proposing a single option without considering alternatives.
- Presenting alternatives ordered by diff size (smallest first).
- Recommending the smallest-diff option without explicit reasoning that it is 
  also the structurally correct one.
- Treating "minimal change to make the symptom go away" as equivalent to 
  "solving the problem".

### 2.2.1. Operating Modes — Executor vs Advisor

The agent operates in two distinct modes depending on the request. Misidentifying 
the mode produces the most common protocol violations: executing when the owner 
expected analysis, or analysing when the owner expected execution.

**Executor mode** — triggered by requests like "implement TXX.N", "apply the 
fix described in the ADR", "run the tests", "make the change we agreed on".
- The decision is already made; the agent's job is faithful execution.
- Surface deviations from the spec as questions, not as alternatives to 
  reconsider.
- Minimal-diff bias is appropriate here — the goal is to do exactly what 
  was decided, no more.
- **Sub-decisions during execution** (method vs function, hook vs utility, 
  naming, file placement, etc.): apply existing repo conventions silently. 
  Escalate only when (a) two conventions contradict, (b) no convention 
  exists for the case, or (c) the existing convention conflicts with 
  structural correctness for the concrete case (per §2.2). The third 
  escape hatch prevents silent application of convention from undermining 
  §2.2's structural-correctness-first rule.

**Advisor mode** — triggered by requests like "how should we approach X", 
"what are the alternatives", "write an ADR for Y", "audit Z", "should we 
do A or B".
- The decision is open; the agent's job is to map the design space for the 
  owner.
- **When the owner asks "A or B" and a third option C may exist,** answer 
  the binary question first within its own frame, then surface C separately 
  as a follow-up: "Within your A vs B question: [answer]. As a separate 
  observation, option C also exists — happy to develop if relevant". The 
  purpose is bidirectional blind-spot coverage: the agent surfaces options 
  the owner may not have seen, just as the owner brings context (project 
  trajectory, future complications) the agent may not have. Silence on C 
  under cover of "frame respect" defaults to the same min-diff bias §2.2 
  exists to prevent.
- The agent does NOT recommend by default unless explicitly asked. Recommending 
  pre-empts the owner's authority over the decision.
- Any phrasing that conveys preference for one option over others — explicit 
  ("recomiendo X") or implicit ("mi sugerencia", "yo empezaría", "lo lógico 
  sería", "tiene más sentido") — counts as a recommendation and is subject 
  to the same rules.
- When asked to recommend, the agent does so AFTER laying out the full space 
  and marks the recommendation as "agent's reading" not "the answer". The 
  falsifiability clause — explicitly stating what would change the 
  recommendation — is mandatory when the recommendation is decision-in-play 
  (the owner is about to act on it), and optional when the recommendation 
  is exploratory (the owner is gathering context rather than steering action).
- Minimal-diff bias is INAPPROPRIATE here — the goal is faithful exposition 
  of trade-offs, not converging on a single answer.

**Mode persistence across turns:** the agent does NOT carry mode from a 
previous turn into the current one. Each turn re-evaluates which mode 
applies based on the content of that turn. If a session begins in Advisor 
and the next message asks for execution, the agent switches to Executor 
for that turn — the prior Advisor framing does not bind subsequent turns.

**Mode ambiguity and in-flight Advisor concerns:** when the request mode is 
ambiguous, the agent asks the owner which mode applies before proceeding — 
defaulting silently to Executor mode in an Advisor situation is a protocol 
violation. Likewise, when an Advisor concern emerges during Executor work 
(something the investigation gate of §2.2.2 did not catch, or surfaces only 
at execution time), the agent halts the Executor action, surfaces the concern, 
and waits for owner direction before resuming. Both cases share the same 
principle: the agent does not silently override the owner's decision-space — 
at the start of the request (mode ambiguity) or in flight (Advisor concern). 
Deferring in-flight concerns to a post-action note is the in-flight equivalent 
of silently picking minimal scope.

**The owner's role in Advisor mode is collaborative discovery, not approval 
of a pre-decided answer.** The agent's success metric is "did the owner have 
the information they needed to decide well", not "did my recommendation get 
accepted".

### 2.2.2. Investigation Gate Before Executor Action

Before any Executor action — including in pure Executor requests — the agent 
must demonstrate investigation proportional to the scope of the change: 
reading affected dependencies, re-reading existing tests that touch the area, 
reproducing the problem if applicable. The agent does NOT self-declare 
"ready to execute" until this gate has been passed.

If investigation reveals any concern — about the approach, about assumptions 
in the spec, about side effects — those concerns block and surface as 
Advisor questions before any action is taken.

**Why this exists:** the most common protocol violation observed in this 
project is acting with insufficient investigation. Tests fail or owner 
iteration reveals the change required deeper analysis. The investigation 
gate makes "I have looked enough to act safely" an explicit, demonstrable 
claim, not a default assumption.

---

## 3. Investigation Before Fixing

**"Fixing by guessing" is prohibited.**

When a subtask is of the "investigate" or "diagnose" type:

- Run the application and reproduce the problematic behavior
- Collect actual evidence (logs, console, network, screenshots) before concluding
- **Do NOT assume that a probable cause identified in the code is the only cause**
- If you detect a probable cause during investigation, document it, but CONTINUE
  the investigation to confirm or rule out additional causes
- Only mark the subtask complete when you have **observed** evidence, not just
  evidence inferred from reading the code
- Even if you identify the cause while reading the code, DO NOT proceed to the fix
  until the investigation is complete
- Report findings and wait for owner confirmation before implementing anything

---

## 4. Test Integrity — Zero Regression Policy

**Every time a file is edited**, before moving to the next subtask:

```bash
# Run tests for the affected package
pnpm --filter <package> test -- --reporter=verbose

# If the change touches multiple packages
pnpm test
```

**Search for ALL related test files before running:**
```bash
grep -r "ComponentName\|functionName\|'module-name'" \
  --include="*.test.*" --include="*.spec.*" -l
```

**If any test fails:**
- If caused by the current change → fix it before continuing
- If pre-existing → investigate, then either fix or document in `WORKING_CONTEXT.md`
  "Known Issues" AND in `docs/issues/issues-TXX.md`
- **Never mark a task `[x]` while tests are red, regardless of cause**

**Test warnings must NOT be ignored:**
- Each warning must be either fixed or explicitly documented as a known issue
- A warning silently ignored will become a bug in a future session

**If a test is flaky (passes in isolation, fails in full suite):**
- Do NOT ignore it or label it as "pre-existing"
- Document it in `WORKING_CONTEXT.md` "Known Issues":
  - Test name
  - Failure condition (full suite only, timeout, state accumulation, etc.)
  - Observed behavior vs. behavior in isolation
- Add an entry in `docs/issues/issues-TXX.md` for the active block
- If the flaky issue existed before the current block: verify it was already
  documented before closing the block. If it wasn't → document it now.

**When editing a component — update its tests:**
- Update tests to reflect new correct behaviour
- Never comment out or delete a test unless the functionality it covers has been
  explicitly removed
- Never mark a task done until all related tests pass

### 4.1 Local vs CI environment parity (read before claiming "verified")

**Why this section exists.** TD-014 closure (commit `c151f27`, 2026-04-26) shipped to CI with `npx tsc -b` exit 0 locally and was rejected by CI in the **build** phase with 3 TypeScript errors (`course.id` vs `course._id` ×2, plus a `config` null narrowing miss). The local "green" reading was a false negative — the local commands did not mirror the CI commands. To prevent recurrence, the agent MUST understand the asymmetries below before reporting verification as complete.

**Canonical CI pipeline** (`.github/workflows/ci.yml`, ordered):

```
1. pnpm install --frozen-lockfile          ← strict; lockfile drift → fail
2. pnpm lint                               ← root script, all packages
3. pnpm --filter @elearn-studio/shared-types run build
4. pnpm --filter '!@elearn-studio/e2e' -r run test
5. pnpm --filter @elearn-studio/api run gen:openapi   (if-present)
6. pnpm --filter @elearn-studio/authoring-ui run gen:api-client
7. pnpm -r run build                       ← per-package: tsc -b && vite build
8. pnpm --filter @elearn-studio/e2e run test  (against built artefacts)
```

**The 8 environment asymmetries that produce false-greens locally:**

| # | Asymmetry | Local symptom | CI behaviour | How to mirror locally |
|---|---|---|---|---|
| 1 | **`tsc -b` is incremental** — uses `.tsbuildinfo` cache; skips files marked up-to-date | Recently-edited file passes; previously-passed files with new dependency-graph type errors are SKIPPED | Fresh checkout → no `.tsbuildinfo` → every file is re-typechecked from scratch | `pnpm --filter <pkg> exec tsc -b --force` OR delete `**/.tsbuildinfo` before running |
| 2 | **`pnpm -r run build` is the full gate, not `tsc -b`** — root `pnpm build` runs `tsc -b && vite build` per package; vite invokes a SECOND tsc/esbuild pass | A typecheck-only `tsc -b` exit 0 misses errors caught by the build pipeline (project-references vs. emit-mode discrepancies) | Build runs both; emit-mode catches stricter narrowing failures (e.g. nullable-config in callbacks declared after the early-return guard) | `pnpm -r run build` — same command CI runs. Treat any other typecheck as preliminary. |
| 3 | **`gen:api-client` runs PRE-build on CI** — regenerates `generated.ts` from the live OpenAPI spec | Local working tree may have a stale `generated.ts` from a previous regen; types may not match what the backend currently emits | CI always uses freshly-regenerated types — drift surfaces immediately as type errors in consumers | `pnpm --filter @elearn-studio/authoring-ui run gen:api-client` before building |
| 4 | **Linux file-system case-sensitivity** | `import './Foo'` matching `./foo.ts` works on Windows/macOS (case-insensitive FS) | Linux runners are case-sensitive — case-mismatch import → MODULE_NOT_FOUND | When in doubt, verify exact case of every new file name vs every import. WSL or Linux container is the only true mirror. |
| 5 | **`pnpm install --frozen-lockfile`** — strict | Local edits to `pnpm-lock.yaml` (or implicit drift from `pnpm install`) silently work | CI rejects any divergence between the lockfile and the package.json files | `pnpm install --frozen-lockfile` locally before commit; do not rely on `pnpm install` |
| 6 | **shared-types built BEFORE tests** — explicit step | Locally we may have stale `packages/shared-types/dist` from old code; consumers see old types | CI builds shared-types first → tests + downstream packages see the latest types | `pnpm --filter @elearn-studio/shared-types run build` before running unit tests if you've touched shared-types |
| 7 | **CI test scope EXCLUDES e2e**, then runs e2e separately | `pnpm test` at root may include e2e and either fail (no infra) or be skipped | CI explicitly: `pnpm --filter '!@elearn-studio/e2e' -r run test`, then later: `pnpm --filter e2e run test` against built+running services | Mirror the split exactly when verifying, OR run `pnpm -r run test --filter '!e2e'` and `pnpm --filter e2e run test` separately |
| 8 | **Vite build-time env vars** — CI runs `pnpm -r run build` with `VITE_API_URL=http://localhost:3001` + `VITE_E2E_MODE=true` injected into env; vite bakes these into the static bundle | Local build without those env vars produces a bundle with different runtime behaviour than CI's — the bundle compiles but ships baked-in defaults that diverge from CI | CI sets the env vars at build-step level; bundle ships with CI-baked values | Already wrapped in `pnpm verify:build` (`cross-env VITE_API_URL=... VITE_E2E_MODE=true pnpm -r run build`) — invoked automatically by `pnpm verify:ci` |

**Mandatory local pre-push command:**

```bash
pnpm verify:ci                  # canonical: chains all verification steps
pnpm verify:ci:debug            # diagnostic wrapper: --fail-soft, --quick, --only, --from
pnpm verify:ci:debug --help     # full flag reference
```

The pipeline is defined in root `package.json` (scripts `verify:install` ... `verify:build`); **that file is the single source of truth** for what `verify:ci` runs. The wrapper `scripts/verify-ci-debug.mjs` invokes those scripts; it does NOT redefine the pipeline. To inspect or modify the canonical sequence, edit `package.json` — this section does not duplicate the command list, so it cannot drift from `package.json` over time.

A `tsc -b` (or `tsc --noEmit`) exit 0 alone is **not** sufficient evidence to claim "tsc clean across all packages". Use `pnpm verify:ci` exit 0 as the floor. The pre-push checklist line in §0 (`Pre-Commit Self-Verification`) is the binding gate.

**Windows-specific noise that is NOT a real failure:**
- `[vite:esbuild-transpile] remove ... Access is denied` during `vite build` — Windows locks esbuild's temp files synchronously while esbuild tries to clean them up as part of its normal transform cycle. The error fires within milliseconds of file creation (not from a slow async AV scan finishing late). CI on Linux is unaffected.

  **What does NOT resolve it** (verified 2026-04-26 — save future debugging time):
  - Pausing Windows Defender via the UI.
  - Manually deleting lingering `esbuild-*` temp files (~3.5 MB each) before retry. They ARE deletable post-failure, confirming the lock is held only during the build itself, not afterward.
  - Redirecting `TMPDIR` / `TEMP` / `TMP` env vars to a non-system path. The lock follows the file regardless of location.

  Likely cause is an EDR / IOFilter driver / Defender Tamper Protection layer that real-time-scans regardless of the user-facing AV state.

  **What DOES validate the substance locally without `vite build`:**
  - `pnpm verify:install`, `verify:lint`, `verify:types`, `verify:test`, `verify:gen` — all run normally.
  - `pnpm --filter <pkg> exec tsc -b --force` per app package — validates typecheck independent of vite emit; catches the same TS errors `pnpm verify:build` would catch.

  When all of the above pass and only `verify:build` fails with this exact error pattern, the substance has been validated; trust CI Linux for the bundling phase. Do NOT treat `dist/` presence as evidence of success — when this error fires, vite stops mid-output and `dist/` may be incomplete or stale.

  **Future investigation paths (NOT yet attempted):**
  - `handle.exe` (Sysinternals) to identify the process holding the handle.
  - `Set-MpPreference -DisableRealtimeMonitoring $true` from an admin PowerShell (requires Tamper Protection off first).
  - Replace esbuild in vite config — refactor too large to be a casual mitigation.

- CRLF vs LF line endings — gitattributes normalise on commit; not a CI failure source by themselves.

**When CI surfaces an error that local did not:**
1. Do NOT immediately patch and push — first **reproduce locally** by mirroring the exact CI command for that step (use `pnpm verify:ci:debug --only=<step>` to run a single step in isolation).
2. Confirm the patch fixes the local repro.
3. Update this section if the asymmetry is novel — future agents must inherit the lesson.

**High-risk files and their related tests — always check these pairs:**

| File changed | Tests to run |
|---|---|
| `converters.ts` | `converters.test.ts` |
| `registerBlocks.ts` | `registerBlocks.test.ts` + `grapesjs-integration.spec.ts` |
| `registerQuestionBlocks.ts` | `registerQuestionBlocks.test.ts` + `question-widget.spec.ts` |
| `QuestionPropertiesPanel.tsx` | `question-widget.spec.ts` + `authoring-ui-layer.spec.ts` |
| `storageManager.ts` | `storageManager.test.ts` + `persistence.spec.ts` |
| `initEditor.ts` | `initEditor.test.ts` + `grapesjs-integration.spec.ts` |
| `assetManager.ts` | `image-upload.spec.ts` |
| `runtime-player/src/index.ts` | ALL tests in `runtime-player/src/__tests__/` |
| `runtime-player/src/suspend.ts` | `suspend.test.ts` |
| `backend/api/src/routes/courses.ts` | `courses.test.ts` |
| `backend/api/src/routes/assets.ts` | `assets.test.ts` |
| `backend/api/src/routes/auth.ts` | `auth.test.ts` |
| `scorm-packager/src/index.ts` | ALL tests in `scorm-packager/src/__tests__/` |

---

## 5. Visual Verification for UI Tasks

Any task that touches GrapesJS, widgets, slides, the canvas iframe, or the runtime
player requires E2E Playwright verification before it can be marked done:

```bash
pnpm --filter e2e playwright test <spec-name>
pnpm --filter e2e playwright test   # full suite
```

If the spec fails → fix the regression, do not mark done.
If the task adds new UI behaviour → add a new E2E test.
---
### 6. Block Closure
Every task block MUST be closed using the canonical /task-complete command.
The agent is prohibited from manual closure; follow the interactive script in .claude/commands/task-complete.md to ensure zero-regression, documentation updates, and proper Git flow.
---

## 7. Never Repeat Failed Approaches

Before starting any implementation, check `WORKING_CONTEXT.md` section
"What Was Attempted and Failed". Do not retry any listed approach
without an explicit instruction to do so.

---

## 8. Architectural Decision Records (ADR)

When choosing between alternatives that affect more than today's task — a library,
an architecture pattern, an API design, or deciding NOT to do something — log it:

**File:** `/decisions/YYYY-MM-DD-{topic}.md`

**Format:**
```
## Decision: {what you decided}
## Context: {why this came up}
## Alternatives considered: {what else was on the table}
## Reasoning: {why this option won}
## Trade-offs accepted: {what you gave up}
```

Before making a similar decision, grep `/decisions/` for prior choices.
Follow them unless new information invalidates the reasoning.

---

## 9. Hierarchy and Governance

### 9.1 Ownership of this Protocol

- The Agent is STRICTLY PROHIBITED from modifying AGENTS.md.
- Any proposed changes to the core reasoning or execution framework must be suggested to the Owner in the chat.
- Only the Project Owner may commit changes to this file.

### 9.2 Conflict Resolution

- In case of conflict between this AGENTS.md and a tool-specific file (e.g., CLAUDE.md, .cursorrules, GEMINI.md):
- Workflow and Safety Rules in AGENTS.md (Steps 2, 3, 4, 6) ALWAYS take precedence over any other instruction.
- Technical commands (specific build, test, or linting syntax) in tool-specific files take precedence for execution.
- If an instruction is missing in a tool-specific file, the agent must default to the strictest interpretation found 
  in this AGENTS.md.

---

## 10. GrapesJS Canvas — iframe Event System

The GrapesJS canvas resides within an `<iframe>`. This has two critical consequences
that caused five bug phases in T630. Read all of this before touching any event
logic or coordinates related to the canvas.

### 10a — Iframe events do NOT propagate to the main document

```typescript
// INCORRECT — never do this:
document.addEventListener('mousemove', handler)  // does not receive iframe events
window.addEventListener('dragover', handler)     // does not receive iframe events

// CORRECT — always do this:
const iframeDoc = editor.Canvas.getFrameEl()?.contentDocument
iframeDoc?.addEventListener('dragover', handler) // receives iframe events
```

Affects: `mousemove`, `dragover`, `drop`, `click`, `dblclick`, `keydown`, `keyup`,
`mousedown`, `mouseup`, `pointermove` — any event on the canvas.

**Drag-and-drop note:** HTML5 D&D suppresses `mousemove`. It only fires `dragover`
on the element under the cursor. To track position during a drag, listen for
`dragover` on `iframeDoc` — not `mousemove`.

### 10b — clientX/Y of iframeDoc events are already in canvas coordinates

Events captured via `iframeDoc.addEventListener()` carry `clientX/Y` in the iframe's
coordinate system (relative to its top-left = relative to the canvas). These are
NOT the viewport coordinates of the main window.

**Coordinate table — required before any position calculation:**

| Origin of the event       | clientX/Y space          | How to get canvas coordinates         |
|---------------------------|--------------------------|---------------------------------------|
| document (main window)    | Viewport main window     | clientX - iframeRect.left, /zoom      |
| iframeDoc                 | Canvas (iframe-relative) | Only /zoom. DO NOT subtract iframeRect|
| → getMouseRelativePos()   | Requires main window event | NEVER pass iframe events             |
| → getMouseRelativeCanvas()| Requires main window event | NEVER pass iframe events             |

**Correct formula for iframeDoc events (any zoom):**
```typescript
const zoom = (editor.Canvas as any).getZoomDecimal?.() ?? 1
const canvasX = event.clientX / zoom  // DO NOT subtract iframeRect.left
const canvasY = event.clientY / zoom  // DO NOT subtract iframeRect.top
```

**Why getMouseRelativePos/Canvas are WRONG with iframe events:**
Both functions internally add `frameOffset.left/top`. If the event already comes
from the iframe (`clientX` is already canvas-relative), adding frameOffset counts
it TWICE → offset = +iframeRect.left (93px in this project).

**T630 Bug Log — Do Not Repeat:**
- Phase 1: Listeners in main document → (0,0) in slides 2+
- Phase 2: getMouseRelativePos with iframe events → Y offset = +iframeRect.top
- Phase 3: getMouseRelativeCanvas with iframe events → X offset = +93.1875px
- Phase 4: Subtract iframeRect.left from clientX of iframe → X offset = -93.1875px
- Phase 5 ✅: clientX/zoom, no offset operations — CORRECT

---

## 11. Critical Architectural Rules — DO NOT Violate

1. **GrapesJS Storage Manager** — NEVER let GrapesJS save raw HTML. Always use the
   custom `elearn-api` Storage Manager that maps to our Course/Slide/Widget JSON schema.

2. **Phaser lazy loading** — NEVER bundle Phaser into the main runtime player JS.
   Always dynamic `import()`. The main player must stay under 150KB gzipped.

3. **Runtime player = Vanilla JS** — No React, no Vue, no Angular in `runtime-player/`.
   It runs inside LMS iframes; framework bundles cause conflicts and slow loading.

4. **SCORM 1.2 first** — Every packager change must be tested against Moodle before merge.
   SCORM 2004 and xAPI are secondary targets.

5. **No localStorage in player** — SCORM suspend_data via `LMSSetValue` only.

6. **No binary data in MongoDB** — All assets (images, audio, screenshots, Phaser sprites)
   go to Garage. MongoDB stores only the JSON course structure and asset URLs.

7. **GrapesJS open-source only** — Use the `grapesjs` npm package (MIT license).
   Do NOT use GrapesJS Studio SDK (enterprise/paid product).

8. **Lint suppression policy** - Before suppressing a lint rule (eslint-disable-*, @ts-ignore, 
   @ts-expect-error, biome-ignore, etc.) on a specific line, file, or globally: first attempt a refactor that 
   satisfies the rule using existing codebase conventions. Suppression is allowed only when (a) the rule is a
   documented false positive against a framework idiom, AND (b) no rename/refactor that respects the rule exists.
   When suppressing, the line above must contain the justification: which rule, why the rule is wrong here, 
   what convention was tried first.

9. **Phaser MIT license** — Phaser 3 is MIT. Do not use Phaser Nano or any paid variants.

### 11.1 GrapesJS + React Hook Rules

#### extendedProperties patch-merge rule (T639)

**RULE:** When updating a partial patch of `extendedProperties` in a property panel,
**NEVER** spread over a closure variable (`ep`). Always read the latest committed value
via `getLatest()` (returned by `useComponentProperty`) or `comp.get('extendedProperties')`.

```typescript
// WRONG — ep may be stale if two updates fire in the same render cycle
function update(patch: Partial<T>) {
  setEp({ ...ep, ...patch })  // ❌ ep from closure is the value at last render
}

// CORRECT — getLatest() reads latestRef.current, always the most-recent committed value
function update(patch: Partial<T>) {
  const current = getLatest()  // ✅ always fresh
  setEp({ ...current, ...patch })
}
```

Use `useExtendedProperties` (in `QuestionPropertiesPanel.tsx`) as the canonical pattern
for new property panels — it wraps `useComponentProperty` and handles this correctly.

---

## 12. Project Overview

**eLearn Studio** is an open-source, web-based e-learning authoring platform inspired by
ToolBook 11.5 (SumTotal Systems, 2012). The goal is to replicate and modernize ToolBook's
core capabilities: software simulations, rich question/quiz engine, visual action
programming, advanced simulation via game engine, and SCORM/AICC/xAPI packaging for LMS.

---

## 13. Architecture

```
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS — visual slide editor
│   ├── simulation-engine/     # Playwright recorder + Screenshot Sim player
│   ├── question-engine/       # Pure TypeScript — scoring/evaluation library
│   ├── actions-editor/        # React component — event→action visual builder
│   ├── scorm-packager/        # SCORM 1.2 / SCORM 2004 / AICC / xAPI output
│   ├── runtime-player/        # Vanilla JS + HTML5 — embeds in LMS iframes
│   └── phaser-simulations/    # Phaser.js 3 — advanced simulation widget library
├── backend/
│   ├── api/                   # Node.js 20 + Express 5 + TypeScript
│   ├── models/                # Mongoose schemas
│   └── storage/               # Garage S3-compatible asset storage
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── docs/
│   ├── features.md
│   ├── plans.md
│   └── tasks.md
├── AGENTS.md                  # This file — universal agent protocol
├── CLAUDE.md                  # Claude Code specifics
└── decisions/                 # Architectural Decision Records
```

---

## 14. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Slide Editor** | GrapesJS + `@grapesjs/react` | Drag & drop authoring, layer manager, properties panel |
| **Simulation Hotspot Editor** | Konva.js | Pixel-precise hotspot drawing over screenshots |
| **Advanced Simulations** | Phaser.js 3 | Process flows, physics sims, gamification |
| Rich Text | TipTap v2 | Text editing within widgets |
| State Management | Zustand | Authoring UI global state |
| Backend API | Node.js 20 + Express 5 + TypeScript | REST API |
| Database | MongoDB 7 + Mongoose | Course document storage |
| Asset Storage | Garage (S3-compatible, AGPL) | All media and screenshot assets |
| Sim Recording | Playwright + CDP | Software sim capture |
| SCORM | scorm-again + pipwerks wrapper | LMS compliance |
| LMS | Moodle 4.x (Docker) | SCORM/AICC validation target |
| Monorepo | pnpm workspaces | Package management |

---

## 15. Data Model

```typescript
interface Course {
  _id: ObjectId
  title: string
  slides: Slide[]
  templates: SlideTemplate[]
  resources: Resource[]
  settings: CourseSettings
  metadata: SCORMMetadata
  createdAt: Date
  updatedAt: Date
}

interface Slide {
  id: string
  title: string
  templateId?: string
  widgets: Widget[]
  actions: ActionSequence[]
  screenshotSim?: ScreenshotSimulation  // Playwright-based
  transition?: TransitionEffect
}

// Widget type discriminated union
type Widget =
  | TextWidget | ImageWidget | ButtonWidget | ShapeWidget
  | QuestionWidget | MediaWidget | NavigationWidget
  | ScoreWidget | ScreenshotSimWidget | PhaserSimWidget

interface PhaserSimWidget extends BaseWidget {
  type: 'phaser-sim'
  extendedProperties: {
    simType: 'process-flow' | 'physics-demo' | 'gamified-quiz' | 'concept-animator' | 'interactive-diagram'
    sceneDef: PhaserSceneDefinition
    mode: 'demo' | 'practice' | 'assessment'
    passingScore: number
  }
}
```
---

## 16. Key Commands

```bash
# Install all dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Start backend infrastructure only
docker compose -f docker/docker-compose.dev.yml up -d

# Run all tests
pnpm test

# Run E2E tests (Playwright)
pnpm --filter e2e playwright test <spec-file>
pnpm --filter e2e playwright test <spec-file> --grep "T611.10"

# Build Phaser sim bundle
pnpm --filter phaser-simulations run build

# Build SCORM package from CLI
pnpm --filter scorm-packager run build -- --courseId <id> --format scorm12

# Lint all packages
pnpm lint
```

---
## 17. Licensing Notes

### Garage (AGPL-3.0)
Garage is licensed under AGPL-3.0. Key implications:
- **Self-hosted (Docker Compose) — no obligation:** The AGPL "network use = distribution"
  clause does NOT apply to eLearn Studio's own code when Garage runs as a separate service.
- **If you embed or statically link Garage** — you would need to open-source the combined
  work under AGPL. We do not do this.
- **Distributing the Docker image** — if you publish a Docker image that includes Garage,
  you must make Garage's source available.
- **eLearn Studio's own license is independent** — Garage being AGPL does not force
  eLearn Studio to be AGPL.

**Summary:** Using Garage as a Docker service carries no licensing obligations for
eLearn Studio code. Same model as running PostgreSQL or Redis alongside your app.

### GrapesJS (MIT) and Phaser (MIT)
No restrictions. Use freely.
