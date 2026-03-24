# Changelog

All notable changes to eLearn Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] — 2026-03-24 — Documentation & Visual Guides

### Added
- **User Guide** — 10-section end-to-end guide for course authors: getting started, editor overview, all widget types, all question types, Actions Editor, screenshot simulations, Phaser simulations, publishing, and course history
- **Developer Guide** — 6-section guide for contributors: system architecture (Mermaid diagrams), local setup walkthrough, adding widget types, adding Phaser simulation subtypes, observability stack, and contributing workflow
- **API Reference** — Full REST API documentation for all 9 endpoint groups: auth, courses, assets, export, simulations, history, telemetry, health — with TypeScript interfaces, curl examples, status code tables, and error cases
- **SCORM & LMS Integration Guide** — 6-section guide: which standard to choose (decision flowchart), SCORM 1.2 export + Moodle import walkthrough, SCORM 2004 sequencing flow + manifest structure, AICC 4-file format + HACP bridge, full LMS × standard × feature compatibility matrix, 9-scenario troubleshooting guide
- **Documentation Home** (`docs/index.md`) — Updated hub page linking all structured guide directories
- **Glossary** (`docs/glossary.md`) — Definitions for SCORM, AICC, xAPI, LMS, Widget, ActionSequence, SimStep, Phaser Simulation, Garage, Runtime Player, and more
- **Playwright Screenshot Automation** — `docs/scripts/capture-screenshots.ts` captures 18 of 19 planned screenshots (screenshot 18 requires Moodle service); integrated as `pnpm --filter docs run capture`

### Fixed
- API reference: added missing `GET /health` and simulation endpoints documentation
- API reference: clarified logout response envelope exception
- All internal documentation cross-links verified and updated

---

## [0.4.0] — 2026-03-24 — Polish & Accessibility

### Added
- **WCAG 2.1 AA Accessibility Audit** — Full axe-core audit on runtime-player with ARIA labels, keyboard navigation for all interactive elements, color contrast compliance, and live regions for question feedback
- **SCORM 2004 Support** — Complete SCORM 2004 API bridge (Initialize/Terminate/GetValue/SetValue/Commit), sequencing rules XML, completion/success status fields, per-SCORM 2004 schema
- **Performance Optimizations** — Runtime player bundle under 21KB gzip; Phaser bundle under 321KB gzip; slide asset prefetching for next 2 slides; GrapesJS in-memory course cache elimination of redundant API calls
- **Course Templates** — Four built-in templates: Linear Course, Software Tutorial, Process Training, Assessment Only; template picker in "New Course" dialog; "Save as Template" action for any course
- **Complete Documentation Set** — User guide with all widget types, simulation guide covering screenshot sims and all Phaser sim types, actions editor reference, API documentation, SCORM compatibility matrix, developer guide

### Fixed
- All CRITICAL and HIGH issues from T040, T041, T042, T043 resolved
- Accessibility issues: button ARIA labels, question widget keyboard operability, Phaser sim keyboard navigation
- Performance: removed redundant API calls, optimized bundle sizes, added asset prefetching
- Template picker and dialog refinements

---

## [0.3.0] — 2026-03-23 — Phaser.js Advanced Simulations

### Added
- **Phaser.js Integration** — Lazy-loaded Phaser 3 bundle (only included if course contains Phaser sim); modular scene architecture with ScoreTracker and ModeController
- **Process Flow Simulation** — Animated node/arrow diagrams with demo/practice/assessment modes; demo auto-advances with configurable delay; practice requires correct node selection; authoring UI for node/edge list editing
- **Interactive Diagram Simulation** — Background image with overlaid hotspot sprites; info popups on click; assessment mode scoring; authoring UI for image and hotspot configuration
- **Gamified Quiz Simulation** — Countdown timer, lives system, score combo multiplier with animated feedback; final score screen; authoring UI for timer/lives/combo + question list
- **Phaser Widget in Authoring** — GrapesJS block registration; extended properties panel for simType selection, mode configuration, passing score; preview modal; JSON sceneDef editor
- **Phaser Widget in Runtime Player** — Dynamic import of Phaser bundle; widget container mounting; `elearn:widgetScore` event bridge to SCORM; proper cleanup on slide navigation
- **SCORM/AICC Integration for Phaser** — Conditional Phaser bundle inclusion in packagers; bundle only added if course contains Phaser widgets
- **109 Unit Tests** — ScoreTracker, ModeController, ProcessFlowLogic, InteractiveDiagramLogic, GamifiedQuizLogic, PhaserSimWidget mount/destroy, bundle conditionals

### Changed
- Phase 3 External Review Fixes (IMP-01 through IMP-05):
  - Cycle detection in shared action sequences (DFS-based with full path reporting)
  - Hover and typing interaction support in screenshot simulations
  - Bring-to-front action with z-index preservation on show
  - Suspend data usage indicator in publish panel (color-coded progress bar)

### Fixed
- All CRITICAL and HIGH issues from T030, T034, T035 resolved
- C-02: null guards in ScoreTracker and ModeController
- H-01: divide-by-zero in score calculation
- H-02: test isolation and proper cleanup
- H-03: missing type exports for scene classes

---

## [0.2.5] — 2026-03-22 — Cross-Cutting Concerns & External Review Fixes

### Added
- **Cycle Detection in Shared Sequences** — Dependency graph builder detecting direct cycles (A→A) and indirect cycles (A→B→A); full path reporting in validation warnings
- **Hover and Typing Step Types** — Interactive simulation support for `hover` and `type` interactions; case-insensitive text matching; attempt counting and feedback
- **Bring-to-Front Action** — Z-index management for widget layering; save/restore z-index on show/hide operations
- **Suspend Data Usage Indicator** — Color-coded progress bar in publish dialog (green <75%, amber 75–90%, red >90%); real-time estimate of compressed data size
- **100+ Unit Test Cases** — Cycle detection (3), suspend size bounds (1), nested action validation (1), concurrent animations (1), HACP cross-origin security (10), and more

### Fixed
- T201: cycle detection implementation with DFS algorithm
- T202: simulation step type extensions (hover, typing)
- T203: bring-to-front action with z-index preservation
- T204: suspend data usage indicator UI
- T205: external test cases for bounds, nesting, concurrency, and HACP security

---

## [0.2.0] — 2026-03-22 — Interactivity + Screenshot Simulations

### Added
- **Actions Editor** — Visual action programming interface with 13 action types: Navigate, Show/Hide, Set Variable, Display Message, Play/Stop Media, Score Question/Quiz, Send to LMS, Suspend Lesson, Bring to Front, Condition (if/else), Loop (count/while), Call Sequence, Play Animation
- **Event System** — Widget-level and slide-level events: onClick, onDoubleClick, onEnter, onQuestionAnswered, onSessionStart, onSessionEnd; event routing to action sequences
- **Variable System** — Course-level variable tracking with immutable updates; expression evaluation in conditions; literal and expression-mode parameter inputs
- **Shared Action Sequences** — Course-level macros (SharedActionSequence) with call-sequence action; dependency tracking; validation and cycle detection
- **Action Executor** — Runtime execution of all 13 action types with proper branching (conditions), looping (break/continue), and expression evaluation
- **Advanced Question Types** — Match items, drag-to-drop zones, arrange objects, order text segments, hotspot regions (single/multi-select)
- **Feedback System** — Delayed feedback queue with `enqueueFeedback` and `flushFeedback`; immutable feedback state; per-question result tracking
- **Answer Randomization** — Configurable randomization for multiple-choice questions with RNG seeding
- **Scoring Enhancements** — Partial credit, negative weight penalties (clamped 0–100), weighted aggregation per question
- **Remediation Paths** — Course-level remediation slide configuration; auto-navigate when final score < passMark
- **Screenshot Simulation Recorder** — Node.js service (simulation-engine, port 3002) using Playwright + Chrome DevTools Protocol
  - `POST /recorder/start` — launch Chromium, navigate to URL, return sessionId
  - `POST /recorder/capture` — screenshot + CDP event state (clicks, keyboard, select changes)
  - `POST /recorder/stop` — finalize session JSON, upload screenshots to Garage
  - `GET /recorder/sessions` — list all sessions
  - `GET /recorder/sessions/:id` — retrieve full session with steps and images
- **Screenshot Simulation Editor** — Konva.js canvas for pixel-precise hotspot editing over screenshots; step list with thumbnails; instruction/hint/feedback text per step; demo delay and max attempts configuration; step reordering and addition/deletion
- **Screenshot Simulation Player** — Three distinct modes:
  - **Demo** — auto-advance with step.demoDelay ms timer
  - **Practice** — wait for click in target rect (+ tolerance), provide feedback and retry up to maxAttempts
  - **Assessment** — single attempt, immediate scoring
  - Score = (correct steps / total steps) × 100; sent to SCORM `cmi.core.score.raw`
- **AICC Packager** — Generate `.au`, `.crs`, `.des`, `.cst` files per AICC specification; HACP runtime bridge with HTTP protocol support
- **Suspend/Resume** — Serialize course state (currentSlideIndex, scores, variables) as JSON, compress with LZString to fit within 4096 char SCORM suspend_data limit; restore on load via `LMSGetValue`
- **Path Animations** — Bezier path drawing in GrapesJS (Konva overlay); duration, easing, loop config; Web Animations API execution in runtime player; "Play Animation" action
- **117 Unit Tests** — ActionExecutor (all 13 action types, conditions, loops), advanced question evaluators, SimulationPlayer (3 modes), AICC file format, suspend/resume roundtrip

### Changed
- Slide model now includes `actions: ActionSequence[]` field; Widget model extended with `actions` sub-array
- Runtime player architecture refactored to support action execution alongside widget rendering
- SCORM export now includes suspend_data bridge

### Fixed
- All CRITICAL and HIGH issues from T020–T028 resolved
- Action validation with non-blocking warnings
- Race condition in action index tracking (stable prop instead of indexOf)
- Silent drop warnings for invalid actions
- Simulation step interaction type and feedback text

---

## [0.1.5] — 2026-02 — garage → Garage Migration

### Changed
- **Storage Layer Migration** — Replaced unmaintained garage OSS with **Garage** (AGPL, Rust-based, v1.0 stable)
- Docker images: `garage/garage` → `dxflrs/garage:v1.0.0`
- Backend SDK: `garage` npm package → `@aws-sdk/client-s3` (S3-compatible API)
- Configuration: new `docker/garage.toml`, updated `docker/.env.example`, `garage-init.sh` service for bucket and key setup
- All asset upload/download endpoints remain unchanged (transparent to authoring UI and runtime player)
- **Full backward compatibility** — All Phase 0 and Phase 1 tests pass identically with Garage backend

### Fixed
- S3 path-style URL configuration for Garage (`forcePathStyle: true`)
- Garage admin API calls (layout apply, key creation, bucket permissions)

---

## [0.1.0] — 2026-02-06 — Core Editor (GrapesJS) + SCORM Foundation

### Added
- **Monorepo Setup** — pnpm workspaces with 7 packages (authoring-ui, simulation-engine, question-engine, actions-editor, scorm-packager, runtime-player, phaser-simulations) + backend/api
- **Docker Infrastructure** — docker-compose.yml (api, mongo, garage, moodle, moodle-db) and docker-compose.dev.yml (hot reload); dev and production configurations
- **Backend API** — Express 5 + TypeScript in backend/api with:
  - MongoDB (Mongoose) with Course, Slide, Widget schemas
  - Garage S3-compatible storage for assets
  - `/health` endpoint (mongo + storage status)
  - Course CRUD: `POST /courses`, `GET /courses`, `GET /courses/:id`, `PUT /courses/:id`, `DELETE /courses/:id` (soft delete)
  - Atomic slide operations: `POST /courses/:id/slides`, `PATCH /courses/:id/slides/:slideId`, `DELETE /courses/:id/slides/:slideId` (R-07 fixes)
  - Asset management: `POST /assets` (multipart upload to Garage), `GET /assets/:id` (proxy download)
  - SCORM 1.2 export: `POST /courses/:id/export/scorm12` (streams ZIP via res.download)
- **GrapesJS Integration** — Full-featured visual slide editor with:
  - Fixed slide device (1024×768) + custom storage manager (`elearn-api` type) converting to/from our Course/Slide/Widget JSON schema
  - Custom blocks for all basic widget types: text, image, button, rectangle, nav-buttons, score-field, score-quiz, done-button, media-player
  - Question blocks: `question-mc`, `question-tf`, `question-fill`
  - Asset Manager connected to Garage via backend API
  - Layer Manager with z-order control and object naming
  - Style Manager for properties panel
  - Auto-save on component updates (2s debounce)
- **Question Engine Library** — `packages/question-engine` TypeScript library with:
  - Evaluators: `evaluateMultipleChoice()`, `evaluateTrueFalse()`, `evaluateFillInBlank()` (exact, case-insensitive, regex matching)
  - `calculateQuizScore()` with weighted averages and pass/fail determination
  - TypeScript discriminated union types for all question types
  - 20 unit tests covering edge cases and scoring
- **Slide Management** — Add, duplicate, delete, reorder slides; inline title editing; thumbnail generation via html2canvas
- **Extended Properties Panel** — React panel outside GrapesJS canvas for question widget configuration:
  - Multiple choice: options, mark correct, scoring, feedback
  - True/false: correct answer, scoring, feedback
  - Fill-in-blank: correct answers, match type (exact/regex/case-insensitive), feedback
  - Attempt limits and per-question scoring
- **SCORM 1.2 Packager** — `packages/scorm-packager` with:
  - `buildManifest()` generating imsmanifest.xml per IMS/ADL schema with masteryscore
  - `buildIndexHtml()` embedding course JSON (unicode-escaped) and loading player.js
  - Asset copying into ZIP under `assets/` folder
  - Standalone preview mode (graceful fallback when SCORM API not found)
  - Integration test: SCORM 1.2 ZIP imports into Moodle, imsmanifest validates, index.html loads player
  - 119 unit tests for manifest structure and file generation
- **Runtime Player** — `packages/runtime-player` Vanilla JS + HTML5 IIFE bundle (~19KB unminified) with:
  - JSON course loading (via `window.__courseData` or init param)
  - Absolute positioning slide rendering (x/y/w/h bounds)
  - All widget type rendering: text, image, button, rectangle, nav-buttons, score-field, done-button, media-player, question widgets
  - Interactive question evaluation (MC, TF, fill-blank) with client-side logic
  - Navigation buttons: prev/next/goToSlide
  - Quiz scoring: "Score Quiz" button collects answers, calculates weighted score
  - Done button: calls scormReport() → LMSSetValue score + lesson_status, LMSFinish
  - SCORM 1.2 API bridge: `findScormApi()` (traverses window.parent up to 10 levels), LMSInitialize/SetValue/Commit/Finish
  - Standalone mode: graceful SCORM reporting skip when API not found
  - Keyboard navigation: ArrowLeft/ArrowRight in standalone mode
  - lesson_location restore on init
  - HTML/CSS/attribute escaping helpers
  - 198 unit tests for all widget rendering and SCORM integration
- **Build Infrastructure** — Rollup configs for all packages; root scripts: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`
- **Testing** — Vitest + @testing-library/react for frontend; native Node test runner for backend; 80%+ coverage across all packages
- **Documentation** — setup-guide.md (Docker quick start, env vars, first-run checklist)

### Key Implementation Details
- All widgets stored as immutable objects with dedicated update functions (no mutations)
- GrapesJS canvas uses `position: absolute` for all components (fixed layout matching ToolBook)
- Custom storage manager prevents GrapesJS from saving raw HTML; always maps to our Course schema
- SCORM API lookup traverses up to 10 parent frames (LMS iframes)
- Asset URLs stored as direct Garage S3 URLs (no proxy overhead)
- Soft delete for courses (deleted_at timestamp, not hard-deleted)

### Fixed
- R-01/R-02: Consistent API response envelope (success, data, error)
- R-03: updateStorageContext callback integration with storage manager
- R-06: Multipart form-data headers for asset uploads
- R-07: Atomic slide operations using MongoDB positional updates ($set with array index)
- R-08: Dynamic health check URL configuration for authoring UI

---

## [Unreleased]

> Features under development or planned for future releases appear here.

---
