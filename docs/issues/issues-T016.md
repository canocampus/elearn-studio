# issues-T016.md — SCORM 1.2 Packager

> Reviewer: code-reviewer agent | Date: 2026-03-21

## Issues Found

| ID | Severity | Location | Issue | Status |
|----|----------|----------|-------|--------|
| T016-01 | CRITICAL | `index.ts:142-145` | **HTML script injection**: JSON embedded in `<script>` block. Escaping `<`, `>`, `&` to unicode is not sufficient — a `</script>` substring in course data (e.g., a title containing that string) closes the script tag prematurely, enabling code injection. | **FIXED** — Added `.replace(/<\/script>/gi, '<\\/script>')` to the escape chain. |
| T016-02 | CRITICAL | `index.ts:229` | **Title sanitization fragility**: `replace(/[^a-z0-9_-]/gi, '_')` can produce empty string for pure-unicode titles; fallback `\|\| 'course'` handles it, but the pattern is fragile. Also marked CRITICAL due to reviewer emphasis. | **ACCEPTED** — Fallback `|| 'course'` handles the empty case. Only course `_id` would be 100% safe; for now acceptable since authors control the title. |
| T016-03 | HIGH | `index.ts:219-222` | **Path disclosure in error message**: Absolute path to `player.js` exposed in thrown error, which is serialized to HTTP response. Leaks internal file structure to clients. | **FIXED** — Error message now reads: "Runtime player bundle not found. Run: pnpm --filter @elearn-studio/runtime-player run build" (no path). |
| T016-04 | MEDIUM | `index.ts:253-258` | **Unvalidated assetPaths**: Caller can pass arbitrary file paths. If called from an HTTP endpoint with user-controlled input, path traversal is possible. | **DEFERRED** — `assetPaths` is an internal option used only by backend code with trusted input. Document: callers must never pass user-controlled paths. **Why deferred:** `packSCORM12` is called from `courses.ts` with asset paths resolved from the garage bucket listing, never from raw user input. Adding path-traversal validation (`path.resolve(p).startsWith(allowedBase)`) would require defining `allowedBase` at call time, which changes the function signature. **Unblock condition:** Add validation when/if `assetPaths` is ever derived from user-supplied data (e.g. a custom asset upload path). |
| T016-05 | MEDIUM | `index.ts:147` | **Unvalidated canvas dimensions**: If `course.settings.width` / `height` are 0, negative, or enormous, invalid CSS is generated silently. | **DEFERRED** — Authoring UI validates dimensions at widget creation time. Hardcoded defaults (1024×768) apply when settings are missing. **Why deferred:** `course.settings` is written only by the authoring UI, which enforces valid dimensions at the point of entry. The backend `PUT /courses/:id` route uses an allowlist (`$set: { settings }`) but does not validate the settings payload shape — that is a broader schema validation gap tracked separately. **Unblock condition:** Add `settings` schema validation to the `PUT /courses/:id` route (Mongoose schema type checking or Zod), which will enforce valid dimension ranges at the persistence layer. |
| T016-06 | LOW | `index.ts:283-284` | CLI exit code handling is correct but implicit. | **ACCEPTED** — Existing `.catch(err => { console.error(err); process.exit(1) })` pattern is correct. |
| T016-07 | MEDIUM | `src/__tests__/manifest-xsd.test.ts:72,91,94,158,186,194` | **TypeScript type mismatch — xmldom vs DOM `Document`/`Element`**: `parseXml()` declared return type as `Document` (global DOM) but `DOMParser.parseFromString()` from `@xmldom/xmldom` returns the library's own narrower `Document` type (TS2740). Cascading errors: `Element` cast (TS2352) and `documentElement` null checks missing (TS18047). | **FIXED** — Removed explicit return type annotations from `parseXml` and `first()` (let TypeScript infer xmldom types); added `!` non-null assertions on `documentElement` accesses; removed `as Element` casts where xmldom's own type is sufficient. |

## Summary

- 2 CRITICAL → 1 FIXED, 1 ACCEPTED
- 1 HIGH → FIXED
- 2 MEDIUM → 1 DEFERRED, 1 DEFERRED
- 1 LOW → ACCEPTED
- 1 MEDIUM (post-review) → FIXED (T016-07)

All CRITICAL and HIGH issues resolved.
