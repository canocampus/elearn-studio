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

1. Mark `[x]` on the completed subtask in `tasks.md`
2. Update `WORKING_CONTEXT.md` "Current State" if the observable system state changed
3. If the subtask introduces a fix — note the cause and solution in `docs/issues/issues-TXX.md`
4. Report result to owner
5. **WAIT for explicit owner confirmation before starting the next subtask**

There are NO exceptions: every subtask requires a stop
and owner confirmation before proceeding to the next one.

Do NOT automatically chain tasks even if they are in the same Phase block.
Do NOT interpret "implement Phase 1" as permission to execute all subtasks without pause.

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

---

## 5. Visual Verification for UI Tasks

Any task that touches widgets, slides, the canvas iframe, or the runtime
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