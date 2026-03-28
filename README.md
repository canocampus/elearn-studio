# eLearn Studio

[![CI](https://github.com/canocampus/elearn-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/canocampus/elearn-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED)](https://docs.docker.com/desktop/)
[![Documentation](https://img.shields.io/badge/docs-elearn--studio-blue)](docs/index.md)

Open-source, web-based e-learning authoring platform inspired by ToolBook 11.5 — build software simulations, rich quizzes, and interactive courses, then publish to any LMS via SCORM 1.2 / SCORM 2004 / AICC / xAPI.

---

![Editor overview](docs/assets/screenshots/05-editor-widgets.png)
*Authoring UI — GrapesJS-based slide editor with Block Manager, Layer Manager, and Properties panel*

---

## System Architecture

**Core pipeline** — authoring to LMS delivery:

```mermaid
graph LR
  UI["authoring-ui (GrapesJS + React)"]
  SE["simulation-engine (Playwright)"]
  AE["actions-editor (React)"]
  SP["scorm-packager (ZIP Builder)"]
  RP["runtime-player (Vanilla JS)"]
  PS["phaser-simulations (Phaser.js)"]
  API["backend/api (Express + TS)"]
  DB[(MongoDB 7)]
  GRG[(Garage S3)]
  LMS[Moodle LMS]

  AE --> UI
  UI --> API
  SE --> GRG
  API --> DB
  API --> GRG
  SP --> DB
  SP --> GRG
  SP --> LMS
  PS --> RP
  RP --> LMS
```

**Observability** — structured logs and traces:

```mermaid
graph LR
  API["backend/api (Express + TS)"]
  LK[Loki]
  TM[Tempo]
  GF[Grafana]

  API --> LK
  API --> TM
  LK --> GF
  TM --> GF
```

---

## Quick Start

**Prerequisites:** [Docker Desktop](https://docs.docker.com/desktop/) (Engine >= 24), [Node.js](https://nodejs.org/) >= 20 LTS, [pnpm](https://pnpm.io/) >= 9

```bash
git clone https://github.com/canocampus/elearn-studio
cd elearn-studio
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.dev.yml up -d
pnpm install
pnpm dev
```

| Service | URL |
|---|---|
| Authoring UI | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Grafana (observability) | http://localhost:3010 |

---

## Features

- **Visual slide editor** — drag-and-drop canvas (GrapesJS), layer manager, style panel, 1024x768 fixed layout
- **Widget library** — text, image, button, shape, media player, score display, navigation controls
- **Multiple Choice questions** — per-question scoring, weighted attempts, instant feedback
- **True/False and Fill-in-the-Blank questions** — full scoring engine with partial credit support
- **Screenshot simulations** — record any desktop workflow with Playwright; replay as hotspot-driven practice
- **Phaser simulations** — process flows, physics demos, gamified quizzes, concept animators, interactive diagrams
- **Action Sequences** — visual event->action builder (show/hide, navigate, score, branch on condition)
- **SCORM 1.2 and SCORM 2004 export** — compliant ZIP packages, imsmanifest.xml, sequencing rules
- **AICC and xAPI export** — same packager pipeline, different manifest/statement formats
- **Moodle 4.x validation** — local Docker LMS for smoke-testing packages before release
- **Observability stack** — structured logs (Pino -> Loki), distributed traces (OTel -> Tempo), dashboards (Grafana)
- **Garage S3 asset storage** — all media, screenshots, and Phaser sprites stored in S3-compatible object store
- **JWT authentication** — register/login, Bearer token on all API routes

---

## Project Structure

```plaintext
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS — visual slide editor
│   ├── runtime-player/        # Vanilla JS — embeds in LMS iframes, loads widgets
│   ├── scorm-packager/        # SCORM 1.2 / 2004 / AICC / xAPI ZIP builder
│   ├── question-engine/       # Pure TypeScript — scoring and evaluation library
│   ├── actions-editor/        # React component — event→action visual builder
│   ├── simulation-engine/     # Playwright recorder + screenshot sim player
│   └── phaser-simulations/    # Phaser.js 3 — advanced simulation widget library
├── backend/
│   ├── api/                   # Node.js 20 + Express 5 + TypeScript REST API
│   ├── models/                # Mongoose schemas (Course, Slide, Widget, Asset)
│   └── storage/               # Garage S3 client + bucket management
├── docker/
│   ├── docker-compose.dev.yml # Dev stack: MongoDB, Garage, observability
│   └── docker-compose.yml     # Production-ready compose with Moodle
├── e2e/                       # Playwright E2E test suite (@elearn-studio/e2e)
└── docs/                      # All documentation + screenshot capture scripts
```

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 18, GrapesJS, Zustand, Vite | Authoring UI, visual editor, state management, bundling |
| **Simulation** | Phaser.js 3, Konva.js, Playwright | Phaser sims, hotspot editor, screenshot recorder |
| **Backend** | Node.js 20, Express 5, TypeScript 5, Mongoose | REST API, route handling, data access layer |
| **Storage** | MongoDB 7, Garage S3 | Course document store, asset and screenshot storage |
| **Packaging** | scorm-again, SCORM 1.2/2004, AICC, xAPI | LMS-compliant ZIP output for all major standards |
| **Observability** | Pino -> Loki, OpenTelemetry -> Tempo, Prometheus, Grafana | Structured logs, distributed traces, metrics, dashboards |

---

## Course Authoring Workflow

```mermaid
graph TD
  A[Create Course] --> B[Add Slides]
  B --> C[Place Widgets on Canvas]
  C --> D{Widget type?}
  D -->|Question| E["Configure Scoring and Feedback"]
  D -->|Simulation| F[Record or Build Simulation]
  D -->|Basic widget| G[Set Properties and Actions]
  E --> H[Preview in Runtime Player]
  F --> H
  G --> H
  H --> I{Looks correct?}
  I -->|No| B
  I -->|Yes| J[Export SCORM ZIP]
  J --> K[Upload to Moodle]
  K --> L[Validate LMS Tracking]
```

![Moodle — Safety Procedures Training course imported from eLearn Studio SCORM export](docs/assets/screenshots/18-moodle-course.png)
*SCORM 1.2 course imported into Moodle 4.x — ready to launch and track learner progress*

---

## Simulation Types

```mermaid
graph TD
  SIM[Simulation Types] --> SS[Screenshot Simulation]
  SIM --> PS[Phaser Simulation]

  SS --> SS1[Record with Playwright]
  SS --> SS2["Edit hotspots in Konva.js"]
  SS --> SS3["Replay - demo / practice / assessment"]

  PS --> PS1[Process Flow - Animated node diagrams]
  PS --> PS2["Physics Demo - Matter.js simulation"]
  PS --> PS3[Gamified Quiz - Timer + lives + combos]
  PS --> PS4[Concept Animator - Algorithm visualization]
  PS --> PS5[Interactive Diagram - Labeled hotspots]
```

---

## Documentation

| Document | Audience | Description |
|---|---|---|
| [Documentation Hub](docs/index.md) | All | Index of all guides and reference material |
| [User Guide](docs/user-guide/index.md) | Course authors | End-to-end guide: editor, widgets, questions, simulations, publishing |
| [Developer Guide](docs/developer-guide/index.md) | Contributors | Architecture, local setup, adding widgets/sims, observability, contributing |
| [API Reference](docs/api-reference/index.md) | Backend integrators | All REST endpoints with curl examples, TypeScript interfaces, error codes |
| [SCORM Guide](docs/scorm-guide/index.md) | LMS integrators | SCORM 1.2/2004/AICC export, Moodle import, compatibility matrix, troubleshooting |
| [Glossary](docs/glossary.md) | All | Key terms: SCORM, AICC, Widget, ActionSequence, Runtime Player, Garage |
| [Architecture](CLAUDE.md) | Architects / senior devs | Full system architecture, data model, GrapesJS and Phaser integration details |

---

## License

eLearn Studio is released under the [MIT License](LICENSE).

Bundled components:
- **GrapesJS** — MIT
- **Phaser.js 3** — MIT
- **Garage** (Docker service only, not bundled) — AGPL-3.0. Running Garage as a separate Docker service carries no licensing obligations for eLearn Studio code.
