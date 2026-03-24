# Troubleshooting

Common LMS integration problems and how to fix them.

---

## Course does not track — LMS shows "Not attempted"

**Cause:** The LMS API object was not found by the Runtime Player on launch.

**Diagnose:** Open browser DevTools inside the course iframe. Look for:
```
[ELearnPlayer] No SCORM API found — running in standalone mode
```

**Fixes:**

1. Verify the course launches in an iframe, not a popup window. Some LMSes require the popup setting to be enabled for SCORM.
2. Check the LMS SCORM activity settings: the **Display package** setting should be "In a new window" or "In a frame" — "Redirect" skips the SCORM API injection.
3. Confirm the `imsmanifest.xml` `adlcp:scormtype` attribute is `"sco"` (lowercase in SCORM 1.2, camelCase in SCORM 2004). If it is `"asset"`, the LMS will not inject the API.

---

## Score appears in LMS but course shows "Failed" when learner should pass

**Cause:** The mastery score in the manifest does not match the course's `passingScore` setting.

**Fix:** The manifest `adlcp:masteryscore` is set from `course.metadata.masteryScore` or `course.settings.passingScore` (default 80). If your LMS overrides the mastery score, adjust it in the LMS activity settings to match.

---

## "Incomplete" status never changes to "Passed"

**Cause:** The learner did not reach the final slide or did not answer all questions before the course closed.

The Runtime Player only calls `LMSFinish` / `Terminate` after the final scoring event. If the learner closes the browser tab before completing the course, the status remains `"incomplete"`.

**Fix:** Ensure the course has a dedicated "Submit" or "Finish" button on the last slide that triggers the navigation event. The player emits the final score report before calling Finish.

---

## SCORM 2004 — Moodle shows completion but no pass/fail

**Cause:** `cmi.success_status` is set to `"unknown"` when the learner hasn't answered all questions.

**Fix:** The Runtime Player sets `success_status = "unknown"` until scoring is complete. Ensure the learner answers all questions before the course ends. Check the Moodle gradebook method is set to **Highest attempt** not **Last attempt** if the learner closed early on a prior attempt.

---

## Suspend data not restoring slide position on re-launch

**Cause A:** The LMS does not persist `cmi.suspend_data` between sessions.

**Diagnose:** After completing a partial attempt, check the LMS gradebook for the attempt — if `suspend_data` is empty, the LMS is not saving it.

**Cause B:** The course was re-exported (new ZIP) and re-imported, which reset the LMS attempt record.

**Fix:** Do not re-import a package that learners have in-progress attempts on. Re-importing clears existing attempt data in most LMSes.

---

## AICC — course launches but no grades appear

**Cause:** The HACP URL is not configured or is blocked by CORS.

**Fix:**

1. Confirm the LMS provides an AICC HACP endpoint URL and that it is accessible from the learner's browser.
2. The HACP bridge in `index.html` reads the HACP URL from the LMS launch URL query string (`?AICC_URL=...`). If the LMS does not append this, the bridge falls back to `window.API` (SCORM 1.2 mode).
3. Check browser DevTools Network tab for failed POST requests to the HACP URL.

---

## ZIP import fails — "Invalid SCORM package"

**Cause:** The file was corrupted during download, or the LMS has a file size limit.

**Fix:**

1. Re-download the ZIP using the curl command in [scorm12.md](./scorm12.md).
2. Verify the ZIP is valid: `unzip -t my_course_scorm12.zip`
3. Check that `imsmanifest.xml` is at the ZIP root (not inside a subdirectory).

The packager always puts `imsmanifest.xml` at the root. If you unzip the file and see a top-level folder wrapping everything, your unzip tool may have added it — the actual ZIP structure is correct.

---

## Phaser simulation does not load in LMS

**Cause:** `phaser-bundle.js` was not included in the ZIP, or the Phaser build is missing.

**Diagnose:** Open browser DevTools → Network tab. Look for a failed request to `phaser-bundle.js`.

**Fix:**

1. Rebuild the Phaser bundle before exporting:
   ```bash
   pnpm --filter @elearn-studio/phaser-simulations run build
   ```
2. Re-export the course. The packager includes `phaser-bundle.js` only when the course contains at least one `phaser-sim` widget.
3. Verify the course JSON has a widget with `"type": "phaser-sim"`.

---

## Moodle — "Could not find a suitable SCORM SCO"

**Cause:** The manifest `adlcp:scormtype` attribute value is wrong, or the `<resource>` element is missing its `href`.

**Fix:** The packager sets `adlcp:scormtype="sco"` (SCORM 1.2) or `adlcp:scormType="sco"` (SCORM 2004). If you edited the manifest manually, verify these values. Re-export without manual edits.

---

## Useful Moodle Debug Settings

In development, enable SCORM debugging in Moodle:

1. **Site administration → Development → Debugging** → set to `DEVELOPER`.
2. In the SCORM activity: **Edit settings → Other → Force completed = No**, **Display attempt status = Full**.
3. After a test attempt, check **Reports → Attempts** for the raw CMI data Moodle received.
