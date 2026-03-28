---
name: elearn-e2e-qa
description: >
  Use this skill whenever writing, reviewing, or deciding between test types for
  eLearn Studio. Covers when to use Playwright E2E vs Vitest unit tests, the
  established patterns in the existing e2e/ suite, critical coverage gaps that
  must be filled, and the mandatory E2E gate before any UI task can be marked done.
  Always read this skill before writing any test or closing any task that involves
  UI behavior, GrapesJS, slide navigation, asset upload, or the runtime player.
---

# eLearn Studio — E2E QA Testing Skill

## The Core Rule: Test at the Right Level

Before writing any test, answer:

> **"Could this bug exist even if all unit tests pass?"**

If YES → write a Playwright E2E test.
If NO → write a Vitest unit test.

### Use Playwright E2E when testing:
- Any interaction inside the GrapesJS canvas iframe
- Drag-and-drop (widget placement, slide reordering, resize handles)
- Widget property persistence across slide navigation
- Autosave timing (too early = data loss; too late = stale state)
- Asset upload → display in canvas (involves iframe, Garage, presigned URLs)
- SCORM export → downloadable ZIP with correct structure
- Authentication flows and token refresh
- Runtime player rendering a published course
- Any flow that crosses iframe / process / network boundaries

### Use Vitest unit tests when testing:
- Pure functions: converters, evaluators, score calculators
- API route handlers (supertest + mocked MongoDB)
- Zustand store actions and state transitions
- SCORM manifest XML generation
- Data type conversions and validators

---

## Existing Infrastructure — Use It, Don't Rebuild

The following is already implemented and working. Use these patterns consistently.

### Accessing the GrapesJS canvas

```typescript
// EditorPage.canvasFrame() — use this, never page.frameLocator() directly
editorPage.canvasFrame().locator('[data-gjs-type="rectangle"]')

// Editor ready signal — editor.on('load') sets data-editor-ready="true" on #gjs
await editorPage.waitForCanvas()  // waits for iframe.gjs-frame to be visible

// Programmatic component addition — preferred over drag for isolation tests
await editorPage.addComponentViaEditor('question-mc')
// Uses window.__elearn_editor (exposed in EditorCanvas.tsx in DEV builds)
```

### Drag a block from Block Manager to canvas

```typescript
// Use the existing EditorPage method — it handles iframe offset calculation
await editorPage.dragBlockToCanvas('Rectangle', 350, 250)
// Internally uses page.mouse for absolute coordinates + networkidle wait
```

### Selecting components inside the iframe

```typescript
// Always via canvasComponent() — routes through frameLocator('iframe.gjs-frame')
const mc = editorPage.canvasComponent('[data-gjs-type="question-mc"]')
await expect(mc).toBeVisible({ timeout: 15_000 })

// GrapesJS resize handles are in the HOST page DOM, not inside the iframe
const resizer = page.locator('.gjs-resizer-h-br')  // host page, not canvasComponent()
```

### Auth — storageState is pre-baked

```typescript
// globalSetup creates a user and saves storageState to .auth/state.json
// All tests in the 'chromium' project start already logged in
// auth.spec.ts runs in the 'setup' project (no storageState) for login flow tests

// For direct API calls in tests (token is in memory only, not in storageState):
const loginRes = await page.request.post(`${API_BASE}/auth/login`, {
  data: { email: process.env.E2E_TEST_USER_EMAIL, password: process.env.E2E_TEST_USER_PASSWORD }
})
const { accessToken } = (await loginRes.json()).data
```

### Fixtures

```typescript
// Always import from '../fixtures', not from '@playwright/test'
import { test, expect } from '../fixtures'
// Provides: { editorPage, page } — editorPage is pre-navigated to '/' and ready
```

---

## Known Failure Modes — Permanent Regression Tests Required

These bugs were caught manually. Every one must have a Playwright regression test
that stays in the suite forever. The test must FAIL if the bug is reintroduced.

### FM-01 — Widget drops to top-left corner ✅ COVERED
`grapesjs-integration.spec.ts` → "dropped widgets land at the correct coordinates"
and "widgets do not jump to (20, 20) on drop"

### FM-02 — Widget cannot be dragged after creation ⚠️ PARTIAL
`grapesjs-integration.spec.ts` covers resize. Drag within canvas is not yet tested.
**Required:** test that drags a widget from one position to another and verifies
the position actually changed.

### FM-03 — Widget cannot be resized ✅ COVERED
`grapesjs-integration.spec.ts` → "widgets are resizable via GrapesJS anchors"

### FM-04 — Image widget does not display uploaded image ✅ COVERED
`image-upload.spec.ts` — comprehensive coverage including presigned URL verification

### FM-05 — Widget properties reset to defaults on slide navigation ❌ NOT COVERED
**This is the most critical gap. Must be written immediately.**
Pattern:
```typescript
test('FM-05 — widget properties persist across slide navigation', async ({ editorPage, page }) => {
  // 1. Add widget to slide 1
  await editorPage.addComponentViaEditor('question-mc')
  await page.waitForTimeout(300)

  // 2. Edit a property via the Props panel
  await editorPage.propsTab.click()
  const textarea = page.locator('[data-testid="question-properties-panel"] textarea').first()
  await textarea.fill('Regression test question text')
  await textarea.press('Tab')  // trigger onChange

  // 3. Wait for autosave (debounce = 2s; wait 3s to be safe)
  await page.waitForTimeout(3000)

  // 4. Add slide 2 and navigate to it
  await editorPage.addSlide()
  const slides = page.locator('[data-testid="slide-item"]')
  await slides.last().click()
  await page.waitForTimeout(1000)

  // 5. Navigate back to slide 1
  await slides.first().click()
  await editorPage.waitForCanvas()
  await page.waitForTimeout(500)

  // 6. Select the widget and verify property is preserved
  await editorPage.addComponentViaEditor  // re-select existing (or use API to get selected)
  await editorPage.propsTab.click()
  const restoredTextarea = page.locator('[data-testid="question-properties-panel"] textarea').first()
  await expect(restoredTextarea).toHaveValue('Regression test question text', { timeout: 5_000 })
})
```
> If this test fails: the fix is to call `editor.store()` synchronously in the
> slide-switch handler BEFORE loading the new slide. See Storage Manager notes in CLAUDE.md.

---

## Critical Coverage Gaps — Write These Tests

These flows have zero or inadequate E2E coverage. Add them in this priority order:

### GAP-01 — FM-05 regression (slide property persistence) ❌
File: `e2e/tests/grapesjs-integration.spec.ts`
See FM-05 pattern above.

### GAP-02 — Action sequence save and survive reload ❌
File: `e2e/tests/action-sequence.spec.ts`
Current state: only checks tab visibility. Must be replaced with real save/load tests.

```typescript
test('action sequence persists after page reload', async ({ editorPage, page }) => {
  // 1. Add a slide and a button widget
  await editorPage.addSlide()
  await editorPage.waitForCanvas()
  await editorPage.addComponentViaEditor('button')
  await page.waitForTimeout(300)

  // 2. Open Actions tab and add a Navigate action
  await editorPage.actionsTab.click()
  const actionsPanel = page.locator('[data-testid="actions-panel"]')
  await actionsPanel.locator('button', { hasText: 'Add Action' }).click()
  // ... configure action via the UI

  // 3. Save and reload
  await page.waitForTimeout(3000)  // autosave
  await page.reload()
  await editorPage.waitForReady()

  // 4. Re-select the widget and verify action is still there
  await editorPage.actionsTab.click()
  await expect(actionsPanel).toContainText('Navigate')
})
```

### GAP-03 — Widget state survives full page reload ❌
File: new `e2e/tests/persistence.spec.ts`

```typescript
test('widgets on a slide survive page reload', async ({ editorPage, page }) => {
  await editorPage.addSlide()
  await editorPage.waitForCanvas()
  await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
  await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })

  // Wait for autosave then reload
  await page.waitForTimeout(3000)
  await page.reload()
  await editorPage.waitForReady()

  // Navigate back to the slide and verify widget is still there
  const slides = page.locator('[data-testid="slide-item"]')
  await slides.last().click()
  await editorPage.waitForCanvas()
  await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })
})
```

### GAP-04 — SCORM ZIP content verification ⚠️ PARTIAL
File: `e2e/tests/scorm-export.spec.ts`
Current: verifies download starts and filename ends in `.zip`. Missing: ZIP content.

```typescript
import * as AdmZip from 'adm-zip'  // or unzipper

test('SCORM ZIP contains imsmanifest.xml and index_lms.html', async ({ editorPage, page }) => {
  await editorPage.openPublishDialog()
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
  await editorPage.publishConfirmButton.click()

  const download = await downloadPromise
  const buffer = await download.createReadStream().then(stream =>
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', c => chunks.push(Buffer.from(c)))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  )

  const zip = new AdmZip(buffer)
  const entries = zip.getEntries().map(e => e.entryName)
  expect(entries).toContain('imsmanifest.xml')
  expect(entries).toContain('index_lms.html')
  expect(entries.some(e => e.startsWith('assets/'))).toBe(true)
})
```

### GAP-05 — Auth token refresh on page reload ❌
File: `e2e/tests/auth.spec.ts`

```typescript
test('session is restored after page reload (F5)', async ({ page }) => {
  // Start from authenticated state (storageState)
  await page.goto('/')
  const editorPage = new EditorPage(page)
  await editorPage.waitForReady()

  // Reload — access token is in memory only, refresh token is in httpOnly cookie
  await page.reload()

  // Should NOT redirect to login — refresh token restores session
  await expect(editorPage.publishScormButton).toBeVisible({ timeout: 20_000 })
  await expect(page.url()).not.toContain('/login')
})
```

### GAP-06 — Autosave race condition (FLOW-07) ❌
File: `e2e/tests/persistence.spec.ts`

```typescript
test('switching slides before autosave debounce does not lose widget', async ({ editorPage, page }) => {
  await editorPage.addSlide()
  await editorPage.waitForCanvas()

  // Add widget
  await editorPage.dragBlockToCanvas('Rectangle', 300, 200)
  await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 15_000 })

  // Immediately switch slides (before 2s debounce fires)
  await editorPage.addSlide()
  const slides = page.locator('[data-testid="slide-item"]')
  await slides.last().click()  // switch away IMMEDIATELY
  await page.waitForTimeout(100)  // much less than 2s debounce

  // Wait for autosave to have fired (either from debounce or from slide-switch handler)
  await page.waitForTimeout(3000)

  // Go back to first slide
  await slides.first().click()
  await editorPage.waitForCanvas()

  // Widget must be there despite the fast switch
  await expect(editorPage.canvasComponent('[data-gjs-type="rectangle"]')).toBeVisible({ timeout: 10_000 })
})
```

### GAP-07 — Question property editing via Props panel ❌
File: `e2e/tests/question-widget.spec.ts`
Add to existing `test.describe('Question Widget: Multiple Choice')`:

```typescript
test('T601.2 — MC question text can be edited and is reflected in canvas', async ({ editorPage, page }) => {
  await editorPage.addComponentViaEditor('question-mc')
  await page.waitForTimeout(300)
  await editorPage.propsTab.click()

  const panel = page.locator('[data-testid="question-properties-panel"]')
  const textarea = panel.locator('textarea').first()
  await textarea.fill('Updated question text via E2E')
  await textarea.press('Tab')
  await page.waitForTimeout(500)

  // Verify canvas renders the updated text
  const mc = editorPage.canvasComponent('[data-gjs-type="question-mc"]')
  await expect(mc).toContainText('Updated question text via E2E', { timeout: 5_000 })
})
```

### GAP-08 — Widget draggable within canvas (FM-02 complete) ❌
File: `e2e/tests/grapesjs-integration.spec.ts`

```typescript
test('FM-02 — widgets can be dragged to a new position within the canvas', async ({ editorPage, page }) => {
  await editorPage.dragBlockToCanvas('Rectangle', 100, 100)
  const rect = editorPage.canvasComponent('[data-gjs-type="rectangle"]').first()
  await expect(rect).toBeVisible({ timeout: 15_000 })

  const initialBox = await rect.boundingBox()
  if (!initialBox) throw new Error('Initial bounding box null')

  // Select widget first
  await rect.click()
  await page.waitForTimeout(300)

  // Drag within canvas via page.mouse (uses absolute coordinates = iframe offset + widget center)
  const iframeBox = await editorPage.getCanvasIframeBox()
  if (!iframeBox) throw new Error('Canvas iframe box null')

  const startX = iframeBox.x + initialBox.x + initialBox.width / 2
  const startY = iframeBox.y + initialBox.y + initialBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 200, startY + 150, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)

  const finalBox = await rect.boundingBox()
  if (!finalBox) throw new Error('Final bounding box null')

  // Position must have changed significantly
  expect(Math.abs(finalBox.x - initialBox.x)).toBeGreaterThan(50)
})
```

---

## Mandatory E2E Gate — Before Closing Any UI Task

**Every task that touches GrapesJS, widgets, slides, assets, or the runtime player
must have at least one new or updated Playwright test before it can be marked `[x]`.**

Add this as the second-to-last step in every affected block (before the Reviewer task):

```markdown
- [ ] TXX.N-1 — Write/update Playwright E2E test covering the primary user interaction
  of this block; test must fail if the behavior regresses; add to appropriate spec file
- [ ] TXX.N — Refine the generated code
- [ ] TXX.N+1 — A reviewer will generate docs/issues/issues-TXX.md ...
```

### Which spec file to use

| Behavior being tested | Spec file |
|---|---|
| GrapesJS drag, drop, resize, iframe interaction | `grapesjs-integration.spec.ts` |
| Widget property editing, props panel sync | `question-widget.spec.ts` |
| Slide add/delete/reorder/rename | `authoring-ui-layer.spec.ts` |
| State persistence after reload or slide switch | `persistence.spec.ts` (new) |
| Action sequence save/load/reload | `action-sequence.spec.ts` |
| Image upload, Asset Manager, presigned URL | `image-upload.spec.ts` |
| SCORM export and ZIP content | `scorm-export.spec.ts` |
| Auth login/logout/refresh | `auth.spec.ts` |
| Course CRUD | `course-crud.spec.ts` |

---

## Test Quality Rules

### Isolation
- Every `test.beforeEach` that modifies state must leave the app in a clean state
- Never rely on widgets/slides left by a previous test
- Use `addComponentViaEditor()` for unit-like isolation; `dragBlockToCanvas()` when
  testing the drag behavior itself

### Timing
- `page.waitForTimeout()` is acceptable ONLY for:
  - autosave debounce windows (explicitly comment the duration: `// 2s debounce + 1s buffer`)
  - GrapesJS internal state propagation after UI events (max 500ms)
- Always prefer `waitFor({ state: 'visible' })` over fixed timeouts for UI elements

### Assertions
- Assert the DOM state in the canvas (via `canvasComponent()`), not just API calls
- For persistence tests: always reload or navigate away and come back — never just wait
- For autosave tests: use `page.waitForResponse()` to confirm the PATCH request was made

### Selectors — existing conventions
```typescript
// Slide items
page.locator('[data-testid="slide-item"]')
page.locator('[data-testid="slide-item"]').nth(0)

// Canvas components (inside GrapesJS iframe)
editorPage.canvasComponent('[data-gjs-type="question-mc"]')
editorPage.canvasFrame().locator('[data-gjs-type="button"]')

// Resize handles (HOST page, not iframe)
page.locator('.gjs-resizer-h-br')  // bottom-right
page.locator('.gjs-resizer-h-bl')  // bottom-left

// GrapesJS managed panels (HOST page)
page.locator('#gjs-block-manager')
page.locator('#gjs-layer-manager')
page.locator('#gjs-style-manager')

// Question properties panel
page.locator('[data-testid="question-properties-panel"]')

// Window editor reference (for programmatic operations)
// window.__elearn_editor — set in EditorCanvas.tsx, available in DEV builds
```

---

## Visual Regression

For critical components, always add a screenshot comparison step:

```typescript
// At the end of tests covering stable UI (not dynamic flow tests)
await expect(page).toHaveScreenshot('editor-with-mc-widget.png', {
  maxDiffPixels: 100  // tolerance for antialiasing
})
```

Components that MUST have visual regression coverage:
- Editor loaded with empty canvas
- Canvas with MC widget selected (Props panel open)
- Publish dialog open
- Login page

To update the baseline snapshots:
```bash
pnpm playwright test --update-snapshots
```
Snapshots are stored in: `e2e/snapshots/` — committed to git.

---

## Test Tags — Traceability

Every test must have a tag indicating its criticality:

```typescript
test('@smoke — editor loads correctly', ...)      // critical flows, run on every PR
test('@regression — FM-05 widget persistence', ...)  // specific fixed bugs
test('@integration — SCORM ZIP content', ...)     // tests requiring the full stack
```

In CI, `@smoke` tests always run. `@regression` and `@integration` run on merge to main:

```typescript
// playwright.config.ts — run only smoke tests in CI for faster feedback
grep: process.env.CI_FAST ? /@smoke/ : undefined
```

---

## API Mocking with route.fulfill()

When a test verifies UI behaviour that does not depend on real data,
mocking the API makes the test faster and more stable:

```typescript
// Mock a save failure to verify the error toast (related to FM-05 gap)
test('@regression — save failure shows error toast', async ({ page, editorPage }) => {
  // Intercept the autosave PATCH call and force a server error
  await page.route('**/courses/*/slides/*', route => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
  })

  await editorPage.addSlide()
  await editorPage.addComponentViaEditor('rectangle')
  await page.waitForTimeout(3000)  // wait for autosave attempt

  // Verify the error toast appears
  await expect(page.locator('[role="alert"]')).toContainText('Save failed', { timeout: 5_000 })
})

// Mock login for auth tests without depending on the real backend
await page.route('**/auth/login', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: { accessToken: 'fake-token-for-test' } })
  })
})
```

Rule: use `route.fulfill()` when the test verifies UI behaviour.
Do NOT use it when the test verifies real backend integration.

---

## playwright codegen as a Working Tool

When unsure about the correct selectors for a new flow:

```bash
cd e2e
npx playwright codegen http://localhost:3000
```

The codegen output is raw recorded code. NEVER commit it directly.
Correct process:
1. Use codegen to capture the sequence of actions
2. Clean up: replace fragile selectors with `data-testid` or `getByRole`
3. Refactor into a Page Object if the sequence is reused across tests
4. Add meaningful assertions (codegen only records actions, it does not verify state)
5. Tag with `@smoke`, `@regression`, or `@integration`

---

## Checklist Before Marking Any UI Task Complete

- [ ] Is there a Playwright test covering the primary user interaction?
- [ ] Does the test assert DOM/canvas state, not just API responses?
- [ ] If state persistence is involved: does the test navigate away and back?
- [ ] If autosave is involved: does the test wait for the PATCH network request?
- [ ] Does the test use the existing `editorPage` fixture and Page Object methods?
- [ ] Does the test avoid `page.waitForTimeout()` except for documented debounce windows?
- [ ] Is the test tagged with `@smoke`, `@regression`, or `@integration`?
- [ ] Is the test added to the correct spec file per the table above?
- [ ] Does the test FAIL when the behaviour being guarded against is reintroduced?
- [ ] Do all GAP-01 through GAP-08 tests exist before Phase 2.5 is considered complete?
