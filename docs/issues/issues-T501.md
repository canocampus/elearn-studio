# issues-T501 — Root README.md Technical Review

**Task:** T501 — Root README for GitHub  
**Date:** 2026-03-24  
**Reviewer:** Claude Sonnet 4.6  
**Status:** PASS with recommendations (no blocking issues)

---

## Summary

The README.md file serves as the primary entry point for the eLearn Studio repository on GitHub. It provides a clear, well-structured overview of the project, architecture, quick-start instructions, and documentation index.

The review identified 5 non-critical findings across MEDIUM and LOW severity categories. All are minor clarity or consistency issues. No CRITICAL or HIGH issues detected.

---

## Issues

### T501-I01 — Missing runtime environment prerequisites (MEDIUM)

**File:** README.md, lines 71-82 (Quick Start section)  
**Finding:** The Quick Start guide omits explicit system requirements before running the docker compose command. A user on a system without Docker or Node.js installed will encounter cryptic failures rather than clear error messages.  
**Impact:** First-time users may be blocked unnecessarily. The error messages from missing dependencies are unhelpful.  
**Recommendation:** Add a "System Requirements" section immediately before or after the opening Quick Start paragraph:

```
## System Requirements

- **Docker & Docker Compose** v20.10+ (for MongoDB, Garage, Moodle, Grafana, Loki, Tempo)
- **Node.js** v20.x LTS
- **pnpm** v9.x
- **Git** (for cloning the repository)
```

Optionally link to the Setup Guide, which may already contain these details.

---

### T501-I02 — Inconsistent port documentation (MEDIUM)

**File:** README.md, lines 80-81  
**Finding:** The Quick Start section states "Open **http://localhost:3000** (Authoring UI) and **http://localhost:3001** (API)." However, Grafana is mentioned on line 81 as port 3010 without context. A user who sees port 3000 and 3001 might assume 3010 is a typo or minor port.  
**Impact:** Minimal confusion for experienced developers, but inconsistency breaks scanning flow.  
**Recommendation:** Unify port documentation as a list immediately after the docker command:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
pnpm install
pnpm dev

# Open services in your browser:
# - Authoring UI:    http://localhost:3000
# - Backend API:     http://localhost:3001
# - Observability:   http://localhost:3010 (Grafana)
```

---

### T501-I03 — Architecture diagram lacks observability detail (LOW)

**File:** README.md, lines 20-65 (System Architecture diagram)  
**Finding:** The "System Architecture" Mermaid graph is well-structured but labels the Observability subgraph with "Grafana :3010" instead of following the pattern of other subgraph elements. Line 47 shows `GF[Grafana :3010]` which is inconsistent with other nodes that do not include port numbers.  
**Impact:** Minor visual inconsistency. The port in the diagram is redundant (already documented in Quick Start).  
**Recommendation:** Remove the port from the node label. If port context is needed, add it to the Quick Start section instead:

```
GF[Grafana]:::infra
```

The diagram correctly shows the data flow (Loki → Grafana, Tempo → Grafana), so the port detail is unnecessary.

---

### T501-I04 — Documentation index lacks visual indicators for audience (LOW)

**File:** README.md, lines 227-236 (Documentation section)  
**Finding:** The documentation table lists six guides without audience indicators (e.g., "For course authors," "For backend developers," "For DevOps"). A new user cannot quickly determine which docs are most relevant to their role.  
**Impact:** Users may read irrelevant documentation first, delaying onboarding.  
**Recommendation:** Add an audience column or icon to the documentation table:

```markdown
| Document | Audience | Description |
|---|---|---|
| [User Guide](docs/user-guide/index.md) | Course Authors | End-to-end guide for building and publishing courses |
| [Setup Guide](docs/setup-guide.md) | DevOps / Local Development | Docker setup, environment variables, first-run checklist |
| [Contributing Guide](docs/contributing-guide.md) | Developers | Development workflow, tests, CI requirements |
| [API Reference](docs/api-reference.md) | Backend Developers | REST endpoints, schemas, authentication |
| [Observability Guide](docs/observability-guide.md) | DevOps / Operators | Grafana dashboards, LogQL queries, trace correlation |
| [Architecture](CLAUDE.md) | Architects / Senior Developers | Full system design, GrapesJS/Phaser integration, critical rules |
```

---

### T501-I05 — Mermaid tech-stack diagram exceeds best-practice node count (LOW)

**File:** README.md, lines 130-171 (Tech Stack diagram)  
**Finding:** The Tech Stack Mermaid graph contains 20 nodes organized into 5 subgraphs. Project style rules specify "max 12 nodes per diagram" for clarity and performance. The current diagram is readable but violates stated guidelines.  
**Impact:** Future diagram growth will compound complexity. The diagram is technically correct but aesthetically dense.  
**Recommendation:** Split into two diagrams:

**Diagram 1 — Core Tech Stack (9 nodes):**
```
graph TD
  F[React 18]:::frontend
  G[GrapesJS]:::frontend
  B[Node.js 20 + Express 5]:::backend
  M[MongoDB 7]:::storage
  S[Garage S3]:::storage
  P[Phaser.js 3]:::frontend
  SC[scorm-again]:::pkg
  OT[OpenTelemetry]:::infra
  GR[Grafana]:::infra
```

**Diagram 2 — Supporting Libraries (detailed breakdown of Frontend/Backend tools):**
Focus on the primary layers (Frontend, Backend, Storage, Packaging, Observability) as visual categories rather than individual nodes.

Alternatively, convert to a table format (which is more maintainable):

```markdown
| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18, GrapesJS, Zustand, Vite, Phaser.js 3, Konva.js | UI, visual editing, state, bundling, simulations |
| Backend | Node.js 20, Express 5, TypeScript 5, Mongoose | API server, database ORM |
| Storage | MongoDB 7, Garage S3 | Document DB, object storage |
| Packaging | scorm-again, SCORM 1.2/2004, AICC, xAPI | LMS compliance |
| Observability | Pino, OpenTelemetry, Prometheus, Grafana | Logging, tracing, metrics, dashboards |
```

---

## Resolved before closing T501

None of the above issues block the publication of README.md. All are non-blocking refinement recommendations.

The README successfully conveys:
- Project purpose and differentiation (ToolBook-inspired platform)
- Technology selection rationale
- Quick-start path for new developers
- Comprehensive feature list
- Clear architecture diagrams
- Documentation index

The document is production-ready as-is. Recommendations above enhance clarity and consistency rather than fix defects.

