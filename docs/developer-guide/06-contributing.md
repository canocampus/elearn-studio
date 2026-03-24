# Contributing

Covers branch naming, commit format, PR checklist, and code generation.

---

## Branch naming

```
<type>/T<task-number>-<short-description>
```

Examples:
```
feature/T045-timeline-simulation
fix/T102-scorm-suspend-data-overflow
docs/T503-developer-guide
test/T201-question-engine-coverage
```

Types: `feature`, `fix`, `refactor`, `docs`, `test`, `chore`.

Always branch from `master`. Keep branches short-lived — open a PR within a day or two of starting work.

---

## Commit message format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

<optional body>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Scope:** package name or area — `authoring-ui`, `runtime-player`, `backend-api`, `scorm-packager`, `phaser-sims`, `e2e`, `docker`

Examples:
```
feat(authoring-ui): add flip-card widget type (T045)
fix(runtime-player): correct suspend_data serialisation for multi-slide courses
docs(developer-guide): add contributing guide
test(question-engine): add fill-in-blank partial match coverage
chore(deps): bump Phaser to 3.80.1
```

Keep the description under 72 characters. Use the body for context when the change is not self-evident from the files.

---

## Opening a Pull Request

### PR title

Match the commit message format: `feat(scope): description (TXX)`.

### PR body — required sections

```markdown
## Summary
- What changed and why (bullet points, not sentences)

## Task
Closes T<number> — <task title from tasks.md>

## Test plan
- [ ] Unit tests pass: `pnpm --filter <package> test`
- [ ] Lint clean: `pnpm lint`
- [ ] E2E tests pass (if UI changed): `pnpm --filter authoring-ui run test:e2e`
- [ ] Tested manually against dev stack
- [ ] Screenshots updated (if UI changed, see below)
- [ ] `openapi.json` regenerated (if API changed, see below)
```

### PR checklist

Before marking a PR ready for review:

- [ ] All unit tests pass (`pnpm test`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] No new `any` types introduced without justification
- [ ] No secrets or credentials committed
- [ ] `openapi.json` regenerated if API routes changed
- [ ] `generated.ts` regenerated if `openapi.json` changed
- [ ] Playwright screenshots updated if UI changed
- [ ] `tasks.md` updated — task marked `[x]` complete
- [ ] `docs/issues/issues-T<N>.md` created if the task requires a reviewer pass

---

## Regenerating OpenAPI spec and TypeScript client

The OpenAPI spec is generated from JSDoc annotations in `backend/api/src/routes/`.

```bash
# Regenerate openapi.json (from backend/api JSDoc annotations)
pnpm --filter @elearn-studio/api run gen:openapi
# Output: backend/api/openapi.json

# Regenerate TypeScript API client for authoring-ui
# (also runs gen:openapi internally to ensure the spec is current)
pnpm --filter @elearn-studio/authoring-ui run gen:api-client
# Output: packages/authoring-ui/src/api/generated.ts
```

Both `openapi.json` and `generated.ts` are **committed** to the repository so they are available without a build step. Regenerate them whenever you add, remove, or change an endpoint.

> Never edit `generated.ts` by hand — it is overwritten on the next generation run.

---

## Updating Playwright screenshots

If a UI change affects the authoring interface, regenerate the documentation screenshots:

```bash
# Requires: full dev stack running (docker compose -f docker/docker-compose.dev.yml up -d)
pnpm --filter @elearn-studio/docs run capture
# Output: docs/assets/screenshots/*.png
```

Screenshots are committed. Include them in the PR when they change.

---

## Issue templates

When filing a bug or feature request, use the issue template in `.github/ISSUE_TEMPLATE/`:

- `bug_report.md` — reproduction steps, expected vs actual behaviour, environment
- `feature_request.md` — problem statement, proposed solution, acceptance criteria

Reference a `tasks.md` task ID if the issue corresponds to a planned task (`T<number>`).

---

## Reviewer workflow

Every PR requires at least one review before merge. Reviewers check:

1. Correctness — does the code do what the task requires?
2. Tests — are unit tests meaningful and complete?
3. Breaking changes — does this affect the SCORM/runtime API or MongoDB schema?
4. Documentation — is `tasks.md` updated? Are relevant docs updated?

For significant features, the reviewer runs a local build and manual test against the dev stack before approving.
