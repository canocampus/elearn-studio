# eLearn Studio Documentation

Welcome to the eLearn Studio documentation hub. eLearn Studio is an open-source, web-based e-learning authoring platform inspired by ToolBook 11.5, designed to create rich interactive courses with software simulations, advanced question types, visual action programming, and Phaser.js-powered simulations, all packaged for SCORM/AICC/xAPI distribution to any LMS.

---

## Getting Started

New to eLearn Studio? Start here:

- **[Setup Guide](setup-guide.md)** — Docker installation, environment variables, service URLs, first-run checklist
- **[Contributing Guide](contributing-guide.md)** — How to contribute code, report bugs, submit PRs; code of conduct

---

## User Documentation

For course authors and instructional designers:

- **[Authoring Guide](authoring-guide.md)** — Complete reference for building courses: GrapesJS editor overview, all widget types (text, image, button, questions), slide management, templates
- **[Simulation Guide](simulation-guide.md)** — Screenshot simulations (recorder workflow, hotspot editor, 3 play modes) and Phaser advanced simulations (process flows, interactive diagrams, gamified quizzes)
- **[Actions Editor Guide](actions-editor-guide.md)** — Visual action programming: 13 action types, event binding, variables, conditions, loops, shared sequences, expression evaluation
- **[SCORM Notes](scorm-notes.md)** — SCORM 1.2 and SCORM 2004 compatibility matrix, suspend_data limits, AICC integration; what to expect when publishing to Moodle or other LMS platforms

---

## Developer Documentation

For developers extending or contributing to eLearn Studio:

- **[Developer Guide](developer-guide.md)** — Monorepo structure, setting up dev environment, adding new widget types, creating custom Phaser simulation subtypes, package-by-package architecture overview
- **[API Reference](api-reference.md)** — Complete REST API documentation: all endpoints with request/response examples, authentication, error handling, asset management, SCORM export

---

## Architecture & Operations

- **[Observability Guide](observability-guide.md)** — Grafana, Loki, Prometheus, Tempo integration; monitoring dashboards, logging, distributed tracing setup
- **[Security Guide](security-guide.md)** — Authentication, authorization, input validation, CSRF protection, secret management, deployment security checklist
- **[Phaser Simulations Guide](phaser-simulations-guide.md)** — Deep dive into advanced simulations: architecture, ScoreTracker, ModeController, all sim subtypes, bundle strategy, adding new sim types

---

## Reference

Quick links to other reference materials:

- **[Main README](../README.md)** — Project overview, quick start, feature highlights, tech stack
- **[CLAUDE.md](../CLAUDE.md)** — Architecture notes, critical implementation details, licensing, ToolBook mapping
- **[CHANGELOG.md](../CHANGELOG.md)** — Complete changelog by phase, all features delivered

---

## Issue Documentation

Detailed problem reports and resolutions by phase (archived for reference):

- Phase 0: [Setup & Backend Foundation](issues/issues-T010.md) through [API Completion](issues/issues-T017.md)
- Phase 1: [GrapesJS Integration](issues/PHASE-1.5-REVIEW.md)
- Phase 1.5: [Garage → Garage Migration](issues/issues-T150.md) through [Reference Update](issues/issues-T155.md)
- Phase 2: [Actions](issues/issues-T020.md), [Simulations](issues/issues-T023.md), [Questions](issues/issues-T022.md)
- Phase 3: [Phaser Setup](issues/issues-T030.md), [Authoring](issues/issues-T034.md), [Runtime](issues/issues-T035.md)
- Phase 4: [Accessibility](issues/issues-T040.md), [SCORM 2004](issues/issues-T041.md), [Performance](issues/issues-T042.md), [Templates](issues/issues-T043.md)

---

## FAQ & Troubleshooting

**Q: How do I start eLearn Studio locally?**
A: See [Setup Guide](setup-guide.md) — `docker compose up` then navigate to http://localhost:3000

**Q: Can I export courses to Moodle?**
A: Yes! See [SCORM Notes](scorm-notes.md) for SCORM 1.2 and SCORM 2004 export and Moodle import procedures

**Q: What's the difference between screenshot simulations and Phaser simulations?**
A: Screenshot simulations are Playwright-recorded software UI walkthroughs with hotspot editing. Phaser simulations are animated, interactive diagrams and gamified quizzes. See [Simulation Guide](simulation-guide.md)

**Q: How do I add a new widget type?**
A: See [Developer Guide](developer-guide.md) — register a GrapesJS block, create an extended properties panel, implement runtime rendering

**Q: Can I use eLearn Studio in production?**
A: Yes, but see [Security Guide](security-guide.md) for deployment checklist: authentication, HTTPS, secret management, rate limiting, firewall rules

---

## Version & License

- **Current Version**: 0.4.0 (stable)
- **License**: MIT (see LICENSE file in repository root)
- **Last Updated**: 2026-03-24

---

## Community & Support

- **GitHub Issues**: [Report bugs or feature requests](https://github.com/elearn-studio/elearn-studio/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/elearn-studio/elearn-studio/discussions)
- **Contributing**: See [Contributing Guide](contributing-guide.md)
