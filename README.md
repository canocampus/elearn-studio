# eLearn Studio

[![CI](https://github.com/canocampus/elearn-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/canocampus/elearn-studio/actions/workflows/ci.yml)

An open-source, web-based e-learning authoring platform inspired by ToolBook 11.5.
Build software simulations, rich quizzes, and interactive courses — then publish to any
LMS via SCORM 1.2 / SCORM 2004 / AICC / xAPI.

---

## Quick Start

See **[docs/setup-guide.md](docs/setup-guide.md)** for the full setup guide.

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) (Engine ≥ 24)
- [Node.js](https://nodejs.org/) ≥ 20 LTS
- [pnpm](https://pnpm.io/) ≥ 9

### Run locally

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start core Docker services (MongoDB + Garage S3 + observability stack)
docker compose -f docker/docker-compose.dev.yml up -d

# 3. Start all packages in dev mode (hot-reload)
pnpm dev
```

Open **http://localhost:3000** for the authoring UI and **http://localhost:3001** for Grafana.

---

## Architecture

```
elearn-studio/
├── packages/
│   ├── authoring-ui/          # React 18 + Vite + GrapesJS — visual slide editor
│   ├── runtime-player/        # Vanilla JS — embeds in LMS iframes
│   ├── scorm-packager/        # SCORM 1.2 / 2004 / AICC / xAPI output
│   ├── question-engine/       # TypeScript — scoring/evaluation library
│   ├── actions-editor/        # React — event→action visual builder
│   ├── simulation-engine/     # Playwright recorder + screenshot sim player
│   └── phaser-simulations/    # Phaser.js 3 — advanced simulation widgets
└── backend/
    └── api/                   # Node.js 20 + Express 5 + TypeScript REST API
```

---

## License

eLearn Studio is released under the [MIT License](LICENSE).

Bundled components have their own licenses:
- **GrapesJS** — MIT
- **Phaser.js 3** — MIT
- **Garage** (Docker service only, not bundled) — AGPL-3.0
