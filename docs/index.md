# eLearn Studio Documentation

Open-source, web-based e-learning authoring platform. Build software simulations, rich quizzes, visual action programming, and Phaser.js-powered simulations — then publish to any LMS via SCORM 1.2, SCORM 2004, or AICC.

---

## Getting Started

- **[Local Setup](developer-guide/02-local-setup.md)** — Prerequisites, Docker stack, environment variables, first-run checklist
- **[Setup Guide (overview)](setup-guide.md)** — Quick reference: ports, service URLs, common startup issues

---

## User Guide

For course authors and instructional designers:

| Section | Description |
|---|---|
| [Welcome](user-guide/01-welcome.md) | Screen tour, auto-save, terminology |
| [Getting Started](user-guide/02-getting-started.md) | Sign in, first course, 5-minute path |
| [Slides](user-guide/03-slides.md) | Add, rename, reorder, duplicate, delete |
| [Basic Blocks](user-guide/04-blocks-basic.md) | Text, Image, Button, Rectangle |
| [Navigation Blocks](user-guide/05-blocks-navigation.md) | Nav Buttons, Done Button, Progress Bar |
| [Media Blocks](user-guide/06-blocks-media.md) | Media Player, Audio Narration, Volume Control |
| [Assessment Blocks](user-guide/07-blocks-assessment.md) | Quiz Score, Score Field |
| [Questions](user-guide/08-blocks-questions.md) | Multiple Choice, True / False, Fill in the Blank |
| [Actions Editor](user-guide/09-actions-editor.md) | Course logic overview — "When X → do Y" |
| [Triggers & Actions Reference](user-guide/10-actions-triggers-reference.md) | Every trigger (9) and every action (15) |
| [Expressions, Recipes & Shared Sequences](user-guide/11-actions-expressions-recipes.md) | DSL, 5 ready-to-copy patterns, macros |
| [Simulations Overview](user-guide/12-simulations-overview.md) | Software Walkthrough vs Interactive Scenario |
| [Software Walkthrough](user-guide/13-software-walkthrough.md) | Screenshot-based guided practice |
| [Interactive Scenario](user-guide/14-interactive-scenario.md) | 5 Phaser scenario types with complete JSON examples |
| [Preview](user-guide/15-preview.md) | Popup preview, permissions, error recovery |
| [Publish as SCORM](user-guide/16-publish-scorm.md) | Format decision guide + LMS upload |
| [Worked Example](user-guide/17-worked-example.md) | Build a 5-slide course end to end |
| [Troubleshooting](user-guide/18-troubleshooting.md) | 10 symptoms with cause + fix |
| [QA & Developer Guide](user-guide/19-qa-developer-guide.md) | E2E suite, CI, writing specs (technical) |
| [Glossary](user-guide/20-glossary.md) | ~30 terms in plain language |

→ **[User Guide index](user-guide/index.md)**

---

## Developer Guide

For developers extending or contributing to eLearn Studio:

| Section | Description |
|---|---|
| [Architecture](developer-guide/01-architecture.md) | System design, monorepo structure, data model |
| [Local Setup](developer-guide/02-local-setup.md) | Full dev environment setup with Docker and pnpm |
| [Adding Widget Types](developer-guide/03-adding-widget-types.md) | GrapesJS block registration, properties panel, runtime rendering |
| [Adding Phaser Simulations](developer-guide/04-adding-phaser-simulations.md) | New sim subtypes, ScoreTracker, ModeController |
| [Observability](developer-guide/05-observability.md) | Structured logs, traces, Grafana dashboards, alert rules |
| [Contributing](developer-guide/06-contributing.md) | PR workflow, test requirements, commit conventions |

→ **[Developer Guide index](developer-guide/index.md)**

---

## API Reference

REST API documentation for all backend endpoints:

| Section | Endpoints |
|---|---|
| [Overview](api-reference/index.md) | Auth pattern, response envelope, error codes |
| [Auth](api-reference/auth.md) | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| [Courses](api-reference/courses.md) | Course CRUD + atomic slide operations |
| [Assets](api-reference/assets.md) | `POST /assets`, `GET /assets/:id` |
| [Export](api-reference/export.md) | `POST /courses/:id/export/scorm12` |
| [Simulations](api-reference/simulations.md) | Simulation import + screenshot proxy |
| [History](api-reference/history.md) | Course version history endpoints |
| [Telemetry](api-reference/telemetry.md) | OpenTelemetry + Prometheus metrics endpoint |
| [Health](api-reference/health.md) | `GET /health` — MongoDB + Garage status |

→ **[API Reference index](api-reference/index.md)**

---

## SCORM & LMS Integration Guide

Packaging courses for LMS delivery:

| Section | Description |
|---|---|
| [Overview](scorm-guide/index.md) | Which standard to choose, CMI data fields reference |
| [SCORM 1.2](scorm-guide/scorm12.md) | Export via API, Moodle import walkthrough |
| [SCORM 2004](scorm-guide/scorm2004.md) | Sequencing flow, manifest structure, differences from 1.2 |
| [AICC](scorm-guide/aicc.md) | 4-file format, HACP bridge, Moodle import |
| [Compatibility Matrix](scorm-guide/compatibility.md) | LMS × standard × feature support table |
| [Troubleshooting](scorm-guide/troubleshooting.md) | Common LMS integration problems and fixes |

→ **[SCORM Guide index](scorm-guide/index.md)**

---

## Reference

- **[Glossary](glossary.md)** — Key terms: SCORM, AICC, LMS, Widget, ActionSequence, Runtime Player, Garage, and more
- **[Changelog](../CHANGELOG.md)** — Release history by version (Phase 0 → Phase 5)
- **[Security Guide](security-guide.md)** — Authentication, authorization, secret management, deployment checklist
- **[Contributing Guide](contributing-guide.md)** — Contribution workflow, code of conduct, issue templates
- **[CLAUDE.md](../CLAUDE.md)** — Architecture notes, GrapesJS integration details, ToolBook mapping, licensing

---

## Issue Reports

Detailed problem reports and resolutions by phase (archived for reference):

- Phase 0: [T010](issues/issues-T010.md) – [T017](issues/issues-T017.md)
- Phase 1: [GrapesJS review](issues/PHASE-1.5-REVIEW.md)
- Phase 1.5: [T150](issues/issues-T150.md) – [T155](issues/issues-T155.md)
- Phase 2: [T020](issues/issues-T020.md), [T022](issues/issues-T022.md), [T023](issues/issues-T023.md)
- Phase 3: [T030](issues/issues-T030.md), [T034](issues/issues-T034.md), [T035](issues/issues-T035.md)
- Phase 4: [T041](issues/issues-T041.md), [T042](issues/issues-T042.md), [T043](issues/issues-T043.md)
- Phase 5: [T500](issues/issues-T500.md), [T501](issues/issues-T501.md), [T502](issues/issues-T502.md), [T503](issues/issues-T503.md), [T504](issues/issues-T504.md), [T505](issues/issues-T505.md)
- Phase 2.6 (Beta Review): [T600](issues/issues-T600.md), [T601](issues/issues-T601.md), [T602](issues/issues-T602.md), [T603](issues/issues-T603.md), [T604](issues/issues-T604.md), [T605](issues/issues-T605.md), [T606](issues/issues-T606.md), [T607](issues/issues-T607.md), [T608](issues/issues-T608.md), [TA608](issues/issues-TA608.md), [T609](issues/issues-T609.md), [TA609](issues/issues-TA609.md)
