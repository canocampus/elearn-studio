# eLearn Studio — Working Context

> **This file is the first thing to read at the start of every Claude Code session.**
> It is updated by Claude Code after every completed task block.
> It is the single source of truth for current project state.
>
> Last updated: 2026-03-31
> Updated by: Claude Code after v0.5.10

---

## Current State

| Field | Value |
|---|---|
| **Latest release** | v0.0.1-beta (2026-03-29) |
| **Current version** | v0.5.10 |
| **Active phase** | Phase 2 — Interactivity + Screenshot Simulations |
| **Active block** | — (between tasks, review period) |
| **E2E test count** | 90 tests (73 chromium + 4 setup + 13 new) |

---

## What Was Last Done

- **v0.5.10** — Defensive guards for missing `w.bounds` fields in `grapesjsFromWidgets` (converters.ts)
- **v0.5.9** — E2E suite expanded from 73 → 90 tests; Moodle SCORM integration tests added
- **v0.5.8** — Four persistence race condition fixes (BUG-T800-01 through BUG-T800-04)
- **v0.5.7** — Full widget attribute persistence and autosave reliability

Full history: see `CHANGELOG.md`

---

## Known Issues Right Now

> Issues marked 🔴 are blocking. 🟡 are deferred. ✅ are resolved but kept for reference.

| ID | Severity | Description | File / Location |
|---|---|---|---|
| — | — | *No blocking issues at this version* | — |

### Deferred (non-blocking, known)
- **Firefox arrow rendering** — match-items drag arrows misaligned in Firefox (not blocking for Chromium-first)
- **Safari presigned URL timing** — occasional race on first image load in Safari (issue #47)
- **TipTap inside GrapesJS iframe** — not possible without React context; native contenteditable used instead. Do not retry.

---

## What Was Attempted and Failed — DO NOT RETRY

> These approaches were tried and explicitly rejected. Do not attempt them again
> without a specific instruction to reconsider.

| Approach | Why it failed | Alternative used |
|---|---|---|
| `component:update` for immediate save | Causes infinite save loop in GrapesJS | 2s debounced autosave in `initEditor.ts` |
| TipTap inside GrapesJS canvas iframe | No React context available inside iframe | Native GrapesJS `contenteditable` |
| `minio/minio` Docker image | Project discontinued; replaced in Phase 1.5 | `dxflrs/garage:v1.0.0` |
| `@opentelemetry/auto-instrumentations-node` (full bundle) | Adds Redis, gRPC, AWS instrumentation not needed; increases startup time | Selective: `instrumentation-http`, `instrumentation-express`, `instrumentation-mongoose` |
| Storing JWT access token in localStorage | LMS iframe compatibility — localStorage blocked in sandboxed iframes | Memory-only (Zustand state) |
| `pressSequentially` for Moodle login in E2E | Characters dropped under CPU load in CI | `page.fill()` (atomic assignment) |
| GrapesJS Studio SDK (enterprise) | Paid product — project uses MIT `grapesjs` only | Open-source `grapesjs` npm package |

---

## Next Steps (Ordered)

> Update this list at the end of every task block.

1. Review phase 2 remaining tasks in `docs/tasks.md` (T022–T028)
2. Begin tanda 2 — visual polish of the authoring UI
3. Phase 2.5 cross-cutting concerns (T160–T171) when visual polish is stable

---

## Visual Verification Status

> Track components that need visual review before the next release.

| Component | Status | Last verified |
|---|---|---|
| GrapesJS editor — empty canvas load | ✅ Verified | v0.5.9 |
| Widget drag & drop placement | ✅ Verified (FM-01 E2E) | v0.5.9 |
| Widget resize via handles | ✅ Verified (FM-03 E2E) | v0.5.9 |
| Image widget presigned URL display | ✅ Verified (FM-04 E2E) | v0.5.9 |
| Question properties panel sync | ✅ Verified (T608.5 E2E) | v0.5.9 |
| Slide navigation with persistence | ✅ Verified (persistence.spec.ts) | v0.5.9 |
| SCORM ZIP download | ✅ Verified (scorm-export.spec.ts) | v0.5.9 |
| Moodle SCORM import + player | ✅ Verified (moodle-scorm.spec.ts) | v0.5.9 |

---

## Architecture Reminders

> Quick reference for the most commonly forgotten constraints.

- **GrapesJS canvas = iframe** — use `editorPage.canvasComponent()` or `editorPage.canvasFrame()`, never `page.locator()` directly on canvas elements
- **Phaser = lazy load only** — never bundle Phaser into the main runtime player; always dynamic `import()`
- **Runtime player = Vanilla JS** — no React/Vue/Angular; it runs inside LMS iframes
- **No localStorage in player** — SCORM `suspend_data` via `LMSSetValue` only
- **All assets → Garage** — never MongoDB for binary data; Garage S3 only
- **Storage Manager is CRITICAL** — never let GrapesJS save raw HTML; always use the `elearn-api` custom storage type
- **MinIO does not exist** in this project — Garage only, everywhere

---

## File Locations Quick Reference

| What | Where |
|---|---|
| Task list with status | `docs/tasks.md` |
| Feature spec | `docs/features.md` |
| Architecture plans | `docs/plans.md` |
| Change history | `CHANGELOG.md` |
| Known issues per task block | `docs/issues/issues-TXX.md` |
| E2E tests | `e2e/tests/*.spec.ts` |
| Page Objects | `e2e/pages/` |
| E2E skill (patterns + gaps) | `.claude/skills/elearn-e2e-qa/SKILL.md` |
| Technical docs skill | `.claude/skills/elearn-docs-technical/SKILL.md` |
| User guide skill | `.claude/skills/elearn-docs-user/SKILL.md` |
