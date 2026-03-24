# Task T502: eLearn Studio User Guide — Content Review

**Task ID:** T502  
**Date:** 2026-03-24  
**Reviewer:** Claude Code  
**Status:** In Review

---

## Overview

Review of all user-facing documentation in `docs/user-guide/` against skill rules (elearn-docs-user). All 11 documents reviewed. Findings organized by severity.

---

## Critical Issues

None found.

---

## High Issues

### 1. Unexpanded Acronyms: ERP, UI, HR, IT Without Definitions

**Finding:** Several acronyms used on first mention without expansion or clear context. User may not understand the abbreviations, particularly non-technical course authors unfamiliar with enterprise systems.

Files and locations:
- `07-screenshot-simulations.md:3` — "ERP system" used without expansion (Enterprise Resource Planning)
- `07-screenshot-simulations.md:96` — "current UI" used without expansion (User Interface)
- `08-phaser-simulations.md:31` — "HR onboarding" and "IT incident" used as assumed knowledge

**Recommendation:** Expand acronyms on first use. For example, replace "ERP system" with "enterprise system (like SAP or NetSuite)" and "current UI" with "current interface".

---

### 2. Mixed Tense: "will be placed" in Instructional Context

**Finding:** Line 30 of `03-working-with-slides.md` uses future passive voice in a present-tense instructional context, inconsistent with skill rule "no future tense for current features."

**File and Line:** `03-working-with-slides.md:30`

Current text: "A blue line indicates where the slide will be placed when you release it."

**Recommendation:** Change to present/active voice: "A blue line shows where the slide appears when you release it."

---

### 3. Passive Voice in Slide Creation Context

**Finding:** Line 10 of `03-working-with-slides.md` uses passive voice "is added" instead of active construction.

**File and Line:** `03-working-with-slides.md:10`

Current text: "A blank slide is added after the currently selected slide."

**Recommendation:** Change to active voice: "The editor adds a blank slide after the currently selected slide."

---

## Medium Issues

### 4. Reference to Out-of-Scope Setup Guide

**Finding:** Index file references "Setup Guide" for Docker and server configuration, which may be outside user guide scope.

**File and Line:** `docs/user-guide/index.md:32`

**Recommendation:** Clarify that this applies to system administrators only, or remove if out of scope.

---

### 5. Moodle Version Reference Without Broader Platform Context

**Finding:** Line 48 of `09-publishing.md` specifically references "Moodle 4.x" without context for other LMS platforms.

**File and Line:** `09-publishing.md:48`

**Recommendation:** Add guidance for other LMS versions: "If you use Blackboard, Canvas, Cornerstone, or other LMS platforms, check your LMS documentation for upload steps."

---

### 6. Passive Voice in History Restoration Instructions

**Finding:** Line 24 of `10-course-history.md` uses passive voice "is saved" in instructional context.

**File and Line:** `10-course-history.md:24`

Current text: "Your current version is saved as a new history entry before the restore..."

**Recommendation:** Change to: "The editor saves your current version as a new history entry before the restore..."

---

### 7. Passive Voice in Section Header

**Finding:** Line 30 of `10-course-history.md` uses passive voice in heading.

**File and Line:** `10-course-history.md:30`

Current text: "## How often history is saved"

**Recommendation:** Change to: "## When eLearn Studio saves your history"

---

## Low Issues

### 8. Keyboard Shortcuts Without Full Expansion

**Finding:** Ctrl and Cmd abbreviations used without full explanation on first mention.

**Files:** `02-editor-overview.md:90` and `04-widgets.md:116`

**Recommendation:** Add clarity: "press **Ctrl+Z** (Control on Windows) or **Cmd+Z** (Command on Mac)"

---

### 9. Export Format Acronyms Without Expansion

**Finding:** SCORM, AICC, and xAPI acronyms not expanded on first use in `09-publishing.md`.

**Files:** `09-publishing.md:8, 21-24, 38`

**Recommendation:** Add introductory text explaining that SCORM is recommended and most widely supported.

---

### 10. ZIP File Capitalization Inconsistency

**Finding:** "ZIP" used in uppercase throughout; modern style prefers lowercase "zip file".

**Files:** `02-editor-overview.md:80`, `09-publishing.md:9, 40, 42`

**Recommendation:** Standardize on lowercase "zip file".

---

### 11. Screenshot Captions Could Add Context for New Users

**Finding:** Some captions use panel names without brief definition.

**File and Line:** `05-questions.md:45`

**Recommendation:** Add parenthetical context to "Properties panel" on first mention.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 3 | warn |
| MEDIUM | 4 | info |
| LOW | 4 | note |

**Verdict:** WARNING — 3 HIGH issues should be addressed before publication. Focus on acronym expansion and voice/tense consistency for non-technical audiences.

---

**Document Status:** Ready for author review.
