# Developer & Contributor Guide

Technical reference for contributors and developers extending eLearn Studio.

---

## Contents

| Document | Description |
|---|---|
| [01 — Architecture](./01-architecture.md) | Package dependency graph, data model, runtime rendering pipeline |
| [02 — Local Setup](./02-local-setup.md) | Prerequisites, installation, service URLs, running tests |
| [03 — Adding Widget Types](./03-adding-widget-types.md) | GrapesJS Block + Component → storage converter → runtime renderer |
| [04 — Adding Phaser Simulations](./04-adding-phaser-simulations.md) | New Phaser simulation type from scene to runtime |
| [05 — Observability](./05-observability.md) | Logs, traces, metrics — Loki, Tempo, Prometheus, Grafana |
| [06 — Contributing](./06-contributing.md) | Branch naming, commit format, PR checklist, OpenAPI regeneration |
| [07 — Authentication](./07-authentication.md) | JWT access tokens, refresh tokens, Bearer injection, 401 handling, E2E auth setup |
| [08 — Persistence Flow](./08-persistence-flow.md) | GrapesJS edit → debounce → store() → PATCH API → cache update → slide-switch cache hit |
| [09 — Authoring UI Architecture](./09-authoring-ui-architecture.md) | Inside `packages/authoring-ui`: canvas lifecycle, Zustand vs Backbone, unified persistence, hooks, preview handshake, Props router |
| [10 — Docs Screenshots Playbook](./10-docs-screenshots-playbook.md) | How to regenerate User Manual v2 screenshots: prerequisites, techniques (tall-panel capture, native `<select>` size-expand, clean-filename bypass, widget-re-locate, Moodle context), deferred placeholders |
| [11 — Simulation Recorder Architecture](./11-simulation-recorder-architecture.md) | Simulation Recorder pipeline: topology (authoring-ui → backend api → simulation-engine → Garage), end-to-end sequence diagram, `recorderStore` vs `simStore` boundary, data shapes (RawSimStep / Session / SessionSummary / AuthoredSimStep / SimConfig), HTTP surface, lifecycle (start/capture/stop/import/save), threading and configuration |

---

## Quick orientation

```
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS — visual editor
│   ├── simulation-engine/     # Playwright recorder + sim routes
│   ├── question-engine/       # Pure TypeScript — scoring/evaluation
│   ├── actions-editor/        # React — event→action visual builder
│   ├── scorm-packager/        # SCORM 1.2 / 2004 / AICC / xAPI packager
│   ├── runtime-player/        # Vanilla JS — embeds in LMS iframes
│   └── phaser-simulations/    # Phaser.js 3 — advanced simulation widgets
├── backend/
│   ├── api/                   # Node.js 20 + Express 5 + TypeScript
│   ├── models/                # Mongoose schemas
│   └── storage/               # Garage S3-compatible asset storage
└── docker/
    ├── docker-compose.yml     # Production-like stack
    └── docker-compose.dev.yml # Hot reload, volume mounts
```

## Key constraints

- `runtime-player` is Vanilla JS only — no React, no framework bundles. It runs inside LMS iframes.
- Phaser is loaded lazily in the runtime player — never bundled into the main player JS.
- GrapesJS saves via a custom Storage Manager. Never let it write raw HTML to disk.
- All binary assets go to Garage. MongoDB stores course JSON only.

See [01 — Architecture](./01-architecture.md) for the full system diagram.
