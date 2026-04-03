# Task Complete — Mandatory Closing Procedure

> Run this after completing any task block (TXX).
> Do NOT mark a task [x] in tasks.md until every applicable step below is done.
> This command exists because incomplete documentation causes context loss
> and repeated bugs in subsequent sessions.

---

## Step 1 — Update tasks.md

Mark every completed subtask as `[x]` in `tasks.md`.
If subtasks were added during implementation that were not in the original list,
add them before marking done.

```
- [x] TXX.1 — Description of what was done
- [x] TXX.2 — ...
- [x] TXX.N-1 — Refine the generated code
- [x] TXX.N — A reviewer will generate docs/issues/issues-TXX.md ...
```

---

## Step 2 — Create or update the issues file

If the reviewer task (TXX.N) was executed, ensure `docs/issues/issues-TXX.md` exists
and all CRITICAL and HIGH items are marked as resolved before closing the block.

If issues remain open (MEDIUM or LOW deferred), add them to `WORKING_CONTEXT.md`
under "Known Issues Right Now".

---

## Step 3 — Update CHANGELOG.md

Add an entry under a new version heading or `[Unreleased]` for every user-visible change.

### Version bump rules
- Bug fix only → increment patch: `0.5.10` → `0.5.11`
- New feature or widget type → increment minor: `0.5.x` → `0.6.0`
- Breaking change (API, schema, export format) → increment major: `0.x.x` → `1.0.0`

### Entry format
```markdown
## [X.Y.Z] — YYYY-MM-DD — Short Description

### Added
- **Feature name** — what it does and why it matters

### Fixed
- **[BUG-ID] Short description** (`file/path.ts`) — what was broken, root cause,
  what the fix does. Include the "why Mongoose default does not protect" type of
  explanation when relevant — future readers need the context.

### Changed
- **What changed** — old behaviour → new behaviour

### Notes
- Any non-obvious side effects, known limitations, or things to watch
```

---

## Step 4 — Update WORKING_CONTEXT.md

Update ALL applicable sections:

- **Current State table** — update Active block, version, E2E test count
- **What Was Last Done** — add 1-2 line summary of this task block
- **Known Issues Right Now** — add any deferred issues found during this block
- **What Was Attempted and Failed** — add anything that was tried and abandoned
- **Next Steps** — reorder/update based on current plan
- **Visual Verification Status** — update any components that were verified or broken

---

## Step 5 — Visual verification (mandatory for UI tasks)

If this task block touched **any of the following**, run the relevant E2E spec
and confirm it passes before marking done:

| Changed area | Run this |
|---|---|
| GrapesJS canvas, widgets, drag/drop | `pnpm playwright test grapesjs-integration` |
| Question widgets or Props panel | `pnpm playwright test question-widget` |
| Slide management (add/delete/reorder) | `pnpm playwright test authoring-ui-layer` |
| State persistence or autosave | `pnpm playwright test persistence` |
| Image upload or Asset Manager | `pnpm playwright test image-upload` |
| Actions Editor | `pnpm playwright test action-sequence` |
| SCORM export | `pnpm playwright test scorm-export` |
| Auth flows | `pnpm playwright test --project=setup auth` |
| Any UI change | `pnpm playwright test` (full suite) |

If a test fails: **fix the regression before closing the task**.
Do not mark the task done with a failing test.

---

## Step 6 — Commit with conventional format

```bash
git add -A
git commit -m "type(scope): short description

- Detail of what changed
- Why it was needed
- Any caveats

Closes: TXX"
```

### Commit type reference
| Type | When to use |
|---|---|
| `feat` | New feature or widget type |
| `fix` | Bug fix |
| `test` | Adding or updating tests only |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behavior change |
| `chore` | Build, config, dependency updates |
| `perf` | Performance improvement |

### Scope reference (use the task block number or package name)
`feat(T022)`, `fix(T800)`, `test(e2e)`, `docs(user-guide)`, `fix(converters)`

---

## Quick Checklist

```
[ ] tasks.md — all completed subtasks marked [x]
[ ] docs/issues/issues-TXX.md — CRITICAL and HIGH resolved; deferred noted
[ ] CHANGELOG.md — entry added with correct version bump
[ ] WORKING_CONTEXT.md — all 5 sections updated
[ ] E2E tests — relevant spec passing (no regressions introduced)
[ ] git commit — conventional format with task reference
```
