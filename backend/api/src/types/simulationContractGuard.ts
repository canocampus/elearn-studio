/**
 * TD-023.5 — permanent contract guard (compile-time only, erased at build).
 *
 * The backend-local authored-simulation types must BE the shared-types
 * contract. `RawSimStep`/`RawSession` are deliberately NOT covered — they
 * are the recorder wire format, local to this package by design (see
 * docs/issues/issues-TD-023.md).
 */
import type {
  SimHotspot,
  SimInteractionType,
  AuthoredSimStep,
  SimMode,
  SimConfig,
} from './simulation'
import type {
  TypeEquals,
  AssertTrue,
  SimHotspot as SharedSimHotspot,
  SimInteractionType as SharedSimInteractionType,
  AuthoredSimStep as SharedAuthoredSimStep,
  SimMode as SharedSimMode,
  SimConfig as SharedSimConfig,
} from '@elearn-studio/shared-types'

export type SimulationContractGuards = [
  AssertTrue<TypeEquals<SimHotspot, SharedSimHotspot>>,
  AssertTrue<TypeEquals<SimInteractionType, SharedSimInteractionType>>,
  AssertTrue<TypeEquals<AuthoredSimStep, SharedAuthoredSimStep>>,
  AssertTrue<TypeEquals<SimMode, SharedSimMode>>,
  AssertTrue<TypeEquals<SimConfig, SharedSimConfig>>,
]
