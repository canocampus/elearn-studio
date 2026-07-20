/**
 * Authoring-side simulation types (T024) — since TD-023 a pure re-export of
 * the canonical contract in `@elearn-studio/shared-types`. Do NOT redefine
 * shapes here: `simulationContractGuard.ts` fails the build on drift.
 */

export type {
  SimHotspot,
  SimInteractionType,
  AuthoredSimStep,
  SimMode,
  SimConfig,
} from '@elearn-studio/shared-types'
