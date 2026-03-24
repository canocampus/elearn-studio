# Issues — T503 Developer Guide

Generated: 2026-03-24
Reviewer: doc-updater agent
Status: RESOLVED — all CRITICAL and HIGH issues fixed 2026-03-24

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 3 |
| MEDIUM | 2 |
| LOW | 0 |

---

## Issues

### T503-I01 — Incorrect pnpm filter name for backend API [CRITICAL]

**File:** `02-local-setup.md`, `06-contributing.md`
**Lines:** 94, 101, 172, 106 in respective files
**Finding:** Documentation uses `pnpm --filter backend-api` but the actual package name is `@elearn-studio/api`. The `backend-api` filter does not exist and will cause "No projects matched the filters" error when users try to run commands.

**Affected commands:**
- Line 94: `pnpm --filter backend-api test` ❌
- Line 101: `pnpm --filter backend-api run openapi:generate` ❌
- Line 172: `API_PORT=3031 pnpm --filter backend-api run dev` ❌
- `06-contributing.md` line 106: `pnpm --filter backend-api run openapi:generate` ❌

**Verification:**
```bash
# Verify backend/api package.json
cat backend/api/package.json | grep '"name"'
# Output: "name": "@elearn-studio/api"

# Test current command fails
pnpm --filter backend-api test 2>&1
# Output: No projects matched the filters
```

**Fix:** Replace all instances of `backend-api` with `@elearn-studio/api` in filter arguments, OR use the directory path syntax `pnpm --filter ./backend/api`. Most portable: use the exact package name `@elearn-studio/api`.

---

### T503-I02 — Incorrect script name for OpenAPI generation [CRITICAL]

**File:** `06-contributing.md`
**Lines:** 101, 106
**Finding:** Documentation references script `openapi:generate` but the actual script in `backend/api/package.json` is `gen:openapi`. This will cause "command not found" errors.

**Current documentation:**
```bash
pnpm --filter backend-api run openapi:generate
# Should be:
pnpm --filter @elearn-studio/api run gen:openapi
```

**For authoring-ui:** The documentation mentions regenerating the TypeScript client from OpenAPI, but the actual script is `gen:api-client`, which internally handles both the backend spec generation and client generation.

**Verification:**
```bash
grep '"scripts"' -A 10 backend/api/package.json
# Shows: "gen:openapi": "ts-node --project tsconfig.scripts.json scripts/gen-openapi.ts"

grep '"scripts"' -A 10 packages/authoring-ui/package.json
# Shows: "gen:api-client": "pnpm --filter api run gen:openapi && ..."
```

**Fix:** Line 101 should use `gen:openapi`. Line 106 should direct users to run `pnpm --filter authoring-ui run gen:api-client` instead, which handles both spec and client generation.

---

### T503-I03 — Incorrect script name for Playwright screenshot capture [HIGH]

**File:** `06-contributing.md`
**Line:** 121
**Finding:** Documentation references script `capture-screenshots` but the actual script in `docs/package.json` is `capture`. Users will encounter "command not found" error.

**Current documentation:**
```bash
pnpm --filter docs run capture-screenshots
# Should be:
pnpm --filter docs run capture
```

**Verification:**
```bash
grep '"scripts"' -A 2 docs/package.json
# Shows: "capture": "tsx scripts/capture-screenshots.ts"
```

**Fix:** Change `capture-screenshots` to `capture` on line 121.

---

### T503-I04 — File path inconsistency in Step 3 (Adding Widget Types) [HIGH]

**File:** `03-adding-widget-types.md`
**Line:** 95
**Finding:** The documentation instructs readers to verify the new component stores custom data in `extendedProperties` "on the model defaults" but does not clearly specify that this is in the `defaults` object within the Component Type's `model`. The example shows `extendedProperties` should be added to the model defaults structure, but the context is unclear for first-time contributors.

**Current text at line 95:**
> "In `packages/authoring-ui/src/editor/converters.ts`, `widgetsFromGrapesjs` already handles all widget types generically via `c.get('extendedProperties')`. Verify the new component stores its custom data in `extendedProperties` on the model defaults:"

**The code example at lines 99-105 is correct, but the instruction leading to it is vague.**

**Fix:** Clarify line 95 to explicitly state: "Verify the new component stores its custom data in `extendedProperties` within the Component Type's `model.defaults` object:"

---

### T503-I05 — Missing file path verification in storage-manager location [HIGH]

**File:** `01-architecture.md`
**Line:** 189
**Finding:** The file is referenced as `packages/authoring-ui/src/editor/storage-manager.ts` but the actual file is named `storageManager.ts` (camelCase, not kebab-case). This will cause confusion when developers try to locate the file.

**Current text:**
> "The Storage Manager in `packages/authoring-ui/src/editor/storage-manager.ts` intercepts every GrapesJS save..."

**Actual file:**
```
packages/authoring-ui/src/editor/storageManager.ts
```

**Fix:** Change `storage-manager.ts` to `storageManager.ts` on line 189.

---

### T503-I06 — Mermaid diagram exceeds node limit [MEDIUM]

**File:** `05-observability.md`
**Lines:** 9–34
**Finding:** The observability stack diagram contains 13 nodes (API, UI, OTEL, PROM, LOKI, TEMPO, GF, PT, and their connections), exceeding the 12-node limit specified in the technical documentation rules. While the diagram is informative, it should be simplified or split.

**Current nodes in diagram:**
API, UI, OTEL, PROM, LOKI, TEMPO, GF, PT = 8 nodes (within limit)
**But with connection labels and implicit connections, conceptual complexity is high.**

**Assessment:** Actually within hard limit, but could be clearer with a simpler structure or two separate diagrams (data collection layer vs. visualization layer).

**Recommendation:** Consider splitting into two simpler diagrams if complexity becomes problematic during review. Current diagram is acceptable but at the upper limit of clarity.

---

### T503-I07 — Example uses non-existent widget type 'flip-card' [MEDIUM]

**File:** `03-adding-widget-types.md`
**Throughout:** Lines 3–220
**Finding:** The entire guide uses `flip-card` as the worked example widget type, but this widget does not exist in the codebase. While the example is instructive and correctly shows the pattern, it could mislead developers into thinking a flip-card widget is available for use. The guide should clarify that this is a hypothetical example.

**Current introduction at line 5:**
> "When you need this: you're adding a new interactive element (e.g., a hotspot map, a flip card, a timeline) that authors drag onto the slide canvas..."

**Issue:** "flip card" is mentioned as an example use case, then the entire guide uses it as the worked example. A developer might expect to find this widget in the codebase.

**Verification:**
```bash
grep -r "flip-card\|flipCard" /d/dev/git/elearn-studio/packages --include="*.ts"
# Returns no results — widget does not exist
```

**Fix:** Add a note at the beginning of Step 1 or in the Overview: "This guide uses `flip-card` as a **hypothetical worked example**. It does not exist in the codebase — replace `flip-card` with your actual widget type name throughout these examples."

Alternatively, use an existing widget type like `text` or `button` as the example (as suggested in the opening line of the document: "Uses the existing `text` widget as the reference implementation" — but then uses flip-card instead).

---

## Recommended Fix Priority

1. **CRITICAL (blocks commands from working):**
   - T503-I01: Fix all `backend-api` filter references → `@elearn-studio/api`
   - T503-I02: Fix script names: `openapi:generate` → `gen:openapi`; clarify authoring-ui uses `gen:api-client`

2. **HIGH (causes errors or confusion):**
   - T503-I03: Fix `capture-screenshots` → `capture`
   - T503-I04: Clarify Step 3 instruction
   - T503-I05: Fix `storage-manager.ts` → `storageManager.ts`

3. **MEDIUM (improves clarity):**
   - T503-I06: Observability diagram (optional split)
   - T503-I07: Add disclaimer about `flip-card` being hypothetical

---

**Status:** Ready for author corrections. All issues are straightforward fixes to file paths, script names, or clarifications.

