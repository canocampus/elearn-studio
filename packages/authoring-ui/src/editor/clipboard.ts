/**
 * Module-level clipboard for elearn:copy / elearn:paste commands.
 * T636.4 — NOT localStorage (Critical Rule 5: no localStorage in player).
 */

export interface ClipboardEntry {
  definition: Record<string, unknown>
  style: Record<string, string>
}

let _clipboard: ClipboardEntry | null = null

export function setClipboard(entry: ClipboardEntry): void {
  _clipboard = entry
}

export function getClipboard(): ClipboardEntry | null {
  return _clipboard
}

export function clearClipboard(): void {
  _clipboard = null
}
