# Code Review Report — T706: initEditor Position Guard Tests

## Summary

The T706 test suite validates the component:add event handler in initEditor.ts. The tests verify that components added to the GrapesJS canvas receive position: absolute styling and are marked draggable/resizable. However, the test suite has critical gaps in coverage that could allow position-related bugs in production.

## CRITICAL Findings

### [CRITICAL] Missing Test Coverage: Alternative Position Values

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:121-164

Issue: Tests only verify position: absolute (T706.1) and empty/undefined (T706.2, T706.2b). CSS has other values: relative, fixed, sticky, static. The guard logic assumes any falsy value means "no position set", but what if a component is saved with position: relative or position: fixed? The guard will skip setting absolute positioning.

Current guard (line 197 of initEditor.ts):
  if (!component.getStyle('position')) {
    component.addStyle({ position: 'absolute' })
  }

This fails if getStyle returns 'relative' or 'fixed' — those are truthy, so addStyle is NOT called, violating the ToolBook absolute layout model.

Real-world scenario: A component is loaded from JSON with position:relative. On reload, GrapesJS hydrates it with that value. The guard sees truthy and skips enforcement.

Recommendation:
- Add tests for position: relative, fixed, sticky
- Consider refactoring guard to explicitly check for absolute:
    if (component.getStyle('position') !== 'absolute') {
      component.addStyle({ position: 'absolute' })
    }
- Document the business rule: should ALL components be absolute, or only fresh drops?

### [CRITICAL] GrapesJS API Mocking Doesn't Match Type Contract

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:121-210

Issue: Tests mock getStyle('position') as returning simple strings ('absolute', ''). GrapesJS types define getStyle() as returning Record<string, string | string[]>. The implementation trusts a string return via !component.getStyle('position'), but real GrapesJS might return object types in edge cases.

The tests never verify this contract matches actual GrapesJS. If getStyle('position') returns an object by mistake, or if called wrong, falsy checks could fail.

Recommendation:
- Verify actual GrapesJS return type in reference test
- Mock to match documented return type
- Add tests for edge cases: property doesn't exist, returns undefined vs null vs {}
- Document the expected API contract in test comments

## HIGH Findings

### [HIGH] Autosave Handler Not Tested Separately

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:110-117

Issue: component:add is registered twice:
- Line 190-200 of initEditor.ts: Position guard
- Line 241: Autosave trigger

Test helper getComponentAddHandler() invokes both together via forEach, but there is NO test verifying:
1. The autosave handler is registered
2. Autosave doesn't interfere with position guard
3. Autosave correctly captures storage context (lines 211-217)
4. Handler order doesn't cause issues

If autosave throws, modifies the component, or fails to debounce, position guard tests wouldn't catch it.

Recommendation:
- Add explicit test: "autosave handler is registered on component:add"
- Add test that verifies autosave is triggered without errors
- Test handler order and state isolation
- Verify storage context snapshot logic avoids race conditions

### [HIGH] Test T706.4 Over-Clever Parameterized Mock

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:194-210

Issue: The getStyle mock branches on property parameter:
  getStyle: vi.fn((prop: string) => prop === 'position' ? 'absolute' : '')

This tests implementation details rather than API contract. If code later adds:
  const top = component.getStyle('top')

The test still passes even though mock logic doesn't match real GrapesJS.

Recommendation:
- Simplify mock to only return what guard needs: getStyle: vi.fn().mockReturnValue('absolute')
- Create separate test cases for different scenarios
- Document expected GrapesJS API contract clearly

## MEDIUM Findings

### [MEDIUM] Missing Handler Registration Verification

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:110-117

Issue: getComponentAddHandler() throws error if handler missing (line 113), but this is a setup guard, not an assertion. No explicit test verifies initEditor() actually registers the handler. If registration was removed, all tests fail at setup with unclear error.

Recommendation:
- Add explicit test: initEditor registers component:add handler
- Verify handlers.length >= 2 (position guard + autosave)

### [MEDIUM] No Verification of Call Order

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:121-190

Issue: Tests verify set() and addStyle() are called with correct args, but not the call order. Theoretically, if addStyle() runs first then set() overwrites position, guard could fail. Tests use toHaveBeenCalledWith() which checks "happened", not "when".

Recommendation:
- Verify call order: expect(component.set).toHaveBeenCalledBefore(component.addStyle)
- Or verify execution sequence via getComponentAddHandler()

## LOW Findings

### [LOW] Test Naming T706.2b Suggests Incomplete Planning

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:152-164

Issue: Naming T706.2b (variant of T706.2) suggests added without task reference. Creates ambiguity in structure.

Recommendation:
- Rename to proper task (e.g., T706.5)
- Or merge into parameterized test using it.each()

### [LOW] Missing Comments on Array-Based Event Capture

File: packages/authoring-ui/src/__tests__/initEditor.test.ts:60-73

Issue: makeEventCapture() stores arrays per event (correct for dual registration), but design isn't documented. Reviewer might not understand why arrays instead of single handler.

Recommendation:
- Add JSDoc: makeEventCapture captures multiple handlers per event because initEditor.ts registers component:add twice

## Summary Table

| Severity | Count | Blocking |
|----------|-------|----------|
| CRITICAL | 2     | YES      |
| HIGH     | 2     | YES      |
| MEDIUM   | 2     | NO       |
| LOW      | 2     | NO       |

## Verdict: BLOCK

Do not merge until CRITICAL and HIGH issues are resolved.

The test suite has gaps that could allow position-related bugs in production:
1. No verification of alternative position values
2. GrapesJS API mocking doesn't match contract
3. Autosave handler untested separately
4. Handler registration not explicitly verified

Required fixes before merge:
1. Add tests for position: relative, fixed, sticky
2. Verify actual GrapesJS getStyle() return types
3. Add explicit tests for autosave handler
4. Verify handler registration in dedicated test
5. Refactor T706.4 parameterized mock

Relevant files:
- Implementation: /d/dev/git/elearn-studio/packages/authoring-ui/src/editor/initEditor.ts:190-200
- Tests: /d/dev/git/elearn-studio/packages/authoring-ui/src/__tests__/initEditor.test.ts
