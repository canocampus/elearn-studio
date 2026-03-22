# Actions Editor Guide

**Last Updated:** 2026-03-22

The Actions Editor is the visual event-to-action programming system in eLearn Studio. It allows course authors to build interactive behavior without code: assign event triggers (widget clicks, slide transitions) to sequences of actions (navigate, show/hide, score, conditionals, loops, animations).

---

## Overview

```
┌─────────────────────────────────────────────────┐
│ ActionsPanel (T020.2)                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ Validation Warnings (if any) — T020.18     │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ EventSelector — tabs for each trigger      │ │
│ │ [click] [doubleClick] [mouseEnter] …       │ │
│ │ [enterSlide] [exitSlide]                   │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ ActionSequenceEditor                        │ │
│ │ Ordered list of actions for selected event │ │
│ │ ┌──────────────────────────────────────┐   │ │
│ │ │ [Navigate] target: next              │   │ │
│ │ │ [Show] widgetId: w-1                 │   │ │
│ │ │ [If/Else] expr: $score >= 70         │   │ │
│ │ │   ├─ [Score-Question] …              │   │ │
│ │ │   └─ [Display-Message] …             │   │ │
│ │ └──────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ ActionPalette — insert new action           │ │
│ │ Navigation | Object | Media | Scoring | ... │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ VariablePanel — define course variables     │ │
│ │ $ score_attempt_1, $ final_score            │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ SharedSequenceLibrary — course macros       │ │
│ │ [InitializationSequence] 3 actions          │ │
│ │ [FinalizeQuiz] 5 actions                    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Event Types

Actions are triggered by events. Each widget or slide can listen to specific event names.

### Widget Events

| Event Name | Trigger | Example |
|---|---|---|
| `click` | User clicked the widget | Button pressed, text box tapped |
| `doubleClick` | User double-clicked | Quick selection confirmation |
| `mouseEnter` | Cursor entered widget bounds | Hover tooltips, guidance highlights |
| `mouseLeave` | Cursor left widget bounds | Hide hints |
| `questionAnswered` | Learner submitted an answer | Any question widget |
| `questionCorrect` | Submitted answer was correct | Trigger congratulations action |
| `questionIncorrect` | Submitted answer was wrong | Trigger retry or hint |

### Slide Events

| Event Name | Trigger |
|---|---|
| `enterSlide` | Learner navigates to this slide (fired once) |
| `exitSlide` | Learner navigates away from this slide (fired once) |

---

## Action Types (14 total)

All action types are listed in `ACTION_PALETTE` in `/packages/authoring-ui/src/types/actions.ts`.

### Navigation (1)

#### Navigate
Jump to a slide in the course.

**Parameters:**
- `target` (required): One of:
  - `'next'` — advance to next slide
  - `'prev'` — go back to previous slide
  - `'first'` — jump to first slide
  - `'last'` — jump to last slide
  - `'slide-name'` — target by slide title (requires `slideName` param)
  - `'slide-number'` — target by 1-based index (requires `slideNumber` param)
- `slideName` (optional): Used when `target === 'slide-name'`
- `slideNumber` (optional): 1-based slide number; used when `target === 'slide-number'`

**Example (JSON):**
```json
{ "type": "navigate", "params": { "target": "next" } }
{ "type": "navigate", "params": { "target": "slide-name", "slideName": "Quiz Results" } }
{ "type": "navigate", "params": { "target": "slide-number", "slideNumber": 5 } }
```

### Object Control (4)

#### Show
Make a widget visible.

**Parameters:**
- `widgetId` (required): ID of the widget (e.g., `"w-abc123"`)

#### Hide
Hide a widget.

**Parameters:**
- `widgetId` (required)

#### Display Message
Show a modal dialog box.

**Parameters:**
- `title` (optional): Dialog title
- `message` (required): Body text

#### Play Animation
Play a pre-defined animation on a widget (requires animation setup in AnimationPropertiesPanel).

**Parameters:**
- `widgetId` (required)
- `animationName` (optional): Name of specific animation; if omitted, first animation is used

### Media Control (2)

#### Play Media
Start playback of audio or video widget.

**Parameters:**
- `widgetId` (required)

#### Stop Media
Pause or stop media playback.

**Parameters:**
- `widgetId` (required)

### Scoring & LMS Integration (4)

#### Score Question
Evaluate a single question widget (score-question action is typically not explicitly called; the player's event dispatcher handles `questionAnswered` automatically).

**Parameters:**
- `widgetId` (required)

#### Score Quiz
Calculate overall quiz score across all question widgets on the slide.

**Parameters:** None

#### Send to LMS
Report the quiz score to the SCORM LMS via `cmi.core.score.raw`.

**Parameters:** None

#### Suspend Lesson
Save player state to `cmi.suspend_data` (compressed, LZString-encoded) and mark completion.

**Parameters:** None

### Variables (1)

#### Set Variable
Create or update a course-level variable.

**Parameters:**
- `name` (required): Variable name (no `$` prefix in storage; must match regex `^[a-zA-Z_][a-zA-Z0-9_]*$`)
- `value` (required): Value to store
- `valueType` (required): One of:
  - `'literal'` — store `value` as-is (e.g., `"Hello"`)
  - `'expression'` — evaluate `value` using safe expression evaluator (e.g., `"$score * 2"`)

**Example:**
```json
{ "type": "set-variable", "params": { "name": "attempts", "value": "1", "valueType": "literal" } }
{ "type": "set-variable", "params": { "name": "final_score", "value": "$score * 0.8", "valueType": "expression" } }
```

### Flow Control (2)

#### Condition (If / Else)
Branch on a boolean expression.

**Parameters:**
- `expression` (required): Safe expression string. Variables are referenced with `$` prefix (e.g., `"$score >= 70"`). Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`. Supports boolean literals `true` and `false`.
- `then` (required): Array of actions to execute if expression is true
- `else` (optional): Array of actions to execute if expression is false

**Example:**
```json
{
  "type": "condition",
  "params": {
    "expression": "$score >= 70",
    "then": [
      { "type": "display-message", "params": { "message": "Pass!" } },
      { "type": "navigate", "params": { "target": "next" } }
    ],
    "else": [
      { "type": "display-message", "params": { "message": "Please try again." } }
    ]
  }
}
```

#### Loop
Repeat a sequence of actions.

**Parameters:**
- `mode` (required): One of:
  - `'count'` — repeat N times (requires `count` param)
  - `'while'` — repeat while condition is true (requires `condition` param)
- `count` (optional): Number of iterations; used when `mode === 'count'`
- `condition` (optional): Safe expression string; used when `mode === 'while'`
- `body` (required): Array of actions to repeat
- `maxIterations` (optional): Safety cap to prevent infinite loops (default: 1000)

**Example:**
```json
{
  "type": "loop",
  "params": {
    "mode": "count",
    "count": 5,
    "body": [
      { "type": "display-message", "params": { "message": "Iteration." } }
    ]
  }
}
```

### Macros (1)

#### Call Sequence
Invoke a named course-level shared sequence (macro).

**Parameters:**
- `sequenceName` (required): Name of the sequence to call (must exist in `course.sharedSequences`)

**Example:**
```json
{ "type": "call-sequence", "params": { "sequenceName": "InitializationSequence" } }
```

---

## Variables System (T020.16)

### Definition

Course-level variables are text-based key-value pairs. Define them in the VariablePanel. Variable names must match the regex: `^[a-zA-Z_][a-zA-Z0-9_]*$` (start with letter or underscore; subsequent chars are alphanumeric or underscore).

### Usage

In Set-Variable and Condition actions, variables are prefixed with `$` when referenced:
- `$score` — reference the variable named `score`
- `$attempt_count` — reference the variable named `attempt_count`

### Expression Evaluation

When a Set-Variable action has `valueType: 'expression'`, the runtime player evaluates the expression using a whitelist evaluator (not `eval()` — safe against injection). Supported operations:
- Arithmetic: `+`, `-`, `*`, `/`
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Literals: numbers (`123`, `45.6`), strings (`"hello"`), booleans (`true`, `false`)
- Variables: `$varName` (replaced with stored value)

### Persistence

Variables are stored in the player's ExecutionContext during the session. If suspend/resume is enabled (SCORM), only question scores are persisted to `cmi.suspend_data`; custom variables are lost on session restart.

---

## Shared Sequences (Course-Level Macros) (T020.17)

Shared sequences are reusable action sequences defined at the course level. They are invoked via the Call-Sequence action.

### Creating a Shared Sequence

In the SharedSequenceLibrary panel:
1. Enter a name (e.g., `"InitializeQuiz"`) in the input field
2. Click `+ Add`
3. The sequence is created with zero actions
4. (To edit actions: future UI work — currently macros can only be called, not edited in UI)

### Renaming / Deleting

- Double-click sequence name to rename (Enter to confirm, Escape to cancel)
- Click `✕` button to delete

### Invoking a Sequence

Add a Call-Sequence action with the name of the sequence. The executor will look up the name in `course.sharedSequences` and run all actions in the sequence body.

---

## Validation (T020.18)

The ActionsPanel displays validation warnings (non-blocking) at the top. The validator checks:

| Warning | Condition |
|---|---|
| `"<action>" requires a Widget ID` | Show, Hide, Play-Media, Stop-Media, Score-Question, Play-Animation action with empty widgetId |
| `"<action>" references unknown widget "<id>"` | Widget ID doesn't exist on current slide |
| `"navigate" to slide-name requires a slide title` | target is `'slide-name'` but slideName is empty |
| `"navigate" to slide-number requires a valid slide number (≥ 1)` | target is `'slide-number'` but slideNumber is missing or < 1 |
| `"set-variable" requires a variable name` | Set-Variable action with empty name |
| `"condition" requires an expression` | Condition action with empty expression |
| `"loop" in while mode requires a condition expression` | Loop with mode `'while'` but no condition |
| `"call-sequence" requires a sequence name` | Call-Sequence action with empty sequenceName |
| `"call-sequence" references unknown sequence "<name>"` | Sequence name doesn't exist in course.sharedSequences |

Warnings are displayed as yellow/orange text and do not prevent saving. Use them as hints to fix incomplete actions.

---

## Runtime Execution (T021)

### ActionExecutor

The ActionExecutor (in `/packages/runtime-player/src/actions/executor.ts`) runs action sequences serially — each action is awaited before the next begins.

**Key behaviors:**
- Errors in one action are caught and logged; remaining actions still run
- If multiple actions fail, a single aggregate error is thrown (but the session doesn't crash)
- Navigate actions are async (waiting for slide render); all others are sync
- Condition and Loop actions recurse into `executor.run()` for their nested branches

### Dispatch Table

| Action Type | Handler | Async? |
|---|---|---|
| navigate | executeNavigate | Yes |
| show, hide | executeShow / executeHide | No |
| set-variable | executeSetVariable | No |
| display-message | executeDisplayMessage | No |
| play-media, stop-media | executePlayMedia / executeStopMedia | No |
| score-question, score-quiz, send-to-lms, suspend-lesson | executeScoring* | No |
| condition | executeCondition (recurses) | Yes (if then/else is async) |
| loop | executeLoop (recurses) | Yes |
| play-animation | executePlayAnimation | No |
| call-sequence | executeCallSequence (recurses) | Yes |

### Execution Context

All action handlers receive an ExecutionContext containing:
- `variables`: Map<string, string> — custom course variables
- `currentSlideIndex`: number — slide position
- `slideCount`: number — total slides
- `widgets`: Map<string, Widget> — widget index
- `questionStates`: Map<string, QuestionState> — scores and answered flags
- (…and callbacks like `onNavigate`, `onMessage`, `onScore`)

---

## Integration Points

### Store (Zustand)

- **actionsStore**: Holds `sequences`, `sharedSequences`, `variableNames`, `selectedEvent`, `widgetId`, etc.
- Persisted by `useActionsSave()` hook on every change
- Saved to backend via POST `/api/courses/{courseId}/slides/{slideId}/actions`

### Authoring UI Components

- **EventSelector**: Tabs to switch between events; clicking a tab sets `selectedEvent` in store
- **ActionSequenceEditor**: Lists actions for the selected event; allows drag-to-reorder, delete
- **ActionPalette**: Grid of action buttons grouped by category; click to insert new action
- **ActionItemEditor**: Inline parameter editor for each action (renders type-specific UI)
- **VariablePanel**: Input field to add variable names; stored in `variableNames` array
- **SharedSequenceLibrary**: Manages course-level macro names

### Backend Integration

Courses store actions at the slide level:
```typescript
interface Slide {
  id: string
  title: string
  widgets: Widget[]
  // … other fields
}

interface Widget {
  id: string
  type: string
  // …
  actions?: ActionSequence[]  // [{ event: 'click', actions: [...] }, ...]
}
```

When you save a course, all actions are serialized to JSON and posted to the backend.

---

## Code Files

| File | Purpose |
|---|---|
| `/packages/authoring-ui/src/types/actions.ts` | Type definitions (Action union, WIDGET_EVENTS, SLIDE_EVENTS, ACTION_PALETTE) |
| `/packages/authoring-ui/src/components/actions/ActionsPanel.tsx` | Top-level panel (T020.2) |
| `/packages/authoring-ui/src/components/actions/ActionPalette.tsx` | Action button grid (T020.4-5) |
| `/packages/authoring-ui/src/components/actions/ActionItemEditor.tsx` | Parameter editors (T020.6-15) |
| `/packages/authoring-ui/src/components/actions/VariablePanel.tsx` | Variable definitions (T020.16) |
| `/packages/authoring-ui/src/components/actions/SharedSequenceLibrary.tsx` | Macro management (T020.17) |
| `/packages/authoring-ui/src/utils/validateSequence.ts` | Validation warnings (T020.18) |
| `/packages/runtime-player/src/actions/executor.ts` | Action runner (T021) |
| `/packages/runtime-player/src/actions/builtins/*.ts` | Action handlers (navigate, visibility, variables, media, scoring, etc.) |

---

## Example Workflow

1. **Select a widget** in the GrapesJS canvas (e.g., a button)
2. **Open the Actions panel** in the right sidebar
3. **Click "click" event tab** to respond to button clicks
4. **Click "Navigate" button** in the palette to insert a Navigate action
5. **Select "next"** from the target dropdown
6. **Save** (auto-saved via useActionsSave)
7. **Test**: Preview the course; click the button → advance to next slide

Another example (conditional quiz):

1. Add a Multiple-Choice Question widget to the slide
2. Add a Navigate action triggered by `questionCorrect` event
3. Add a Display-Message action triggered by `questionIncorrect` event
4. Test: Answer correctly → auto-advance; Answer incorrectly → show message

---

## Troubleshooting

**Q: Why is my navigation action not working?**
A: Check that the target slide exists and has a valid title/number. Look for validation warnings in the ActionsPanel.

**Q: Can I call one action sequence from another?**
A: Yes, use Call-Sequence. If the sequence doesn't exist, you'll see a validation warning.

**Q: How do I debug a complex conditional?**
A: Use Display-Message actions to log variable values (e.g., `"$score is ..."`) before the condition to verify the expression result.

**Q: Are variables case-sensitive?**
A: Yes. `$score` and `$Score` are different variables.

**Q: What happens if a loop condition never becomes false?**
A: The executor caps iterations at 1000 by default (`maxIterations` param). After 1000 iterations, the loop exits.
