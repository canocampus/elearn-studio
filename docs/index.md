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
| [Getting Started](user-guide/01-getting-started.md) | First course walkthrough, interface tour |
| [Editor Overview](user-guide/02-editor-overview.md) | GrapesJS canvas, panels, slide navigation |
| [Working with Slides](user-guide/03-working-with-slides.md) | Add, duplicate, delete, reorder, templates |
| [Widgets](user-guide/04-widgets.md) | All widget types: text, image, button, shape, media, nav controls |
| [Questions](user-guide/05-questions.md) | MC, True/False, Fill-in-Blank, Match, Drag, Arrange, Hotspot |
| [Actions Editor](user-guide/06-actions-editor.md) | 13 action types, events, variables, conditions, shared sequences |
| [Screenshot Simulations](user-guide/07-screenshot-simulations.md) | Recorder workflow, hotspot editor, 3 play modes |
| [Phaser Simulations](user-guide/08-phaser-simulations.md) | Process flows, interactive diagrams, gamified quizzes |
| [Publishing](user-guide/09-publishing.md) | SCORM export, suspend data indicator, Moodle import |
| [Course History](user-guide/10-course-history.md) | Version history, restore, comparison |

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
