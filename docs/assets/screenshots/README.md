# ⚠️ Legacy screenshot set (User Manual v1 era)

These PNGs were produced by the retired v1 capture scripts
(`docs/scripts/capture-screenshots.ts` + `capture-moodle-screenshot.ts`,
deleted in TD-013.10, 2026-07-18) and use the v1 naming scheme
(`01-dashboard.png`, `18-moodle-course.png`, …).

**Do not add new captures here.** The current, fully automated set lives in
`docs/user-guide/assets/screenshots/` and is produced by the campaign:

```bash
pnpm --filter @elearn-studio/e2e docs:screenshots
```

(see `docs/developer-guide/10-docs-screenshots-playbook.md`).

The files in this folder are kept only because `README.md` (repo root) still
embeds `05-editor-widgets.png` and `18-moodle-course.png`. When the README
migrates to v2 assets, this folder can be deleted outright.
