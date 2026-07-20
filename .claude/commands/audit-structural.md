# Command: /audit-structural
1. Refresh the graph: run `node .claude/hooks/pre-investigation.js` (resolves the right Python itself — do NOT call `python3` directly, it is a broken store stub on Windows).
2. Query the graph for circular dependencies between `packages/authoring-ui` and `packages/runtime-player`.
3. Check if any PropertyPanel is importing GrapesJS types directly instead of using the lifecycle skill.
4. Report "Architectural Deviations" to the owner.
