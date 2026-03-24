# Compatibility Matrix

LMS × standard × feature support for eLearn Studio packages.

---

## LMS × Standard Support

| LMS | SCORM 1.2 | SCORM 2004 4th Ed. | AICC |
|---|---|---|---|
| **Moodle 4.x** | ✅ Full | ✅ Full | ✅ Full (enable in admin) |
| **Moodle 3.x** | ✅ Full | ✅ Full | ✅ Full |
| **Canvas LMS** | ✅ Full | ✅ Full | ❌ Not supported |
| **Blackboard** | ✅ Full | ✅ Full | ✅ Full |
| **TalentLMS** | ✅ Full | ✅ Full | ✅ Full |
| **Docebo** | ✅ Full | ✅ Full | ✅ Full |
| **SCORM Cloud** | ✅ Full | ✅ Full | ✅ Full |
| **SAP SuccessFactors** | ✅ Full | ⚠️ Partial | ✅ Full |

---

## Feature × Standard Support

| Feature | SCORM 1.2 | SCORM 2004 |
|---|---|---|
| **Completion tracking** | ✅ via `cmi.core.lesson_status` | ✅ via `cmi.completion_status` |
| **Score reporting** | ✅ `cmi.core.score.raw` (0–100) | ✅ `cmi.score.raw` + `cmi.score.scaled` |
| **Pass/Fail** | ✅ `passed` / `failed` in `lesson_status` | ✅ separate `cmi.success_status` |
| **Suspend & Resume** | ✅ `cmi.suspend_data` (4 KB limit) | ✅ `cmi.suspend_data` (64 KB limit) |
| **Slide position restore** | ✅ `cmi.core.lesson_location` | ✅ `cmi.location` |
| **Mastery score in manifest** | ✅ `adlcp:masteryscore` | ✅ `adlcp:completionThreshold` (normalized) |
| **Sequencing rules** | ❌ Not supported | ✅ Linear sequencing via `imsss:sequencing` |
| **Phaser simulations** | ✅ `phaser-bundle.js` included conditionally | ✅ Same |
| **Content-set completion** | ❌ LMS-controlled | ✅ `completionSetByContent="true"` |

---

## Runtime Player API Detection Order

The Runtime Player checks for SCORM APIs in this order on launch:

1. `window.API_1484_11` → SCORM 2004 adapter
2. `window.API` → SCORM 1.2 adapter (also used by AICC HACP bridge)
3. Neither found → runs in standalone mode (no LMS reporting)

The Runtime Player traverses up to 10 parent frames when looking for the API object, which handles common LMS iframe nesting patterns.

---

## Known Limitations

| Limitation | Detail |
|---|---|
| SCORM 1.2 `suspend_data` | 4 096-byte limit. Courses with many question widgets may approach this limit on long courses. Use SCORM 2004 for courses with >50 slides. |
| SCORM 2004 no REST endpoint | `POST /courses/:id/export/scorm2004` is not yet implemented. Use `packSCORM2004()` directly from the packager library. |
| AICC no REST endpoint | `POST /courses/:id/export/aicc` is not yet implemented. Use `packAICC()` directly. |
| xAPI (Tin Can) | Not implemented in this version. |
| CMI5 | Not implemented in this version. |
| Multi-SCO | All courses publish as a single SCO. |
