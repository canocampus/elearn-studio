#!/usr/bin/env python3
"""crop-screenshots.py — deterministic post-crop fallback for the docs
screenshot campaign (TD-013.6).

Reads `scripts/screenshots-crop.json` mapping final PNG filenames to a crop
recipe over a `-fullpage.png` safety-net source:

    {
      "_comment": "keys starting with '_' are ignored",
      "<final>.png": {
        "source": "<name>-fullpage.png",
        "crop": { "x": N, "y": N, "width": N, "height": N },
        "padding": N,                     // optional — inflates the rect
        "callouts": [{ "number": 1, "x": N, "y": N }]   // optional
      }
    }

Behaviour per entry (all paths relative to docs/user-guide/assets/screenshots):

* **mtime idempotence** — if the final PNG exists and is at least as new as
  its source, the entry is skipped: the campaign's primary (testid-based)
  capture already produced it in the same run. The tool only crops when the
  primary path failed (final missing or older than the fresh safety net).
* **crop** — rectangle inflated by `padding` on every side, clamped to the
  source bounds. Coordinates are pixels in the source image.
* **callouts** — numbered circles drawn AFTER the crop, in the coordinate
  space of the cropped output. Styling mirrors `e2e/utils/screenshot.ts::
  addCallouts` (32px circle, #f9e2af fill, #1e1e2e text + ring) so Playwright
  and Python callouts are indistinguishable in the manual.
* **missing source / invalid config** — reported and the process exits
  non-zero (2 for config errors, 1 for entry failures) so a chained campaign
  run fails loudly instead of shipping stale PNGs.

Run standalone:            python scripts/crop-screenshots.py
Chained after the campaign: pnpm --filter @elearn-studio/e2e docs:screenshots
(the e2e package's script invokes this tool as a post-step).

Requires Pillow (any Python ≥3.9 with `pip install Pillow`).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover — guard clause for missing dependency
    print("[crop-screenshots] ERROR: Pillow is not installed (pip install Pillow)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "scripts" / "screenshots-crop.json"
SCREENSHOTS_DIR = REPO_ROOT / "docs" / "user-guide" / "assets" / "screenshots"

CALLOUT_SIZE = 32  # px — matches addCallouts() in e2e/utils/screenshot.ts
CALLOUT_FILL = "#f9e2af"
CALLOUT_TEXT = "#1e1e2e"
CALLOUT_RING = "#1e1e2e"


def _load_config() -> dict:
    if not CONFIG_PATH.is_file():
        print(f"[crop-screenshots] ERROR: config not found: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(2)
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[crop-screenshots] ERROR: invalid JSON in {CONFIG_PATH.name}: {exc}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(raw, dict):
        print(f"[crop-screenshots] ERROR: config root must be an object", file=sys.stderr)
        sys.exit(2)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


def _validate_entry(name: str, entry: object) -> str | None:
    """Return an error string, or None if the entry is well-formed."""
    if not isinstance(entry, dict):
        return "entry must be an object"
    src = entry.get("source")
    if not isinstance(src, str) or not src:
        return "missing or invalid 'source'"
    crop = entry.get("crop")
    if not isinstance(crop, dict):
        return "missing or invalid 'crop'"
    for key in ("x", "y", "width", "height"):
        if not isinstance(crop.get(key), int) or (key in ("width", "height") and crop[key] <= 0):
            return f"crop.{key} must be a {'positive ' if key in ('width', 'height') else ''}integer"
    padding = entry.get("padding", 0)
    if not isinstance(padding, int) or padding < 0:
        return "'padding' must be a non-negative integer"
    callouts = entry.get("callouts", [])
    if not isinstance(callouts, list):
        return "'callouts' must be a list"
    for c in callouts:
        if not isinstance(c, dict) or not all(isinstance(c.get(k), int) for k in ("number", "x", "y")):
            return "each callout needs integer 'number', 'x', 'y'"
    return None


def _callout_font() -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for candidate in ("arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(candidate, 16)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_callouts(img: Image.Image, callouts: list[dict]) -> None:
    draw = ImageDraw.Draw(img)
    font = _callout_font()
    r = CALLOUT_SIZE // 2
    for c in callouts:
        cx, cy = c["x"], c["y"]
        # Ring first (3px outline behind the fill), then the filled circle.
        draw.ellipse((cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=CALLOUT_RING)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CALLOUT_FILL)
        label = str(c["number"])
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), label, fill=CALLOUT_TEXT, font=font)


def _process(name: str, entry: dict) -> str:
    """Process one entry. Returns 'skipped' | 'cropped'. Raises on failure."""
    source_path = SCREENSHOTS_DIR / entry["source"]
    target_path = SCREENSHOTS_DIR / name
    if not source_path.is_file():
        raise FileNotFoundError(f"source not found: {entry['source']}")

    if target_path.is_file() and target_path.stat().st_mtime >= source_path.stat().st_mtime:
        return "skipped"  # primary capture from the same run already won

    crop, pad = entry["crop"], entry.get("padding", 0)
    with Image.open(source_path) as img:
        left = max(0, crop["x"] - pad)
        top = max(0, crop["y"] - pad)
        right = min(img.width, crop["x"] + crop["width"] + pad)
        bottom = min(img.height, crop["y"] + crop["height"] + pad)
        if right <= left or bottom <= top:
            raise ValueError(f"crop rect {crop} (padding {pad}) is empty after clamping to {img.width}x{img.height}")
        out = img.crop((left, top, right, bottom))
        callouts = entry.get("callouts", [])
        if callouts:
            _draw_callouts(out, callouts)
        out.save(target_path, format="PNG")
    return "cropped"


def main() -> int:
    config = _load_config()
    if not config:
        print("[crop-screenshots] config has no entries — nothing to do")
        return 0

    failures = 0
    for name, entry in config.items():
        error = _validate_entry(name, entry)
        if error:
            print(f"[crop-screenshots] ERROR {name}: {error}", file=sys.stderr)
            failures += 1
            continue
        try:
            outcome = _process(name, entry)
            print(f"[crop-screenshots] {outcome} {name}")
        except (FileNotFoundError, ValueError, OSError) as exc:
            print(f"[crop-screenshots] ERROR {name}: {exc}", file=sys.stderr)
            failures += 1

    if failures:
        print(f"[crop-screenshots] {failures} entr{'y' if failures == 1 else 'ies'} failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
