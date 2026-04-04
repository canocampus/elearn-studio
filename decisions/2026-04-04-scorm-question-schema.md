## Decision: authoring-ui schema is the authoritative question schema; add `scormInteractionType` field to `BaseQuestionExtendedProps`

## Context

Two question schemas exist in the monorepo:
- `packages/authoring-ui/src/types/questions.ts` — rich authoring schema with `isCorrect: boolean` per option, `answers: string[]`, `matchType` enum
- `packages/question-engine/src/types.ts` — evaluation-only schema focused on scoring, not SCORM reporting

During D-01 (shared-types extraction) these would be merged. Needed to pick one as the basis.

Additionally: the platform must support custom widgets (e.g., word search, drag-and-drop) that have no direct SCORM 2004 CMI interaction type equivalent. These widgets still need to report scores to LMS.

## Alternatives considered

1. **question-engine schema as authoritative** — Keep the evaluation-oriented schema and extend it with SCORM fields.
2. **authoring-ui schema as authoritative** — Keep the authoring schema and add a `scormInteractionType` discriminator field.
3. **New unified schema** — Design from scratch for shared-types, discarding both existing schemas.

## Reasoning

**authoring-ui schema wins because:**
- `isCorrect: boolean` per option natively supports SCORM 2004 multi-correct-answer choice interactions (`correct_responses` = comma-joined IDs)
- `answers: string[]` maps 1:1 to SCORM `correct_responses` array patterns
- `matchType` maps cleanly to SCORM `{case_matters=true/false}` prefix for fill-in interactions
- The question-engine schema adds nothing beyond what authoring-ui already has for SCORM purposes
- A net-new schema would require migrating all existing courses and all existing tests — maximum disruption for D-01

**`scormInteractionType` field added because:**
- Widget type (e.g., `word-search`) and SCORM reporting type (e.g., `other`) are different concepts
- Decoupling them lets custom widgets choose their SCORM representation independently of their widget type
- Avoids a fragile mapping table in the SCORM packager (`if widgetType === 'word-search' then scormType = 'other'`)

## Reasoning for custom widget SCORM strategy

SCORM 2004 has `type: "other"` for arbitrary interactions — this is the correct mapping for custom widgets that do not fit standard categories.

SCORM 1.2 has no `other` type. The fallback is `true-false`: if the custom widget is solved/completed → `student_response = "true"`, `correct_response = "true"`. This preserves score tracking with minimal semantic loss.

The `scormCorrectResponsePattern?: string` field allows custom widgets to override the correct response string when the default (`"true"`) is not appropriate.

## Trade-offs accepted

- question-engine types will need a thin adapter layer when consumed outside authoring context (e.g., in runtime-player scoring) — acceptable, the adapter will be small
- `scormInteractionType` defaults must be set correctly per widget type in `registerBlocks.ts` — a one-time setup cost
- SCORM 1.2 `true-false` fallback for custom widgets loses semantic fidelity in LMS reporting — accepted as the correct pragmatic compromise
