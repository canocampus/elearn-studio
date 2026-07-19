# Conditional navigation: SCORM-aligned correctness gating (TD-021)

**Date:** 2026-07-19
**Status:** Accepted (delivered with TD-021)
**Owner directive:** "quien nos va a marcar como solucionarlo no es mi opinión
sino cómo funcione el estándar SCORM" — the standard arbitrates the design.

## Question

Storm-style courses block advancement until a test is completed *correctly*.
Our declarative gate (T611) only required questions to be *answered*. Where
should correctness gating live — in our runtime, or in SCORM's own
sequencing machinery?

## What the standard says (primary sources)

1. **SCORM 2004 sequencing operates between activities (SCOs) only.** The
   technical reference is explicit: *"Sequencing doesn't affect how SCOs
   operate and navigate internally, that part is still completely up to the
   content developer."* (scorm.com, Technical SCORM → Sequencing.)
   `preConditionRule`/`minNormalizedMeasure`/`controlMode forwardOnly` gate
   the delivery of *activities*, not pages inside one SCO.
2. **SCORM 1.2 has no sequencing at all** (no S&N book). Intra-SCO gating is
   the only possible mechanism — and 1.2 is the format we recommend for
   maximum LMS compatibility.
3. **The standard's mastery channel to a SCO** is the read-only, LMS-provided
   threshold: `cmi.scaled_passing_score` (2004, 0..1) /
   `cmi.student_data.mastery_score` (1.2, 0..100), initialised from the
   manifest (`imsss` objective / `adlcp:masteryscore`).

## Decision

1. **Correctness gating is implemented in the runtime player** (single-SCO
   architecture): `scoring.requireCorrect` per question; in `linear-strict`
   mode `slideIsComplete()` requires the evaluator's correctness verdict, not
   mere answering. This is what the standard prescribes for intra-SCO
   navigation and what mainstream single-SCO tools (Storyline, iSpring) do.
2. **Attempts are enforced** at the Submit button (previously unimplemented:
   the button hard-disabled after the first answer while the default feedback
   said "Try again"). Wrong answers re-enable Submit while attempts remain
   (`-1` = unlimited).
3. **Exhausting attempts unlocks navigation** — learners are never trapped;
   the failure lands in the reported score/status. (Future knob if needed:
   remediation jump instead of unlock.)
4. **The LMS-provided mastery threshold overrides the packaged passMark**
   (its prerogative per the standard). Effective precedence, resolved once in
   `init()`: LMS value → `metadata.masteryScore` → `settings.passingScore` →
   init option → 80.
5. Suspend payloads (v2) carry `c` (correct) and `t` (attemptsUsed) per
   question; legacy entries infer `c` from a full score and `t` from
   answered-ness, so resumed learners are never re-trapped.

## Non-goal (documented with cause)

**Multi-SCO packaging with IMS Simple Sequencing** (the standard's own
conditional-delivery machinery) is explicitly out of scope: it does not exist
in SCORM 1.2, real-world LMS support for 2004 sequencing is notoriously
inconsistent, and it would be a full packaging-architecture rewrite. Revisit
only if a customer LMS demands LMS-enforced (rather than content-enforced)
gating.

## Relationship to TD-017

The manual's §17 slide-level If/Else branching recipe existed because the
declarative model could not express "advance only if correct". With TD-021
the §17 worked example can be rewritten on the supported feature; TD-017
(slide-level actions surface) is downgraded to an authoring-power feature,
independent of navigation conformance.

## Verification

Runtime 278/278 (13 new TD-021 behavioural tests incl. LMS-override cases);
authoring-ui 1049/1049 (+3 Scoring-section tests); E2E `@regression TD-021`
(wrong answer → gate holds + Submit retryable; correct → unlocks) plus
question-widget/preview-handshake/scorm-export 47/47; verify:test green
across all 7 packages.

## Sources

- https://scorm.com/scorm-explained/technical-scorm/sequencing/
- https://scorm.com/scorm-explained/technical-scorm/run-time/run-time-reference/
- https://scorm.com/scorm-explained/technical-scorm/sequencing/sequencing-definition-structure/
