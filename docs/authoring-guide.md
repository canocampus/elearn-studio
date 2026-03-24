# eLearn Studio — Authoring Guide

## Course Creation

### Starting a New Course

1. Click **New Course** in the welcome screen or toolbar
2. Choose a template from the template selection dialog:
   - **Linear Course**: Start with a blank multi-slide linear layout
   - **Software Tutorial**: Pre-built slides for step-by-step software walkthroughs
   - **Process Training**: Slides with process flow diagrams and decision points
   - **Assessment Only**: Quiz-heavy template for compliance or knowledge checks
3. Enter the course title (max 120 characters)
4. Click **Create**

The course opens immediately in the slide editor with your selected template applied.

---

## Slide Management

### Adding Slides

- Click **+ Add Slide** in the slide panel
- Choose to insert after the current slide or at the end
- Enter a slide title (default: "New Slide")
- Click **Create**

### Duplicating Slides

1. Right-click the slide in the slide panel
2. Select **Duplicate**
3. The new slide is inserted immediately after the original with all widgets and actions copied

### Deleting Slides

1. Right-click the slide
2. Select **Delete**
3. Confirm the deletion (cannot be undone)

### Reordering Slides

- Drag a slide up or down in the slide panel to reorder
- Or use keyboard shortcuts (Ctrl+Shift+Up/Down) when a slide is selected
- Changes save automatically

### Slide Properties

Click the **Slide Properties** button to access:
- **Title**: Slide name (displayed in LMS)
- **Template**: Apply a template to this slide
- **Transition**: Choose slide transition effect (fade, slide, zoom, etc.)
- **Duration**: Auto-advance after N seconds (0 = manual)

---

## Widget Types

### Text Widget

Displays static or formatted text.

**Properties:**
- **Text content**: Rich text editor (TipTap v2) supports bold, italic, lists, links
- **Font family, size, color**: Typography controls
- **Alignment**: Left, center, right, justify
- **Background**: Optional background color/image

**Authoring tip:** Use for instructions, descriptions, explanations.

### Image Widget

Displays images (PNG, JPG, WebP, SVG).

**Properties:**
- **Source**: Upload or select from asset library
- **Alt text**: Accessibility text
- **Dimensions**: Fixed or responsive sizing
- **Border, shadow, opacity**: Visual styling

**Authoring tip:** Compress images before upload to reduce course size.

### Button Widget

Interactive button for user actions (navigation, showing/hiding widgets, playing media).

**Properties:**
- **Label**: Button text
- **Style**: Color, size, shape (rectangular, rounded, pill)
- **Actions**: Assign actions (see Actions Editor Guide)

**Authoring tip:** Use consistent button labels across slides ("Next", "Submit", "Continue").

### Shape Widget

Geometric shapes (rectangle, circle, polygon, line).

**Properties:**
- **Shape type**: Rectangle, circle, or custom path
- **Fill color, border**: Styling
- **Width, height, rotation**: Dimensions

**Authoring tip:** Use shapes for visual grouping, dividers, or annotations.

### Question Widgets

Multiple question types for assessment.

#### Multiple Choice (MC)
One correct answer from N options.

**Properties:**
- **Question text**: The prompt
- **Options**: Array of answer choices
- **Correct index**: Which option is correct (0-based)
- **Scoring**: Weight (0-100) and max attempts (-1 = unlimited)
- **Shuffle**: Randomize option order per attempt
- **Feedback**: Per-option feedback text

#### True/False (TF)
Binary choice: true or false.

**Properties:**
- **Question text**: The statement
- **Correct answer**: true or false
- **Scoring**: Weight and attempts
- **Feedback**: Show on correct/incorrect

#### Fill in the Blank (FIB)
Short answer with configurable matching (exact, case-insensitive, partial).

**Properties:**
- **Prompt**: The sentence with blank
- **Correct answers**: Array of acceptable answers (e.g., ["USA", "United States"])
- **Match type**: `exact`, `case-insensitive`, or `partial`
- **Scoring**: Weight and attempts

#### Matching
Pair items from two columns.

**Properties:**
- **Left items**: Premises or concepts
- **Right items**: Responses
- **Pairs**: Array of correct matches (left index → right index)
- **Scoring**: Per-pair or all-or-nothing

#### Ordering
Arrange items in correct sequence.

**Properties:**
- **Items**: Array of items to order
- **Correct order**: Index array representing the correct sequence
- **Scoring**: Per-item or all-or-nothing

### Media Widget

Embed audio or video.

**Properties:**
- **Source**: Upload or paste URL (YouTube, Vimeo, etc.)
- **Controls**: Show/hide play, volume, progress bar
- **Autoplay**: Start automatically or on user click
- **Captions**: Upload SRT or VTT subtitle file
- **Poster**: Thumbnail image for video

**Authoring tip:** Keep videos under 5 minutes for better engagement. Always caption videos for accessibility.

### Navigation Widget

Links and buttons for slide navigation.

**Properties:**
- **Type**: Next slide, previous slide, go to specific slide, go to custom URL
- **Label**: Text to display
- **Conditional**: Show only if certain conditions are met

### Score Widget

Displays the learner's score.

**Properties:**
- **Format**: "Score: 95/100", percentage, letter grade
- **Visibility**: Always show or only on final slide
- **Reset**: Option to reset and retake course

### Screenshot Simulation Widget

Playback of recorded software UI steps (Playwright-based).

**Properties:**
- **Recording**: Select from uploaded screenshots and step definitions
- **Hotspots**: Define clickable regions with annotations
- **Mode**: Demo (auto-play), practice (learner clicks), or assessment (scored)
- **Step hints**: Text prompts for practice/assessment modes
- **Feedback**: Correct/incorrect responses per step

**Authoring tip:** Use hotspots to guide learners to relevant UI elements. Record on actual software, not mockups.

**Learn more:** See [simulation-guide.md](simulation-guide.md) for detailed recording, editing, and playback workflows.

### Phaser Simulation Widget

Advanced interactive simulations (Phaser.js 3 powered).

**Supported types:**

- **Process Flow**: Animated diagrams with click-through steps (IT incident workflow, HR onboarding, etc.)
- **Interactive Diagram**: Labeled hotspots on background image (anatomy, machinery, architecture)
- **Gamified Quiz**: Quiz wrapped in game mechanics (timer, lives, score multiplier)
- **Physics Demo**: Matter.js physics simulations (collisions, springs, gravity)
- **Concept Animator**: Step-by-step algorithm/data structure visualization

**Properties:**
- **Simulation type**: Choose from above
- **Scene definition**: JSON configuration (see Simulation Guide for examples)
- **Mode**: Demo, practice, or assessment
- **Passing score**: Required score to pass (0–100)
- **Width/Height**: Canvas dimensions

**Example sceneDef (Process Flow):**
```json
{
  "simType": "process-flow",
  "nodes": [
    { "id": "start", "x": 100, "y": 200, "label": "Start", "type": "start" },
    { "id": "review", "x": 300, "y": 200, "label": "Review Request", "type": "step" },
    { "id": "approve", "x": 500, "y": 200, "label": "Approve", "type": "decision" }
  ],
  "edges": [
    { "from": "start", "to": "review" },
    { "from": "review", "to": "approve" }
  ],
  "interactionMode": "practice",
  "steps": [
    { "nodeId": "review", "instruction": "Click to review the request", "correctAction": "click" }
  ]
}
```

For detailed sceneDef examples and configuration for all simulation types, see [simulation-guide.md](simulation-guide.md).

**Authoring tip:** Test Phaser sims in the preview panel before publishing. Physics sims are performance-intensive on older devices.

---

## Properties Panel

The Properties Panel (right sidebar) displays context-sensitive controls:

1. **Style Tab**: Common styles (background, border, shadow, opacity)
2. **Widget Tab**: Type-specific properties (for text: font size, color; for questions: correct answer)
3. **Actions Tab**: Assign actions to events (onClick, onComplete, onError)
4. **Advanced Tab**: Advanced settings (CSS classes, data attributes, custom scripts)

**Quick style application:**
- Select multiple widgets with Shift+Click
- Changes in Properties Panel apply to all selected widgets

---

## Saving and Auto-Save Behavior

- **Auto-save**: Every 15 seconds to the backend (indicated by a subtle checkmark in the UI)
- **Explicit save**: Ctrl+S or **File > Save**
- **Unsaved indicator**: A dot appears next to the course title when there are unsaved changes
- **Conflict resolution**: If another user edits the same course, you'll see a merge dialog before saving

**Best practice:** Assume all changes auto-save. Explicitly save before closing the browser or walking away from the computer.

---

## Template System

### Built-in Templates

eLearn Studio includes four built-in templates:

1. **Linear Course**: General-purpose multi-slide layout with text and image placeholders
2. **Software Tutorial**: Step-by-step walkthrough slides designed for screenshot simulations
3. **Process Training**: Slides with process flow diagrams and decision-point exercises
4. **Assessment Only**: Introduction + quiz slides + results slide; no content slides

### Applying Templates

- **To a new course**: Choose during course creation
- **To a single slide**: Right-click slide > **Apply Template** > select

### Saving Custom Templates

1. Create a slide layout you like
2. Right-click in the slide panel
3. Select **Save as Template**
4. Name it (max 100 characters)
5. Your custom template appears in the template selector for future courses

### Template Sharing

Custom templates are stored per-user in your account. To share a template with colleagues:
1. Export the course as a ZIP
2. Share the file
3. Recipient imports it via **File > Import Course**

---

## Publishing to LMS

### Export Formats

Click **Publish** to open the export dialog.

#### SCORM 1.2
- **Compatibility**: Moodle 4.x, Blackboard, Canvas, D2L, etc.
- **File**: `.zip` containing imsmanifest.xml + runtime player
- **Suspend Data**: LZ-String compressed JSON (max 4096 bytes per session)
- **Use this if**: Your LMS is unknown or predates 2010

#### SCORM 2004 (4th Edition)
- **Compatibility**: Modern LMS (Moodle 3.x+, Canvas 2020+)
- **File**: `.zip` with imsmanifest.xml and xsd schemas
- **Suspend Data**: 64KB limit per session
- **Use this if**: Your LMS explicitly supports SCORM 2004

#### AICC
- **Compatibility**: Legacy LMS still using AICC (rare)
- **File**: `.zip` with AICC course structure file (.cst)
- **Use this if**: Your LMS specifically requests AICC

#### xAPI (Tin Can)
- **Compatibility**: Learning Record Stores (xAPI endpoints)
- **Statements**: Verbs like "completed", "scored", "answered"
- **Endpoint**: Requires xAPI server URL
- **Use this if**: You're tracking to a centralized LRS for analytics

### Export Steps

1. Click **Publish** in the top toolbar
2. Select format (SCORM 1.2 is default)
3. Review settings (passing score, course title, etc.)
4. Click **Download**
5. A ZIP file downloads to your computer

### Upload to LMS

1. Log in to your LMS as an instructor
2. Create a new SCORM activity/resource
3. Upload the ZIP file
4. Configure completion requirements (optional)
5. Publish and test with a student account

---

## Best Practices

- **Keep slides focused**: One main idea per slide
- **Use templates**: Save design time and maintain consistency
- **Test all widgets**: Preview each question and simulation before publishing
- **Optimize media**: Compress images and videos to reduce course size
- **Provide feedback**: Add correct/incorrect feedback to all questions
- **Add captions**: Accessibility is required for many learning contexts
- **Version control**: Save major milestones (e.g., "v1.0 - Draft", "v1.1 - Review")

---

## Troubleshooting

### Course won't save
- Check your internet connection
- Try explicitly saving with Ctrl+S
- Check browser console (F12) for errors
- Refresh the page and reload the course

### Widget not appearing
- Check z-order in the Layer Manager (right panel)
- Verify widget is not outside the slide boundaries
- Check if visibility is set to hidden in Properties

### Question not scoring
- Verify the correct answer is selected
- Check passing score setting on the slide
- Ensure the question action is connected to a score widget
- Test in the runtime player preview

### Simulations slow or freezing
- Check Phaser sim complexity (many physics objects = slower)
- Test in a separate browser window (isolation from authoring UI)
- Disable auto-save temporarily (Settings > Performance)
- Try with fewer simultaneous simulations per course
