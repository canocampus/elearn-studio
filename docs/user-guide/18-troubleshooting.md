# 18 — Troubleshooting

This chapter collects the ten problems authors most often run into, with the cause and a numbered fix for each. Every entry is self-contained — you don't need to read the surrounding chapters to apply the fix. If the same problem keeps happening, the cross-link at the bottom of each entry points you to the chapter that explains the feature in depth.

---

## 1. The save indicator is stuck on "Saving…"

**Symptom.** The save indicator in the top toolbar shows *Saving…* and does not change to "saved" even after you stop editing for several seconds.

**Likely cause.** Either the browser has lost its connection to the server, or a recent change triggered an error during saving. A persistent *Saving…* almost always means auto-save has tried but failed, not that it is still in progress.

**Fix.**

1. Look at the top of the editor for a red banner labelled *Save failed* (it appears below the top toolbar). If you see it, click **Retry**. In most cases saving succeeds on the retry.
2. If the banner does not appear but *Saving…* persists for more than 30 seconds, check your internet connection.
3. If the connection is fine, reload the page. Unsaved edits in the last two seconds may be lost — anything older than that is already persisted.
4. If the problem keeps happening, take note of what you were editing and report it to your administrator. Intermittent save failures usually point to a server issue, not something you can fix yourself.

See: [02 — Getting Started](02-getting-started.md) for the save indicator basics.

---

## 2. The Preview popup does not open

**Symptom.** You click **Preview**, but no new window appears.

**Likely cause.** Your browser blocked the popup. Most browsers block popups by default.

**Fix.**

1. Look at the address bar of the current window. A small popup-blocked icon (usually a little window with a red cross) appears there when a popup was blocked.
2. Click the icon.
3. Choose **Always allow popups from this site** (wording varies slightly between browsers).
4. Click **Preview** again. The window should now open.

If the icon never appears, open your browser's settings and add the site to the allowed-popups list.

See: [15 — Preview](15-preview.md).

---

## 3. The LMS does not record completion or score

**Symptom.** The learner finishes your course, but the LMS still shows it as *In progress* or *Not started*. The score is also missing.

**Likely cause.** In almost every case, the course is missing a **Done Button** on its final slide, or the Done Button is not wired to the **Send to LMS** action. Without those two pieces, the LMS has no way to know the course is finished.

**Fix.**

1. Open your course in the editor and go to the final slide.
2. Make sure a **Done Button** block is placed on it. If not, drag one from the **Blocks** tab → **Navigation** category.
3. Select the Done Button. Open the **Actions** tab on the right sidebar.
4. Add a trigger **click** if it does not already exist.
5. Under that trigger, add the action **Send to LMS**. Save.
6. Publish a new version and upload the new ZIP to your LMS. Test with a new learner account.

> 💡 **Tip:** Add `Score Quiz` as the first action in the Done Button's click sequence, then `Send to LMS`. The Score Quiz step computes the final score before it is reported.

See: [05 — Done Button](05-blocks-navigation.md#done-button) and [10 — Send to LMS](10-actions-triggers-reference.md#send-to-lms).

---

## 4. An Interactive Scenario shows only a label or placeholder in the LMS

**Symptom.** You configured a rich Interactive Scenario (nodes, hotspots, quiz questions) but at runtime — inside the LMS or Preview — it shows a simple dark panel with the scenario name, auto-advances after a couple of seconds, and does not let the learner interact.

**Likely cause.** This is **not a bug and not a configuration error**. In version v0.5.62 the Interactive Scenario runtime uses a generic placeholder for every scenario type. Your scene definition is saved and exported correctly — when the full scenario renderer ships in a future update, your scenarios will start rendering as designed, with no rework needed.

**Fix.**

1. Confirm the placeholder behaviour is what you are seeing. The scenario should display its name on a dark background and auto-complete after about two seconds.
2. If you need a fully interactive activity today, consider a [Software Walkthrough](13-software-walkthrough.md) instead — that path is fully functional.
3. Continue authoring your Interactive Scenarios as planned. Your scene definitions are preserved and will activate automatically when the renderer ships.

See: [14 — Interactive Scenario — Known limit](14-interactive-scenario.md).

---

## 5. The Quiz Score block shows "0 / 0" after the learner answers

**Symptom.** The learner has answered one or more questions, but the **Quiz Score** block on the slide still shows *0 / 0*.

**Likely cause.** The questions on the course are not wired to a scoring action. Answering a question by itself does not update the score — you need an action to tell the course *"score this question now"*.

**Fix.**

1. Go to each question block in your course, one by one.
2. Select the question and open the **Actions** tab.
3. Add a trigger **questionAnswered** (or **questionCorrect** if you only want to count correct answers).
4. Under that trigger, add the action **Score Question** and pick the same question as the target.
5. On the slide where the Quiz Score block lives, add an action at the slide level (trigger **enterSlide**) that runs **Score Quiz**. This refreshes the block.
6. Preview the course and confirm the block updates as expected.

See: [07 — Assessment Blocks → Quiz Score](07-blocks-assessment.md#quiz-score) and [10 — Score Question / Score Quiz](10-actions-triggers-reference.md#score-question).

---

## 6. An image or audio block shows a broken-file icon

**Symptom.** A block that should display an image or play an audio file shows a broken-file icon (a small box with a crack through it, or silence where a clip should play).

**Likely cause.** The asset referenced by the block is missing. This usually happens when the file was removed from the Asset Library, or the course was imported without all its assets, or a temporary preview URL has expired.

**Fix.**

1. Select the block. Open the **Props** tab.
2. Look at the **Media URL** (or **Source** / **Audio URL**) field. Click the **Choose from Asset Library…** button next to it.
3. If the asset appears greyed out or missing in the library, upload it again using **Upload**.
4. Pick the asset and confirm. The block's preview should refresh.
5. If the problem appears on every asset at once, contact your administrator — the Asset Library itself may be unavailable.

See: [04 — Image](04-blocks-basic.md#image) and [06 — Media Blocks](06-blocks-media.md).

---

## 7. Dragging a block onto the canvas does nothing

**Symptom.** You drag a block from the **Blocks** tab onto the canvas, but when you release the mouse the block does not appear.

**Likely cause.** Most commonly, another block on the slide is sitting on top of the area where you tried to drop — a large rectangle, a full-slide image, or an overlapping Text block. Your cursor released the drag on top of that block rather than on the canvas.

**Fix.**

1. Open the **Layers** tab on the right sidebar to see every block on the current slide.
2. Temporarily select the overlapping block in the Layers list and press the *hide* icon (or set its visibility toggle off) to take it out of the way.
3. Drag your new block onto the canvas again. Release in a clear area.
4. Re-show the block you hid in step 2.
5. If the problem persists, drop the block somewhere obviously empty (a corner of the canvas) and drag it to its final position afterwards.

See: [04 — Basic Blocks](04-blocks-basic.md) and the Layers panel reference in [20 — Glossary](20-glossary.md#authoring).

---

## 8. The Actions Editor dropdown shows cryptic IDs instead of block names

**Symptom.** When you configure an action such as **Show**, **Hide**, or **Play Media**, the dropdown of target blocks shows short cryptic strings (like *c32kq3* or *df12x8*) instead of the names you expect.

**Likely cause.** The blocks that would be shown have no **Name** set in their **Props** tab. When Name is empty, the dropdown falls back to the block's internal identifier. Setting a Name makes the dropdown show that name instead.

> ℹ️ **Note:** Since version v0.5.62, the Actions Editor displays the **Name** trait correctly whenever you set one. If you are still seeing cryptic IDs, it is because the blocks simply haven't been named — not because of a product bug.

**Fix.**

1. Select the block you want to reference in the action.
2. Open the **Props** tab on the right sidebar.
3. Type a clear, descriptive value into the **Name** field (for example, *HintButton*, *MainImage*, *SubmitBtn*).
4. Go back to the Actions Editor on the source block and open the dropdown again — the name appears.

See: [09 — Naming your blocks](09-actions-editor.md#naming-your-blocks).

---

## 9. The published ZIP file is very large

**Symptom.** The ZIP you download after publishing is many megabytes — tens or hundreds — and uploading it to your LMS takes a long time or fails.

**Likely cause.** Either the course contains uncompressed large media (a very large image, or a long audio / video file), or unused assets are still packaged. Audio and video files are typically the biggest contributors.

**Fix.**

1. Identify large media blocks. Go through each slide and note any Image, Media Player, or Audio Narration that uses a big file.
2. Compress images before uploading them to the Asset Library. Use a tool like an online image compressor to reduce images to the size they actually need (for a 1024-pixel canvas, most photos can be under 500 KB).
3. Trim audio and video to just the portion the learner needs, and re-encode at a reasonable bit rate before upload.
4. Remove any test or leftover blocks that reference large assets you no longer use.
5. Publish again and compare the new ZIP size to the previous one.

See: [06 — Media Blocks](06-blocks-media.md) and [16 — Publish as SCORM](16-publish-scorm.md).

---

## 10. A specific slide refuses to load

**Symptom.** Every other slide in the course opens normally, but selecting one specific slide produces an error, a blank canvas, or the editor behaves oddly. The same slide may also break Preview or publishing.

**Likely cause.** The slide has a block in an inconsistent state — for example, an action pointing at a block that no longer exists, or a mismatched configuration on a question or simulation. The editor cannot reconstruct the slide as expected.

**Fix.**

1. Select the slide in the **Slides** tab. If the canvas is blank but the Layers tab shows blocks, you can still work with the slide.
2. Open the **Layers** tab on the right sidebar. Each block on the slide is listed here, even if it is invisible on the canvas.
3. Click through the blocks one at a time. Look for any block whose **Props** panel shows red borders or missing fields.
4. Fix the problematic block — complete its fields, or if it is beyond saving, delete it via the Layers tab.
5. Save. Preview the slide to confirm it works.
6. If the slide is still broken after removing visibly bad blocks, duplicate the previous or next slide instead and rebuild the content from there. It is often faster than trying to recover a fully broken slide.

See: [03 — Slides](03-slides.md) and the Layers reference in [20 — Glossary](20-glossary.md#authoring).

---

## Still stuck?

If none of the entries above matches what you are seeing:

- Re-read the chapter for the feature involved. Often a second pass catches a setting you missed.
- Try the same action in a **new, empty course**. If it works there, the problem is specific to your course's state. If it fails in the empty course too, it is a systemic issue to report.
- Contact your administrator with a short description of what you expected, what you saw, and the slide name or course title where it happened.

See: [20 — Glossary](20-glossary.md) for any term you want to verify.
