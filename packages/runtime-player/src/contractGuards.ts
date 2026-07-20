/**
 * TD-023.5 — permanent contract guard (compile-time only, erased at build).
 *
 * The runtime-local simulation and animation types must BE the shared-types
 * contract. Lives in production `src` on purpose: this package excludes
 * `__tests__` from `tsc`, so a guard in a test file would never fire.
 *
 * Historical note (TD-023 RED): this file initially failed to compile
 * because the runtime's `AuthoredSimStep.interactionType` was optional while
 * the contract requires it — the exact divergence the structural audit
 * flagged. The read-side legacy default for pre-T202 packages lives in
 * simPlayer (`?? 'click'`), not in the type.
 */
import type {
  SimHotspot,
  SimInteractionType,
  AuthoredSimStep,
  SimMode,
  SimConfig,
} from './sim/simPlayer'
import type {
  AnimationKeypoint,
  AnimationFill,
  AnimationPath,
} from './animations/animator'
import type {
  TypeEquals,
  AssertTrue,
  SimHotspot as SharedSimHotspot,
  SimInteractionType as SharedSimInteractionType,
  AuthoredSimStep as SharedAuthoredSimStep,
  SimMode as SharedSimMode,
  SimConfig as SharedSimConfig,
  AnimationKeypoint as SharedAnimationKeypoint,
  AnimationFill as SharedAnimationFill,
  AnimationPath as SharedAnimationPath,
} from '@elearn-studio/shared-types'

export type SimulationContractGuards = [
  AssertTrue<TypeEquals<SimHotspot, SharedSimHotspot>>,
  AssertTrue<TypeEquals<SimInteractionType, SharedSimInteractionType>>,
  AssertTrue<TypeEquals<AuthoredSimStep, SharedAuthoredSimStep>>,
  AssertTrue<TypeEquals<SimMode, SharedSimMode>>,
  AssertTrue<TypeEquals<SimConfig, SharedSimConfig>>,
]

export type AnimationContractGuards = [
  AssertTrue<TypeEquals<AnimationKeypoint, SharedAnimationKeypoint>>,
  AssertTrue<TypeEquals<AnimationFill, SharedAnimationFill>>,
  AssertTrue<TypeEquals<AnimationPath, SharedAnimationPath>>,
]
