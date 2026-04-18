# 20 — Glossary

A quick reference to the terms used throughout this guide. Terms are cross-referenced from other chapters; if you ever feel lost, come back here.

---

## Authoring

- **Course** — The complete lesson you are building. A course is a list of slides plus course-level settings (title, passing score, navigation mode).
- **Slide** — A single screen of your course. Each slide has a fixed canvas of 1024 × 768 pixels on which you place content.
- **Canvas** — The 1024 × 768 area in the centre of the screen where you design each slide.
- **Block** (also **Content block**) — Any element you drag onto a slide: a text, an image, a button, a question, a player, a simulation. Every block has its own settings in the **Props** tab.
- **Props** — The settings panel for the currently selected block. Shown in the **Props** tab on the right sidebar. The fields change depending on the kind of block.
- **Name** — An optional label you give to a block (Props → Name). It has no visual effect, but it makes the block easy to find later in the **Actions Editor** and in the **Layers** panel.
- **Layers** — A list of every block on the current slide. Use the Layers tab to find, select, or reorder blocks that overlap on the canvas.
- **Asset Library** — The built-in picker for images, audio, and video files. Open it by double-clicking an image block, or from the **Media URL** button on media blocks.
- **Alt text** — A short written description of an image. Read aloud by screen readers for learners who cannot see the image.
- **Auto-save** — Every change you make is saved automatically about two seconds after you stop editing. The save indicator in the top toolbar shows when it is in sync.
- **Undo / Redo** — Press **Ctrl + Z** to undo, **Ctrl + Y** to redo. Works for content changes on the canvas.

## Logic (Actions Editor)

- **Action** — Something the course does in response to a trigger. Examples: *Show* a block, *Navigate* to another slide, *Play Media*, *Set Variable*. Actions live inside an **action sequence**.
- **Trigger** — Something that happens and starts an action sequence. Examples: *click* a button, *enterSlide* (learner arrives at a slide), *questionCorrect* (learner answered correctly).
- **Action sequence** — An ordered list of actions attached to a trigger on a block or on a slide. "When trigger X happens, run this sequence."
- **Expression** — A short condition used in *If / Else* and *Loop* actions. Example: `$score > 80`. Supports variables, literals, and comparison operators.
- **Variable** — A named value your course remembers while the learner is working through it. Create and update one with the *Set Variable* action. Reference it in expressions with a leading `$`.
- **Shared sequence** (also **Macro**) — A named action sequence stored at course level. Call it from anywhere with the *Call Sequence* action. Useful for "reset state" or "report to LMS" patterns used on many slides.

## Questions and scoring

- **Multiple Choice** — A question with two or more options; the learner picks one or more correct answers.
- **True / False** — A question with two possible answers; the learner picks one.
- **Fill in the Blank** — A question with one or more blanks; the learner types the answer.
- **Weight** — How many points the question is worth when scored.
- **Attempts** — How many times the learner can try the question before it is locked. `-1` means unlimited.
- **Mandatory question** — A question the learner must answer before the **Next** button unlocks.
- **Feedback** — A short message shown to the learner after they answer. You can set different messages for correct and incorrect answers.
- **Done Button** — A special button that tells the course "I have finished." It triggers final scoring and reports completion to the Learning Management System. Every scored course should end with one.
- **Passing score** — The minimum score (0–100) a learner needs to pass the course.

## Simulations

- **Simulation** — An interactive activity learners practise before doing the real task. eLearn Studio has two kinds: **Software Walkthrough** and **Interactive Scenario**.
- **Software Walkthrough** — A recorded sequence that replays screenshots of a real application and guides the learner through each step.
- **Interactive Scenario** — An animated activity powered by a game engine. Choose from five scenario types: Process Flow, Interactive Diagram, Gamified Quiz, Physics Demo, Concept Animator.
- **Scene definition** — The data that describes what an Interactive Scenario shows: nodes, edges, hotspots, questions, and so on. Edit it in the structured builder in the **Props** tab, or in raw form in the Scene Definition field.
- **Hotspot** — A clickable region inside an Interactive Diagram. Each hotspot has a label, a description, and can be marked correct.

## Publishing and delivery

- **Learning Management System (LMS)** — The platform your organisation uses to deliver training, track progress, and record scores. Examples: Moodle, Canvas, Totara.
- **SCORM** — The packaging format that lets a course run inside an LMS. eLearn Studio supports three variants:
  - **SCORM 1.2** — Works with almost every LMS. Use this if you are not sure.
  - **SCORM 2004** — A newer variant; pick this if your LMS administrator recommends it.
  - **AICC** — Older and less common; pick this only if your LMS requires it.
- **Publish** — Package your course as a ZIP file ready to upload to your LMS. Done from the **Publish SCORM** button in the top toolbar.
- **Preview** — Try your course in a new browser window before publishing, to see what learners will experience.
