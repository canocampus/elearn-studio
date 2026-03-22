# Simulation Guide

**Last Updated:** 2026-03-22

eLearn Studio supports two types of simulations:

1. **Screenshot Simulations** (Playwright-based) — Record software UI walkthroughs and replay with hotspot click verification
2. **Phaser Simulations** (game engine) — Advanced animations, process flows, physics demos (future; documented in CLAUDE.md)

---

## Screenshot Simulation Workflow

```
┌──────────────────┐
│ Simulation       │
│ Recorder         │  ← Start recording session (Playwright)
│ (T024 backend)   │  ← Navigate app, click UI elements
└─────────┬────────┘  ← Stop recording → save steps + screenshots
          │
          ↓
┌──────────────────────┐
│ SimulationEditor     │
│ (Konva canvas)       │  ← Import recorded steps
│ (T023 authoring-ui)  │  ← Draw hotspots on each screenshot
│                      │  ← Configure feedback, difficulty, mode
└─────────┬────────────┘
          │
          ↓
┌──────────────────────────┐
│ Course JSON              │
│ {                        │
│   slides: [{             │
│     widgets: [{          │
│       type: 'sim',       │
│       extendedProperties: {
│         steps: [         │
│           screenshot,    │
│           hotspot,       │
│           feedback, ...  │
│         ]                │
│       }                  │
│     }]                   │
│   }]                     │
│ }                        │
└─────────┬────────────────┘
          │
          ↓
┌──────────────────────┐
│ Runtime Player       │
│ (T025 player.ts)     │  ← Load sim widget on slide
│                      │  ← Enter demo/practice/assessment mode
│                      │  ← Detect clicks in hotspots
│                      │  ← Award scores, save to SCORM
└──────────────────────┘
```

---

## Recording (Backend — T024)

The Simulation Recorder runs in the backend. It uses Playwright Chromium to capture user interactions.

### Starting a Recording Session

**Endpoint:** `POST /api/simulations/recorder/start`

**Request:**
```typescript
{
  url: string        // URL of the app to record (e.g., "https://demo.app.com")
  title?: string     // Human-readable session title
}
```

**Response:**
```typescript
{
  sessionId: string
  url: string
  title: string
  status: 'recording'
  startedAt: ISO8601 string
  steps: []           // Initially empty
}
```

**What happens internally:**
1. Playwright launches Chromium headless instance with viewport 1280×720
2. A capture script (`CAPTURE_SCRIPT` in captureScript.ts) is injected via `addInitScript()`
3. Browser navigates to the URL
4. Initial screenshot is taken and uploaded to S3
5. Polling loop (every `recordConfig.pollIntervalMs`) flushes captured events from the page
6. Events are debounced (wait `recordConfig.debounceMs` after last event before snapping screenshot)
7. Each screenshot is stored in Garage under `recordings/{sessionId}/screenshots/step-NNNN.png`

### Manual Capture

**Endpoint:** `POST /api/simulations/recorder/capture`

**Request:**
```typescript
{ sessionId: string }
```

**Response:**
```typescript
{ steps: SimStep[] }  // Newly appended steps
```

Forces a screenshot immediately (useful when the auto-capture polling is too slow).

### Live Preview

**Endpoint:** `GET /api/simulations/recorder/screenshot`

**Query:** `?sessionId=<id>`

**Response:** JPEG image (quality 70) — shows current page state without creating a step.

### Stopping a Recording

**Endpoint:** `POST /api/simulations/recorder/stop`

**Request:**
```typescript
{ sessionId: string }
```

**Response:**
```typescript
{
  sessionId: string
  steps: SimStep[]         // All captured steps
  startedAt: ISO8601
  stoppedAt: ISO8601
  status: 'completed'
}
```

Flushes any pending events, closes the browser, and returns the completed session.

### Step Structure (Recorded)

Each captured interaction becomes a `SimStep`:

```typescript
interface SimStep {
  id: string              // UUID
  order: number           // 0-based index in session
  eventType: string       // 'click', 'change', 'keydown', etc.
  selector?: string       // CSS selector of target element
  targetText?: string     // Inner text of target (for debugging)
  coordinates?: { x: number; y: number }  // Click position if applicable
  value?: string          // Input value if applicable
  key?: string            // Keyboard key if applicable
  description: string     // Human-readable: "Click button 'Submit'"
  screenshotKey: string   // S3 path: "recordings/…/screenshots/step-0000.png"
  timestamp: ISO8601      // When captured
}
```

---

## Authoring (Authoring UI — T023)

The SimulationEditor (Konva.js-based) lets authors draw hotspots on each screenshot and configure scoring/feedback.

### Importing a Recording

1. In the authoring UI, create a new slide
2. Add a Simulation widget
3. Click "Import from recorder session" (or similar)
4. Select a recorded session by ID
5. All steps are imported with placeholder hotspots (full screenshot)

### Editing Hotspots

The Konva canvas displays the screenshot. Author can:

- **Draw a rectangle** hotspot on the clickable UI element
- **Adjust position/size** with resize handles
- **Set tolerance** (pixels of margin around hotspot for leniency)
- **Type a description** for the step (e.g., "Click 'Next'")

### Authoring Step Configuration

For each step, the author sets:

| Field | Type | Purpose |
|---|---|---|
| `description` | string | What this step demonstrates |
| `instruction` | string | What the learner should do (shown in bar) |
| `hint` | string | Optional hint if learner struggles |
| `correctFeedback` | string | Message on correct click (e.g., "Good!") |
| `incorrectFeedback` | string | Message on wrong click (e.g., "Try the button.") |
| `demoDelay` | number (ms) | How long to wait before auto-advance in demo mode |
| `maxAttempts` | number | Max wrong clicks before forcing advance (-1 = unlimited) |
| `hotspot` | Rect | Position/size/tolerance of clickable area |

### Playback Mode Configuration

At the widget level, author chooses:

| Mode | Behavior |
|---|---|
| `demo` | Auto-advance after demoDelay; hotspot highlighted yellow for guidance |
| `practice` | Learner must click hotspot; unlimited attempts (unless maxAttempts set); no scoring |
| `assessment` | Learner must click hotspot; score = fraction of steps with correct clicks; score reported to SCORM |

---

## Runtime Playback (T025)

The SimulationPlayer (in `/packages/runtime-player/src/sim/simPlayer.ts`) is a vanilla TypeScript state machine. It runs in the LMS iframe.

### HTML Structure

The player injects a shell into the widget container:

```html
<div class="el-sim-body">
  <img class="el-sim-screenshot" src="…" />
  <div class="el-sim-hotspot" style="…"></div>
  <div class="el-sim-click-layer"></div>
</div>
<div class="el-sim-bar">
  <span class="el-sim-step-counter">Step 1 / 10</span>
  <p class="el-sim-instruction">Click the Submit button.</p>
  <span class="el-sim-feedback" style="display:none;">Correct!</span>
  <button class="el-sim-next-btn" style="display:none;">Next</button>
</div>
```

### Initialization

```typescript
const cleanup = mountSimPlayer(
  containerElement,
  {
    sessionId: 'sim-widget-1',
    mode: 'assessment',              // 'demo' | 'practice' | 'assessment'
    passingScore: 70,
    steps: [
      {
        id: 'step-1',
        order: 0,
        description: 'Enter username',
        instruction: 'Click the username field and type.',
        hint: 'Look for the field labeled "Username".',
        correctFeedback: 'Good!',
        incorrectFeedback: 'That\'s not the username field.',
        demoDelay: 2000,
        maxAttempts: 3,
        screenshotKey: 'recordings/abc/screenshots/step-0000.png',
        screenshotUrl: 'http://api.local/assets/…',  // Backend-proxied
        hotspot: { x: 100, y: 150, width: 200, height: 40, tolerance: 10 }
      },
      // … more steps
    ]
  },
  {
    onComplete: () => { /* advance slide */ },
    onScore: (widgetId, score, weight) => { /* save score to SCORM */ }
  }
)

// Later, when navigating away:
cleanup()  // Cancel pending timers, remove event listeners
```

### State Machine Behavior

**Demo mode:**
- Screenshot displayed, yellow dotted hotspot shown
- After `demoDelay` ms, auto-advance to next step
- Click layer is non-interactive
- No feedback displayed

**Practice mode:**
- Screenshot displayed, blue dotted hotspot shown
- Learner can click anywhere on the screenshot
- If click is within hotspot bounds (± tolerance): show "Correct!" feedback, display "Next" button
- If click is outside hotspot:
  - First wrong attempt: show hint (if defined) + incorrectFeedback
  - Subsequent attempts: show only incorrectFeedback
  - If maxAttempts is reached: disable clicks, show "Next" button
- Learner clicks "Next" → advance to next step

**Assessment mode:**
- Same as practice, but:
  - Correct clicks increment `correctCount`
  - On completion: `score = correctCount / totalSteps`
  - Call `onScore(widgetId, score, weight)` to report to SCORM

### Reference Dimensions

Hotspots are authored in a **640×360 reference space** (fixed, matches the Playwright recorder viewport scaled down). At runtime, hotspots are scaled to fit the display container:

```typescript
const REF_W = 640, REF_H = 360
const clickX = (e.clientX - rect.left) / rect.width * REF_W
const clickY = (e.clientY - rect.top) / rect.height * REF_H
const hit = clickX >= hotspot.x - tolerance && clickX <= hotspot.x + hotspot.width + tolerance && …
```

### Cleanup

Always call the returned cleanup function when navigating away:
- Cancels pending demo timers
- Removes click event listener
- Prevents memory leaks

---

## Phaser Simulations (T022, Future)

Phaser.js 3 support is documented in `/CLAUDE.md` (advanced feature). Covers:

- Process flow simulations (diagram with animated transitions)
- Physics demos (gravity, collisions, springs)
- Gamified quizzes (timer, lives, combo points)
- Concept animators (algorithm visualization)
- Interactive diagrams (anatomy, machinery)

Phaser sims are authored as JSON scene definitions and are loaded lazily in the runtime player to keep bundle size down.

---

## Scoring and LMS Integration

### Screenshot Sim Scoring

Only in **assessment mode**:
- Score = `correctCount / totalSteps`
- Ranges [0.0, 1.0]
- Weight = 100 (default widget weight)

When simulation completes, `onScore(widgetId, score, weight)` is called. The runtime player bridges this to the SCORM API:

```typescript
// In runtime-player's scoring handlers:
if (api.LMSSetValue('cmi.objectives.0.score.raw', String(score * weight))) {
  // Success
}
```

### SCORM Suspend Data

If the learner exits the course mid-simulation:
- Current slide index is saved to `cmi.suspend_data` (compressed)
- On resume, player reloads the same slide
- Simulation steps are re-rendered from scratch (not resumed partway through)

---

## Configuration

### Backend (simulation-engine)

Edit `/packages/simulation-engine/src/config.ts`:

```typescript
export const recorder = {
  headless: true,            // true = no visible browser window
  pollIntervalMs: 500,       // How often to flush events
  debounceMs: 800,           // Wait after last event before screenshot
  timeoutMs: 600_000,        // 10 minutes max recording length
}
```

### Storage (S3/Garage)

Screenshots are uploaded to Garage S3-compatible service:
- Key format: `recordings/{sessionId}/screenshots/step-NNNN.png`
- Max file size: 10 MB per screenshot (validated before upload)
- Content-Type: `image/png`

To use a different S3 backend, configure in backend environment:
```
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=my-course-assets
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
```

---

## Code Files

| File | Purpose |
|---|---|
| `/packages/simulation-engine/src/recorder/browser.ts` | Main recorder: start/stop/capture sessions |
| `/packages/simulation-engine/src/routes/recorder.ts` | HTTP endpoints for recorder |
| `/packages/runtime-player/src/sim/simPlayer.ts` | Screenshot player state machine (T025) |
| `/packages/authoring-ui/src/components/simulation/SimulationEditor.tsx` | Hotspot editor (Konva.js) |
| `/packages/phaser-simulations/` | Phaser sim types & builders (future) |

---

## Troubleshooting

**Q: Recording session keeps timing out after 10 minutes.**
A: Increase `recorder.timeoutMs` in config. Default is 600_000 ms (10 min).

**Q: Screenshot is too large (> 10 MB) and fails to upload.**
A: The app being recorded is rendering at too high resolution. Try using a lower viewport size or disabling high-DPI scaling in Playwright config.

**Q: Hotspot click detection doesn't work; clicks outside the hotspot are marked correct.**
A: Check that `tolerance` is not set too high. Also verify the hotspot coordinates are in the 640×360 reference space, not the display space.

**Q: Assessment mode says "0 / 10 correct" even though learner clicked all hotspots correctly.**
A: In the demo, check `maxAttempts`. If set to 0, all clicks are treated as failed. Default should be -1 (unlimited).

**Q: Simulator doesn't show any steps.**
A: Check that the `steps` array is populated and `screenshotUrl` is reachable from the LMS iframe. The browser's console will log image load errors.

---

## Example: Recording a Login Simulation

1. **Start recording:**
   ```bash
   curl -X POST http://localhost:3000/api/simulations/recorder/start \
     -H "Content-Type: application/json" \
     -d '{"url":"https://demo-app.com/login","title":"User Login"}'
   ```
   → Returns `sessionId: "abc-123"`

2. **In the browser, manually interact:**
   - Click username field, type "alice"
   - Click password field, type "password123"
   - Click "Sign In" button
   - (Recorder captures events and screenshots automatically)

3. **Stop recording:**
   ```bash
   curl -X POST http://localhost:3000/api/simulations/recorder/stop \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"abc-123"}'
   ```
   → Returns all captured steps

4. **In authoring UI:**
   - Import the session
   - For each step, draw a hotspot around the clickable element
   - Set instruction: "Click the username field", "Click the password field", etc.
   - Set feedback: "Good!", "Incorrect field."

5. **In course preview:**
   - Slide loads with the simulator
   - Author tests by clicking the hotspots
   - On completion: score is saved to LMS
