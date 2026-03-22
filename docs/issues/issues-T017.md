# issues-T017.md — Runtime Player

> Reviewer: code-reviewer agent | Date: 2026-03-21

## Issues Found

| ID | Severity | Location | Issue | Status |
|----|----------|----------|-------|--------|
| T017-01 | HIGH | `index.ts:492` | **Unhandled JSON.parse error**: `JSON.parse(courseJson)` throws `SyntaxError` on malformed input, crashing the entire player with no user-visible error. | **FIXED** — Wrapped in try/catch; renders "Course data is invalid." message on error. |
| T017-02 | HIGH | `index.ts:446-449` | **Global keydown listener**: `document.addEventListener('keydown', ...)` captures arrow keys even when player is not focused, breaking other interactive elements on the page. | **FIXED** — Changed to `container.addEventListener('keydown', ...)` with `tabindex="0"` on the container. |
| T017-03 | MEDIUM | `index.ts:462-464` | **CSS injection via `escCss()`**: Allowed `()`, `%`, `/` in CSS values enabled `url(javascript:...)` or `calc()` injection. | **FIXED** — Strict allowlist now excludes `()%/,`; only `[a-zA-Z0-9 #\-_.]` permitted. |
| T017-04 | MEDIUM | `index.ts:150, 159` | **Raw HTML in text widgets**: `renderText()` sets `innerHTML` from the `html` property without sanitization. If an author embeds script tags in a text widget, they execute in the player. | **DEFERRED** — Authors are trusted content creators in v1. DOMPurify integration is planned for Phase 2 when third-party course imports are added. **Why deferred:** In v1, courses are created exclusively by authenticated authors using the eLearn Studio editor. The editor does not allow arbitrary HTML injection — text widgets are authored via `contenteditable` with GrapesJS sanitizing the output. Adding DOMPurify now would strip intentional formatting HTML (bold, italic, links) unless the allowlist is carefully tuned, risking content corruption. **Unblock condition:** When the API gains an endpoint to import courses from external ZIP/SCORM packages (third-party content), add DOMPurify with a strict allowlist (`ALLOWED_TAGS: ['b','i','u','a','br','p','ul','ol','li','strong','em']`) before that feature ships. |
| T017-05 | MEDIUM | `index.ts:513-519` | **SCORM integer overflow**: `parseInt(loc, 10)` on untrusted SCORM API response; no `Number.isSafeInteger()` check. Extremely large values could theoretically bypass range check due to float imprecision. | **ACCEPTED** — Range check `idx >= 0 && idx < course.slides.length` is already in place. `Number.MAX_SAFE_INTEGER` edge case is not practically exploitable here. |
| T017-06 | LOW | `index.ts:149-152` | **Magic fallback chain in `renderText()`**: tries `html` then `content` properties. If widget schema changes, wrong property may be silently used. | **DEFERRED** — Schema is defined in CLAUDE.md. Canonical property is `html`; `content` is a legacy fallback. Will be removed when converter unit tests enforce schema. **Why deferred:** The `content` fallback exists to remain compatible with any courses saved before the `html` field was formalised. Removing it before all existing test courses have been migrated risks silently rendering empty text widgets. **Unblock condition:** Once `widgetsFromGrapesjs` in the converter always writes `html` (enforced by converter unit tests with no `content`-only fixture), remove the `?? widget.content` fallback and add an assertion that `widget.html` is always defined for text widgets. |
| T017-07 | LOW | Multiple | **parseInt radix**: all `parseInt` calls already use explicit radix `10`. Consistent; no change needed. | **ACCEPTED** |

## Summary

- 2 HIGH → FIXED
- 3 MEDIUM → 1 FIXED, 2 DEFERRED
- 2 LOW → ACCEPTED / DEFERRED

All CRITICAL and HIGH issues resolved.
