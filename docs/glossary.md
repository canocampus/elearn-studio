# Glossary

Key terms used throughout the eLearn Studio documentation.

---

## A

**Action Sequence**
A named list of actions attached to a widget event or slide event. Defined in the Actions Editor and stored as `ActionSequence[]` on each `Slide`. At runtime, the Runtime Player executes the sequence when the event fires.

**AICC**
Aviation Industry CBT Committee. A legacy e-learning standard predating SCORM that uses HTTP POST (HACP protocol) instead of a JavaScript API. eLearn Studio generates compliant `.au`, `.crs`, `.des`, and `.cst` descriptor files. See [AICC Guide](scorm-guide/aicc.md).

**Assignable Unit (AU)**
The AICC term for a launchable piece of content. eLearn Studio publishes each course as a single AU. Defined in the `.au` descriptor file.

---

## C

**CMI (Computer Managed Instruction)**
The data model used by SCORM. Elements like `cmi.core.score.raw` (SCORM 1.2) and `cmi.score.raw` (SCORM 2004) are how the Runtime Player reports scores and status back to the LMS.

**Course**
The top-level document in eLearn Studio. A Course contains slides, templates, resources, settings, and SCORM metadata. Stored in MongoDB as a JSON document. Never called "project" or "book" in code or documentation.

---

## G

**Garage**
The S3-compatible object store used by eLearn Studio for all media assets (images, audio, screenshots, Phaser sprites). Runs as a Docker service. Licensed AGPL-3.0. **Not MinIO** — Garage is a separate project. See [deuxfleurs.fr](https://garagehq.deuxfleurs.fr).

---

## H

**HACP (HTTP AICC Communications Protocol)**
The transport layer used by AICC. Instead of calling a JavaScript API object, the Runtime Player POSTs `AICC_cmd=PutParam` messages to an LMS-provided URL. The AICC packager embeds an HACP bridge IIFE into `index.html` that implements `window.API` on top of `XMLHttpRequest`.

---

## L

**LMS (Learning Management System)**
The platform that hosts and tracks e-learning courses. eLearn Studio targets SCORM/AICC-compatible LMSes. Moodle 4.x is the primary validation target in development (runs as a Docker service on port 8081).

---

## P

**Phaser Simulation**
An advanced simulation widget powered by Phaser.js 3. Subtypes include `process-flow`, `physics-demo`, `gamified-quiz`, `concept-animator`, and `interactive-diagram`. The Phaser bundle is lazy-loaded and only included in SCORM packages when the course contains at least one Phaser widget. See [Phaser Simulations Guide](user-guide/08-phaser-simulations.md).

---

## R

**Runtime Player**
The Vanilla JS bundle (`player.js`) embedded in every SCORM/AICC package. It renders slides and widgets, runs Action Sequences, evaluates questions, and communicates with the LMS via the SCORM or AICC API. Built as a single IIFE; no React or other framework. Must stay under 150KB gzipped.

---

## S

**SCORM (Sharable Content Object Reference Model)**
The dominant e-learning packaging standard. A SCORM package is a ZIP containing `imsmanifest.xml`, an HTML entry point, and the course content. The LMS injects a JavaScript API object (`window.API` for SCORM 1.2, `window.API_1484_11` for SCORM 2004) that the Runtime Player uses to report scores and completion.

**SCORM 1.2**
The most widely supported SCORM version. Uses `window.API`, `LMSInitialize`, `LMSSetValue`, `LMSFinish`. Completion tracked via `cmi.core.lesson_status`. Suspend data limited to 4096 bytes. The default export format in eLearn Studio.

**SCORM 2004 4th Edition**
Extends SCORM 1.2 with separate `cmi.completion_status` and `cmi.success_status` fields, 64KB suspend data limit, and sequencing rules. Uses `window.API_1484_11`, `Initialize`, `SetValue`, `Terminate`.

**SCO (Sharable Content Object)**
The SCORM term for a launchable piece of content. eLearn Studio exports each course as a single SCO. Defined by the `adlcp:scormtype="sco"` attribute in `imsmanifest.xml`.

**SimStep / AuthoredSimStep**
A single step in a screenshot simulation. Contains the screenshot key, hotspot coordinates, interaction type (click/hover/type), instruction text, hint, feedback, and demo delay. Stored under `slide.screenshotSim.steps[]`.

---

## W

**Widget**
A content object placed on a slide. Each widget has a type (e.g., `text`, `image`, `question-mc`, `phaser-sim`), absolute bounds (`x`, `y`, `width`, `height`), layer order, and type-specific `extendedProperties`. Never called "component" or "element" when referring to course content objects.

---

## X

**xAPI (Experience API / Tin Can)**
A successor to SCORM that sends learning statements to a Learning Record Store (LRS) via REST. Not yet implemented in eLearn Studio. Listed as a planned future feature.
