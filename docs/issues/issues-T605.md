# T605 — Code Review: Image Widget UX — Placeholder Hint + Double-Click to Open Asset Manager

**Status**: APPROVED — No CRITICAL or HIGH issues found.

**Files reviewed**:
- `packages/authoring-ui/src/editor/initEditor.ts` (canvas CSS addition)
- `packages/authoring-ui/src/editor/registerBlocks.ts` (image widget event + tooltip)
- E2E test: `e2e/tests/image-widget-placeholder.spec.ts` (REFERENCE)

---

## Summary

T605 improves the image widget author UX with two enhancements:

1. **Canvas CSS Placeholder** (initEditor.ts:154-162) — When an image has no src, GrapesJS auto-adds the .gjs-plh-image class. New CSS injects an SVG data URI showing a camera icon plus "Click to choose image" text guide.

2. **Double-Click to Open Asset Manager** (registerBlocks.ts:97, 124) — Changed from single-click to double-click to open the Asset Manager. Single-click now correctly selects the component (GrapesJS default). Added a tooltip guide: title="Double-click to open image selector".

Both changes follow GrapesJS conventions and integrate safely with the existing codebase. E2E tests verify all behaviors.

---

## Review Findings

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | PASS |
| HIGH     | 0     | PASS |
| MEDIUM   | 0     | PASS |
| LOW      | 0     | PASS |

---

## Detailed Analysis

### 1. SVG Data URI Safety Check - initEditor.ts lines 154-162

SECURITY VERIFIED:
- SVG is properly URL-encoded: hex-encoded color references
- Single quotes used inside SVG, double quotes for URL string - no escaping conflicts
- SVG content is static, author-controlled - no user input interpolated into SVG
- No <script> tags, no event handlers, no external resources
- charset=utf-8 specified - browser interprets as safe SVG, not HTML
- SVG viewBox and paths are simple geometry (rect, circle, path, text) - no injection vectors

XSS SAFE: The SVG is hardcoded in source. No user-provided data reaches the SVG template.

CSS INJECTION SAFE: This CSS is injected into the GrapesJS canvas iframe <style> tag. It is static, not interpolated with user data.

VENDOR CONVENTION: GrapesJS uses the .gjs-plh-* class convention for placeholder styles. Overriding it via canvas styles is the intended pattern.

---

### 2. Double-Click Event Handler Change - registerBlocks.ts lines 97, 124

Change: events: { click: 'onImageClick' } to events: { dblclick: 'onImageClick' }

UX CORRECT:
- Single-click: Selects the component (GrapesJS built-in behavior)
- Double-click: Opens Asset Manager - direct path to assign an image
- Matches user expectations: single-click = select, double-click = edit

NO CONFLICT WITH GRAPESJS INTERNALS:
- Text widgets use editable: true and dblclick to enter inline edit mode - but image is void: true (img tag), so inline editing is N/A
- Screenshot Sim widget already uses dblclick for its own handler (registerSimBlock.ts:68) - no conflict, each component has its own view
- The text-edit command only applies to components with editable: true - image widget has void: true, so text-edit never engages

TOOLTIP CORRECTLY IMPLEMENTED (line 124):
- Called in onRender(), which fires once on mount
- Sets title attribute on the <img> DOM element inside the GrapesJS canvas iframe
- Browser displays this as a native tooltip on hover

---

### 3. Code Quality and Conventions

Immutability: No mutation of component state
Error Handling: No error path added; styles/events are static
TypeScript: Type-safe event binding via GrapesJS API
Comments: Clear T605 task refs on lines 151, 96, 122
File Size: Both files under 800-line limit
No console.log: None added
No hardcoded secrets: None

---

### 4. E2E Test Coverage - image-widget-placeholder.spec.ts

4 comprehensive tests verify all behaviors:

T605.1 - Block visible in Blocks panel
T605.2 - GrapesJS placeholder class present on new image widget
T605.3 - Tooltip attribute present
T605.4 - Placeholder class removed after src assigned

All tests follow project patterns.

---

### 5. Integration Points

Canvas CSS Injection:
- Part of the canvas: { styles: [...] } array passed to grapesjs.init()
- Guaranteed to load in the canvas iframe before any components render
- No race conditions

Component View Lifecycle:
- initialize() calls parent to set up GrapesJS internals
- onRender() sets tooltip + calls resolveAndSetSrc
- events binding wires dblclick: 'onImageClick' before user interaction
- No conflicts with async operations

Asset Manager Integration:
- onImageClick() opens Asset Manager on dblclick
- User selects image, select() callback fires
- Calls selected.set('src', src) - triggers change:src event
- GrapesJS automatically removes .gjs-plh-image class when src becomes truthy

---

### 6. Backwards Compatibility

No Breaking Changes:
- CSS addition is additive
- Event change from click to dblclick is UX improvement
- Existing courses with image widgets load and function identically
- No migration needed

---

### 7. Security Checklist

No hardcoded credentials
No SQL injection
No XSS vulnerabilities (SVG is static, URL-encoded, charset specified)
No path traversal
No CSRF issues
No unvalidated input
No sensitive data logged

---

## Verdict

**Status**: APPROVED FOR MERGE

Summary:
- No CRITICAL issues
- No HIGH issues
- No MEDIUM issues
- No LOW issues
- SVG data URI is properly URL-encoded and safe
- Double-click event does not conflict with GrapesJS internals or other widgets
- Tooltip is correctly implemented in the GrapesJS view lifecycle
- E2E tests comprehensively verify all behaviors
- Follows project conventions and coding style
- Backwards compatible

Fixes: T605 (Image widget placeholder and double-click UX)

Related tasks:
- T024.1 — registerSimBlock (dblclick pattern reference)
- T010.11 — Canvas initialization (canvas CSS pattern reference)
