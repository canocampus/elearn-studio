/**
 * TD-024.5 — OpenAPI ↔ shared-types parity guard (compile-time only).
 *
 * Third side of the TD-019b triangle (Mongo ↔ OpenAPI ↔ shared-types; the
 * Mongo side is guarded by a backend test reflecting over WidgetSchema).
 * `courseApi` types API responses as the shared `CourseDoc` — this file is
 * what turns that from faith into a compiler-checked fact: if the published
 * OpenAPI (via the generated client) drifts from the shared contract,
 * `tsc`/verify:types fails CI.
 *
 * Scope: key-set parity plus full equality where the shapes are meant to be
 * identical. The shared `Action` is a rich discriminated union while the
 * wire `ActionNode` is its open envelope, so those are asserted at the
 * key/enum level, not deep-equal.
 */
import type { components } from './generated'
import type {
  TypeEquals,
  AssertTrue,
  BaseWidget,
  Bounds,
  Slide,
  WidgetType,
} from '@elearn-studio/shared-types'

type GenWidget = components['schemas']['Widget']
type GenBounds = components['schemas']['Bounds']
type GenSlide = components['schemas']['Slide']
type GenActionSequence = components['schemas']['ActionSequence']

export type ApiContractGuards = [
  // The exact TD-019b class: a contract field missing from the API surface.
  AssertTrue<TypeEquals<keyof GenWidget, keyof BaseWidget>>,
  // Widget type enum in lockstep with WIDGET_TYPES.
  AssertTrue<TypeEquals<GenWidget['type'], WidgetType>>,
  // The field whose absence caused TD-019b, optionality included.
  AssertTrue<TypeEquals<GenWidget['name'], BaseWidget['name']>>,
  AssertTrue<TypeEquals<GenBounds, Bounds>>,
  AssertTrue<TypeEquals<keyof GenSlide, keyof Slide>>,
  AssertTrue<TypeEquals<keyof GenActionSequence, 'event' | 'actions'>>,
]
