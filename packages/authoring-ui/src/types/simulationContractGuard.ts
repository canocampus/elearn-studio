/**
 * TD-023.5 — permanent contract guard (compile-time only, erased at build).
 *
 * The authoring-local simulation and animation types must BE the
 * shared-types contract. If a drifting local redefinition reappears, the
 * assertions below stop compiling and `tsc`/verify:types fails CI. Lives in
 * production `src` on purpose: this package excludes `__tests__` from some
 * type-check paths, and a guard that never compiles guards nothing.
 */
import type {
  SimHotspot,
  SimInteractionType,
  AuthoredSimStep,
  SimMode,
  SimConfig,
} from './simulation'
import type {
  AnimationKeypoint,
  AnimationFill,
  AnimationPath,
} from '../components/sidebar/AnimationPropertiesPanel'
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
