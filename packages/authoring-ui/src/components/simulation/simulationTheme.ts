/**
 * Shared dark-theme tokens for the simulation namespace UI surfaces (TD-014.24).
 *
 * Single source of truth for colours, typography, and spacing tokens consumed
 * by `SimulationEditor.tsx`, `RecorderLauncherDialog.tsx`, `RecorderLiveView.tsx`,
 * `SessionsPickerDialog.tsx`, and `StepForm.tsx`. All five surfaces are
 * authoring app-chrome (no widget buttons live here — see
 * `decisions/2026-04-25-button-label-change-convention.md`).
 *
 * Design philosophy — pragmatic extraction (NOT design-system rebuild):
 *   • Tokens for values that have measurable consensus across ≥2 files
 *     (e.g., `gap: 8` appears in 5+ files; `borderRadius: 4` is universal).
 *   • Reconcile small drifts that have no semantic justification
 *     (1px button padding, 6px error-banner padding).
 *   • Layout-specific outliers stay INLINE in the component
 *     (e.g., `gap: 10` in StepForm.form, `marginLeft: 24` in
 *     RecorderLive.headerActions, `'24px 18px'` in SessionsPicker.empty).
 *     These reflect intentional per-surface tuning, not theme tokens.
 *
 * See ADR `decisions/2026-04-25-simulation-style-consistency.md` for the
 * 13 sub-decisions (alternatives evaluated, reasoning, trade-offs).
 */

import type { CSSProperties } from 'react'

// ── COLOURS ───────────────────────────────────────────────────────────────
// Catppuccin Mocha palette mapped to semantic roles. Every value is used
// across ≥2 files in the simulation namespace.

export const colors = {
  // Backgrounds (5 levels of elevation)
  bgDeepest:   '#181825', // overlay backdrop
  bgBase:      '#1e1e2e', // dialog / header / form input
  bgElevated:  '#313244', // input fill, btnAddStep, also used as a border accent
  bgThumbnail: '#11111b', // thumbnail / live preview background
  bgSelection: '#2a2a3e', // active step item background

  // Borders (1 distinct value beyond bgElevated)
  borderSubtle: '#45475a', // outlined-button border, divider

  // Text (3 levels)
  textPrimary:   '#cdd6f4',
  textSecondary: '#a6adc8',
  textMuted:     '#6c7086',

  // Accents (semantic role per colour)
  accentBlue:   '#89b4fa', // primary action (Save / Start / Import)
  accentGreen:  '#a6e3a1', // success (Capture step, status finished)
  accentRed:    '#f38ba8', // danger / error (Discard, error banner, status error)
  accentYellow: '#f9e2af', // warning (status pending)
} as const

// ── TYPOGRAPHY ────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: 'Inter, system-ui, sans-serif',
} as const

/**
 * Font sizes used across the namespace. After sub-decisions 5 (heading
 * unified to 16) and 6 (input unified to 12), the table below is exhaustive
 * for tokenizable values. Outliers (9px thumbOrder badge, etc.) stay inline.
 */
export const fontSize = {
  tiny:    10, // form hint / optional marker
  small:   11, // uppercase labels, stepDesc, rowMeta, screenshotBtn, btnSecondary in SessionsPicker
  caption: 12, // button text, body hint, error banner, all inputs
  body:    13, // rowTitle, empty-state copy
  title:   14, // header title, instruction
  heading: 16, // modal h2 (unified per dec 5)
} as const

export const fontWeight = {
  normal: 400,
  medium: 600,
  bold:   700, // outlier — only thumbOrder badge uses this; kept for completeness
} as const

/**
 * Composite text styles — only patterns repeated identically across ≥2 files
 * qualify. Spread into the consumer's local style (`{ ...text.label, ... }`).
 */
export const text = {
  /** "Uppercase label" — 5-prop composite, identical in 3 files. */
  label: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } satisfies CSSProperties,
} as const

// ── SPACING ───────────────────────────────────────────────────────────────
// Pragmatic tokens (sub-decision 10B): only consensus values; one-off
// paddings stay inline. Border-radius and gap are the only dimensions
// with enough cross-file consensus to warrant tokens.

export const radius = {
  small:   3, // iconBtn, thumbnail
  default: 4, // most buttons, inputs, banners (universal)
  dialog:  6, // RecorderLauncherDialog + SessionsPickerDialog containers
} as const

export const gap = {
  tight:   2,  // stepControls, rowInfo, StepForm.field
  default: 8,  // headerActions, dialog flex, stepItem (5+ usages)
  medium:  12, // header, canvasArea, row
} as const

// ── BUTTONS ───────────────────────────────────────────────────────────────
// Composite button styles. Each variant is a base spec; combine with
// `buttons.disabled` via spread when the action is in flight.
//
// Usage:
//   <button
//     style={{ ...buttons.primary, ...(busy ? buttons.disabled : null) }}
//     disabled={busy}
//   >Save & Close</button>
//
// Per `decisions/2026-04-25-button-label-change-convention.md`, NONE of
// these are widget buttons — label-change does NOT apply. The disabled
// + dimmed state IS the complete state signal.

const btnBase: CSSProperties = {
  padding: '6px 14px',          // sub-decision 8: unified to 6px vertical
  borderRadius: radius.default,
  fontSize: fontSize.caption,
  fontWeight: fontWeight.medium,
  cursor: 'pointer',
}

export const buttons = {
  /** Blue accent — primary action (Save & Close, Start recording, Import). */
  primary: {
    ...btnBase,
    background: colors.accentBlue,
    color: colors.bgBase,
    border: 'none',
  } satisfies CSSProperties,

  /** Transparent + grey border — neutral exit (Cancel, Stop preserve, Close). */
  secondary: {
    ...btnBase,
    fontWeight: fontWeight.normal,
    background: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.borderSubtle}`,
  } satisfies CSSProperties,

  /**
   * Green accent — success / capture (Capture step in RecorderLiveView).
   * Renamed from local `btnPrimary` (sub-decision 4) to avoid collision
   * with the BLUE primary used everywhere else.
   */
  success: {
    ...btnBase,
    background: colors.accentGreen,
    color: colors.bgBase,
    border: 'none',
  } satisfies CSSProperties,

  /**
   * Red-accent border + neutral fill — destructive (Discard).
   * Originated in TD-014.34 (`RecorderLiveView.tsx`); migrated here per
   * the commitment in that ADR.
   */
  danger: {
    ...btnBase,
    background: 'transparent',
    color: colors.accentRed,
    border: `1px solid ${colors.accentRed}`,
  } satisfies CSSProperties,

  /** Spread on top of any of the above when the action is in flight. */
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } satisfies CSSProperties,
} as const

// ── SURFACES ──────────────────────────────────────────────────────────────
// Reusable container patterns that appear in ≥2 files. Surface-specific
// keys (stepList, previewWrap, canvasArea, etc.) stay inline in their
// owning component — they're layout, not theme.

export const surfaces = {
  /**
   * Full-viewport backdrop for overlays + modals. Consumers set `zIndex` +
   * `background` at the use site:
   *   • Overlay (full-bleed editor): zIndex 1000, background bgDeepest.
   *   • Modal (over the overlay):    zIndex 1100, background rgba(0,0,0,0.5).
   * Different roles, different backgrounds — kept as a consumer choice.
   */
  overlayBase: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    color: colors.textPrimary,
    fontFamily: fontFamily.sans,
  } satisfies CSSProperties,

  /** Modal dialog container (RecorderLauncherDialog, SessionsPickerDialog). */
  dialog: {
    background: colors.bgBase,
    color: colors.textPrimary,
    border: `1px solid ${colors.bgElevated}`,
    borderRadius: radius.dialog,
    fontFamily: fontFamily.sans,
  } satisfies CSSProperties,

  /**
   * Error banner — used in 3 dialogs/overlays. Sub-decision 9 unified the
   * horizontal padding to 16px (RecorderLauncher previously had 10px).
   */
  errorBanner: {
    padding: '8px 16px',
    background: 'rgba(243, 139, 168, 0.12)',
    color: colors.accentRed,
    fontSize: fontSize.caption,
  } satisfies CSSProperties,
} as const
