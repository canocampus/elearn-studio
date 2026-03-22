# eLearn Studio — Feature Specification

> Reference: ToolBook 11.5 User Guide (SumTotal Systems, 2012), 329 pages
> Additional frameworks: GrapesJS (slide editor), Phaser.js 3 (advanced simulations)
> Features prioritized by phase: P0 = MVP | P1 = Phase 2 | P2 = Phase 3+

---

## F01 — Course/Book Management

**ToolBook parity:** Books & Pages (Ch. 4)

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F01.1 | Create new course (blank, from template, from wizard) | P0 | |
| F01.2 | Save / autosave course as JSON via backend API | P0 | GrapesJS custom Storage Manager |
| F01.3 | Course templates (prebuilt layouts + navigation) | P1 | |
| F01.4 | Course settings: title, description, page size, orientation | P0 | |
| F01.5 | Password protection for courses | P2 | |
| F01.6 | Import slides from another course | P1 | |
| F01.7 | Export course as editable JSON bundle | P0 | |
| F01.8 | Slide outline view (Book Explorer equivalent) | P1 | GrapesJS Layer Manager + slide list |
| F01.9 | Page transition effects (fade, wipe, slide) | P2 | CSS transitions |
| F01.10 | Course versioning / history | P2 | |

---

## F02 — Slide/Page Editor (GrapesJS-based)

**ToolBook parity:** Author Level WYSIWYG (Ch. 3)
**Implementation:** GrapesJS + `@grapesjs/react` with custom blocks and storage

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F02.1 | WYSIWYG canvas editor at fixed slide size (default 1024×768) | P0 | GrapesJS deviceManager |
| F02.2 | Drag & drop widget placement from catalog onto canvas | P0 | GrapesJS BlockManager |
| F02.3 | Move and resize objects with handles | P0 | GrapesJS built-in |
| F02.4 | Multi-layer object system (z-index / layer order) | P0 | GrapesJS LayerManager |
| F02.5 | Foreground / Background (template) layer separation | P1 | GrapesJS frames |
| F02.6 | Grid overlay + snap-to-grid | P1 | GrapesJS canvas option |
| F02.7 | Object alignment tools (left, right, center, spread) | P1 | GrapesJS commands |
| F02.8 | Group / ungroup objects | P1 | GrapesJS group component |
| F02.9 | Object properties panel (bounds, fill, border, font) | P0 | GrapesJS StyleManager |
| F02.10 | Extended properties panel (question/sim/media specific) | P0 | Custom React panel (outside GrapesJS canvas) |
| F02.11 | Right-click context menu per object | P1 | GrapesJS contextMenu |
| F02.12 | Undo/redo stack (min 50 steps) | P0 | GrapesJS built-in |
| F02.13 | Widget catalog / block picker (all widget types) | P0 | GrapesJS BlockManager |
| F02.14 | Copy/paste objects within and across slides | P0 | GrapesJS built-in |
| F02.15 | Object naming (unique name for Actions Editor references) | P0 | GrapesJS component ID |
| F02.16 | Slide thumbnail generation | P1 | GrapesJS HTML export → render |
| F02.17 | Responsive preview (desktop / tablet / mobile) | P2 | GrapesJS deviceManager |
| F02.18 | Tab order editor (accessibility) | P2 | |

---

## F03 — Widget/Object Types

**ToolBook parity:** Catalog Objects (Ch. 5)
**Implementation:** Each type = GrapesJS Block + Component + runtime-player renderer

### Text & Layout
| ID | Feature | Priority |
|---|---|---|
| F03.1 | Text field widget (rich formatting via TipTap) | P0 |
| F03.2 | Record field widget (dynamic text per slide) | P1 |
| F03.3 | Image widget (PNG, JPG, SVG, WebP, GIF) | P0 |
| F03.4 | Rectangle / ellipse draw objects | P1 |
| F03.5 | Inline graphics inside text fields | P2 |

### Interactive
| ID | Feature | Priority |
|---|---|---|
| F03.6 | Button widget (text or image button) | P0 |
| F03.7 | Hotword (clickable text within a text field) | P1 |
| F03.8 | Hyperlink (go to slide / URL / popup overlay) | P1 |
| F03.9 | Text input field (non-question, user entry) | P1 |
| F03.10 | List box widget | P2 |
| F03.11 | Combo box / dropdown widget | P2 |
| F03.12 | Checkbox / radio button widget | P1 |

### Media
| ID | Feature | Priority |
|---|---|---|
| F03.13 | Universal Media Player widget (audio + video) | P0 |
| F03.14 | Media timing events (trigger actions at timestamps) | P2 |
| F03.15 | YouTube / external video embed | P2 |

### Navigation (prebuilt catalog items)
| ID | Feature | Priority |
|---|---|---|
| F03.16 | Navigation buttons (prev, next, first, last) | P0 |
| F03.17 | Table of contents / menu widget | P1 |
| F03.18 | Progress bar widget | P1 |

### Scoring & Tracking (prebuilt catalog items)
| ID | Feature | Priority |
|---|---|---|
| F03.19 | Score Page button (scores current slide questions) | P0 |
| F03.20 | Score Quiz button (scores all questions in course) | P0 |
| F03.21 | Show Score field (displays running score) | P0 |
| F03.22 | Done / Exit button (sends score to LMS) | P0 |
| F03.23 | Suspend Lesson button (saves state, enables resume) | P1 |
| F03.24 | Quiz Summary widget (table of Q results) | P1 |
| F03.25 | Certificate widget (student name pulled from LMS) | P2 |

---

## F04 — Question Engine

**ToolBook parity:** Ch. 13 "Creating a Quiz using Question Objects"
**Implementation:** `packages/question-engine` (pure TypeScript) + GrapesJS widget components

### Question Types
| ID | Type | Interaction | Priority |
|---|---|---|---|
| F04.1 | Multiple Choice (single correct) | Click option | P0 |
| F04.2 | Multiple Choice (multiple correct) | Click multiple | P0 |
| F04.3 | True / False | Click True or False | P0 |
| F04.4 | Fill in the Blank | Type response (exact/regex) | P0 |
| F04.5 | Match Items | Drag arrows to connect pairs | P0 |
| F04.6 | Drag Objects to Targets | Drag items to labeled zones | P0 |
| F04.7 | Drop Target (single zone) | Drag multiple items to one target | P1 |
| F04.8 | Arrange Objects | Reposition scrambled objects | P1 |
| F04.9 | Order Text | Drag phrases to reconstruct sequence | P1 |
| F04.10 | Hotspot (click image area) | Click correct region | P1 |
| F04.11 | Rating (weighted multiple choice) | Select rating option | P2 |

### Scoring Rules
| ID | Feature | Priority |
|---|---|---|
| F04.20 | Per-answer weight (0–100%) | P0 |
| F04.21 | Negative weight penalty for wrong answers | P1 |
| F04.22 | Min / max score per question | P0 |
| F04.23 | Attempt limit (1 to unlimited) | P0 |
| F04.24 | Randomize answer order | P1 |
| F04.25 | Score this question toggle | P0 |
| F04.26 | Correctness factor per answer | P1 |

### Feedback System
| ID | Feature | Priority |
|---|---|---|
| F04.30 | Immediate feedback (per answer, shown on click) | P0 |
| F04.31 | Delayed feedback (after scoring) | P0 |
| F04.32 | Feedback types: text popup, navigate to slide, play media | P0 |
| F04.33 | Feedback field on page (inline, not popup) | P1 |
| F04.34 | All correct / All incorrect / Partial branches | P1 |
| F04.35 | Remediation path (navigate to review on fail) | P1 |

---

## F05 — Actions Editor (Visual Programming)

**ToolBook parity:** Ch. 17–18 "Using the Actions Editor"
**Implementation:** `packages/actions-editor` React component + `ActionExecutor` in runtime-player

### Events (triggers)
| ID | Event | Priority |
|---|---|---|
| F05.1 | onClick | P0 |
| F05.2 | onDoubleClick | P1 |
| F05.3 | onEnterSlide | P0 |
| F05.4 | onExitSlide | P1 |
| F05.5 | onMouseEnter / onMouseLeave | P1 |
| F05.6 | onQuestionAnswered | P0 |
| F05.7 | onQuestionScored | P0 |
| F05.8 | onTimerElapsed | P1 |
| F05.9 | onMediaFinished | P1 |
| F05.10 | onSimStepComplete | P1 |
| F05.11 | onPhaserSimComplete | P1 |
| F05.12 | userEvent (generic) | P1 |

### Actions (behaviors)
| ID | Action | Priority |
|---|---|---|
| F05.20 | Navigate to slide (name / number / first / last / back) | P0 |
| F05.21 | Navigate to URL | P1 |
| F05.22 | Show / Hide object | P0 |
| F05.23 | Enable / Disable object | P1 |
| F05.24 | Set object property (text, color, visible…) | P0 |
| F05.25 | Play media | P0 |
| F05.26 | Stop / Pause media | P1 |
| F05.27 | Play path animation | P1 |
| F05.28 | Set variable (local or global) | P0 |
| F05.29 | Get variable value | P0 |
| F05.30 | Score question / Score quiz | P0 |
| F05.31 | Reset question | P1 |
| F05.32 | Send score to LMS (SCORM commit) | P0 |
| F05.33 | Suspend / Exit lesson | P0 |
| F05.34 | Condition (if/else) | P0 |
| F05.35 | Loop (N times / while condition) | P1 |
| F05.36 | Call shared action sequence | P1 |
| F05.37 | Display message / alert | P0 |
| F05.38 | Set simulation mode (demo / practice / assessment) | P1 |
| F05.39 | Trigger Phaser sim event (external message) | P1 |

### Actions Editor UI
| ID | Feature | Priority |
|---|---|---|
| F05.50 | Event selector dropdown | P0 |
| F05.51 | Drag-and-drop action palette (categorized) | P0 |
| F05.52 | Inline editable parameters (hotspot links in action text) | P0 |
| F05.53 | Condition / loop nesting with visual indentation | P1 |
| F05.54 | Variable definition panel (local + global) | P1 |
| F05.55 | Shared action sequences (reusable across objects) | P1 |
| F05.56 | Import / Export action sequence as JSON | P2 |
| F05.57 | Validate sequence (missing params warning) | P1 |

---

## F06 — Animation System

**ToolBook parity:** Animation Editor (Ch. 14)

| ID | Feature | Priority |
|---|---|---|
| F06.1 | Path animation — move object along defined path | P1 |
| F06.2 | Path editor on canvas (draw bezier path) | P1 |
| F06.3 | Animation speed / duration / easing control | P1 |
| F06.4 | Cel animation (frame-by-frame sprite) | P2 |
| F06.5 | Trigger animation via Actions Editor | P1 |
| F06.6 | Loop animation (N times or infinite) | P1 |
| F06.7 | CSS fade in/out for show/hide transitions | P1 |

---

## F07 — Screenshot Simulation Engine

**ToolBook parity:** Ch. 21 "Building Software Simulations" — Sim AutoBuilder + Simulation Editor
**Implementation:** Playwright recorder (`simulation-engine`) + Konva.js step editor + Vanilla JS player

### Recording (Sim AutoBuilder equivalent)
| ID | Feature | Priority |
|---|---|---|
| F07.1 | Launch Playwright recorder targeting any URL | P0 |
| F07.2 | Capture screenshots at each step (PrintScreen equivalent) | P0 |
| F07.3 | Record mouse: left/right/double click with target info | P0 |
| F07.4 | Record keyboard: keypress, Tab, Enter, function keys | P0 |
| F07.5 | Record list box / combo box selections | P1 |
| F07.6 | Record drag-and-drop | P1 |
| F07.7 | Save session as JSON + screenshots to Garage | P0 |
| F07.8 | Import recording → auto-generate SimStep array in course | P0 |

### Simulation Editor (Konva.js-based)
| ID | Feature | Priority |
|---|---|---|
| F07.10 | Step list with screenshot thumbnails | P0 |
| F07.11 | Draw / resize hotspot rectangle over screenshot (Konva) | P0 |
| F07.12 | Set instruction text per step | P0 |
| F07.13 | Set hint text (shown after wrong attempt) | P0 |
| F07.14 | Set correct / incorrect feedback per step | P0 |
| F07.15 | Set step timing for demo mode (seconds) | P0 |
| F07.16 | Set max attempts per step (practice mode) | P0 |
| F07.17 | Reorder / delete / add steps manually | P1 |
| F07.18 | Attach Actions Editor sequence to step completion | P1 |
| F07.19 | Preview simulation in any mode within authoring UI | P1 |

### Simulation Runtime Player (Vanilla JS)
| ID | Feature | Priority |
|---|---|---|
| F07.20 | **Demonstration mode** — auto-advance with timed delay | P0 |
| F07.21 | **Practice mode** — wait for correct action; hints after N fails | P0 |
| F07.22 | **Assessment mode** — one attempt per step; scored | P0 |
| F07.23 | Continue button (advance after max attempts) | P0 |
| F07.24 | Visual highlight of target area (optional) | P1 |
| F07.25 | Mode selector widget (choose mode or force one) | P1 |
| F07.26 | Simulation scoring → SCORM score bridge | P0 |
| F07.27 | Multi-page simulations (sim spans multiple slides) | P1 |

---

## F08 — Phaser.js Advanced Simulations (NEW)

**No ToolBook equivalent — eLearn Studio extension**
**Implementation:** `packages/phaser-simulations` + Phaser.js 3 (MIT)

### Phaser Simulation Types
| ID | Type | Description | Priority |
|---|---|---|---|
| F08.1 | **Process Flow** | Animated node/arrow diagram; learner navigates steps interactively | P0 |
| F08.2 | **Physics Demo** | Matter.js physics: objects, collisions, gravity, springs | P1 |
| F08.3 | **Gamified Quiz** | Quiz with game mechanics: timer, lives, score combos, animations | P1 |
| F08.4 | **Concept Animator** | Step-by-step visualization: sorting algos, network protocols, data structures | P1 |
| F08.5 | **Interactive Diagram** | Labeled diagram; click sprite hotspots to reveal info | P0 |

### Phaser Simulation Authoring (Visual Builder)
| ID | Feature | Priority |
|---|---|---|
| F08.10 | Phaser Sim builder panel in authoring UI | P0 |
| F08.11 | Process Flow: visual node editor (add/connect/label nodes) | P0 |
| F08.12 | Process Flow: set step instruction + correct/incorrect action per node | P0 |
| F08.13 | Interactive Diagram: upload background image + place hotspot sprites | P0 |
| F08.14 | Gamified Quiz: import question set + configure game rules | P1 |
| F08.15 | Physics Demo: configure objects, gravity, initial positions | P1 |
| F08.16 | Concept Animator: define states + transition animations via JSON | P1 |
| F08.17 | Preview Phaser sim inside authoring UI | P0 |
| F08.18 | Set simulation mode (demo / practice / assessment) | P0 |
| F08.19 | Set passing score threshold | P0 |

### Phaser Simulation Runtime
| ID | Feature | Priority |
|---|---|---|
| F08.20 | Lazy-load Phaser bundle only when course contains Phaser sim | P0 |
| F08.21 | Phaser sim runs inside a sandboxed div in the course player | P0 |
| F08.22 | Score reporting: dispatch `elearn:widgetScore` event on completion | P0 |
| F08.23 | SCORM bridge: Phaser sim score included in overall course score | P0 |
| F08.24 | Phaser sim respects simulation mode (demo/practice/assessment) | P1 |
| F08.25 | Phaser sim accessible: keyboard navigation for all interaction types | P2 |
| F08.26 | Phaser 4 (TypeScript native) migration path | P2 |

---

## F09 — Publish / Package

**ToolBook parity:** Ch. 20 "Distributing Applications on the Internet"

| ID | Feature | Priority |
|---|---|---|
| F09.1 | **Publish as SCORM 1.2** ZIP package | P0 |
| F09.2 | Publish as SCORM 2004 (4th edition) ZIP package | P1 |
| F09.3 | **Publish as AICC** (4 files: .au/.crs/.des/.cst) | P1 |
| F09.4 | Publish as xAPI / TinCan | P2 |
| F09.5 | Publish as standalone HTML5 (no LMS) | P0 |
| F09.6 | Generate `imsmanifest.xml` with course structure | P0 |
| F09.7 | SCORM 1.2 API bridge (pipwerks + custom) | P0 |
| F09.8 | Score tracking: `cmi.core.score.raw`, `cmi.core.lesson_status` | P0 |
| F09.9 | Suspend/resume via `cmi.suspend_data` | P1 |
| F09.10 | SCORM mastery score (pass/fail threshold) | P0 |
| F09.11 | Student name from LMS (`cmi.core.student_name`) | P1 |
| F09.12 | Include `phaser-bundle.js` in package only if course uses Phaser sims | P0 |
| F09.13 | SCORM test harness (run package locally without LMS) | P0 |
| F09.14 | Validate SCORM package before export | P1 |

---

## F10 — Course Runtime Player

**ToolBook parity:** Reader Level
**Implementation:** Vanilla JS, no frameworks, < 150KB gzipped (excluding Phaser)

| ID | Feature | Priority |
|---|---|---|
| F10.1 | HTML5 single-page player (embeds in LMS iframe) | P0 |
| F10.2 | Render all widget types from JSON | P0 |
| F10.3 | Slide navigation (prev/next/first/last/by name) | P0 |
| F10.4 | Execute Actions Editor sequences (ActionExecutor) | P0 |
| F10.5 | Progress tracking (slides visited, score accumulation) | P0 |
| F10.6 | Responsive scaling (fit to iframe) | P0 |
| F10.7 | Screenshot Simulation player (3 modes) | P0 |
| F10.8 | Phaser Simulation player (lazy load) | P0 |
| F10.9 | Table of contents / menu | P1 |
| F10.10 | Keyboard navigation | P1 |
| F10.11 | ARIA roles + screen reader support | P1 |
| F10.12 | Suspend/resume state restore | P1 |
| F10.13 | History / back navigation | P1 |
| F10.14 | Page transitions (CSS) | P2 |

---

## F11 — Authoring Backend

| ID | Feature | Priority |
|---|---|---|
| F11.1 | REST API: CRUD for courses | P0 |
| F11.2 | REST API: asset upload/download (Garage) | P0 |
| F11.3 | REST API: trigger SCORM package generation | P0 |
| F11.4 | REST API: Simulation recording start/capture/stop | P0 |
| F11.5 | REST API: user management (multi-author) | P1 |
| F11.6 | REST API: template management | P1 |
| F11.7 | Asset optimization (image compression on upload) | P2 |
| F11.8 | Course versioning / history | P2 |

---

## F12 — Dev & Testing Infrastructure

| ID | Feature | Priority |
|---|---|---|
| F12.1 | Docker Compose: authoring stack (API + MongoDB + Garage) | P0 |
| F12.2 | Docker Compose: LMS stack (Moodle + PostgreSQL) | P0 |
| F12.3 | SCORM test harness (local, no Moodle) | P0 |
| F12.4 | Unit tests: question-engine (all question types) | P0 |
| F12.5 | Unit tests: scorm-packager (manifest structure) | P0 |
| F12.6 | Unit tests: Actions executor (conditions, loops, variables) | P1 |
| F12.7 | Unit tests: Phaser sim score bridge | P1 |
| F12.8 | Integration test: SCORM package → Moodle import + completion | P1 |
| F12.9 | Integration test: course with Phaser sim → SCORM → Moodle | P1 |
| F12.10 | Playwright E2E: create course → publish → student completes | P2 |

---

## Priority Summary by Phase

| Phase | Scope | Key deliverable |
|---|---|---|
| **Phase 0 — Foundation** | F01.1-4, F11.1-4, F12.1-3 | Docker stack + skeleton monorepo |
| **Phase 1 — Core Editor** | F02 (GrapesJS base), F03 (P0), F04 (P0), F09.1+5 | Create + publish simple SCORM course |
| **Phase 2 — Interactivity** | F04 (P1), F05, F06, F08.1+5, F09.1-3 | Actions Editor + screenshot sims + AICC |
| **Phase 3 — Phaser Sims** | F08 (full) | Process flows + interactive diagrams + gamified quiz |
| **Phase 4 — Polish** | F10 (full), F12 (full), accessibility | Production-ready |
