/**
 * Re-exports course domain types from the shared-types package.
 * All type definitions live in @elearn-studio/shared-types/src/course.ts.
 *
 * Local imports across authoring-ui continue to use this path unchanged.
 */

export {
  WIDGET_TYPES,
  type WidgetType,
  type Bounds,
  type BaseWidget,
} from '@elearn-studio/shared-types'

export {
  type Action,
  type ActionType,
  type ActionSequence,
  type SharedActionSequence,
  WIDGET_EVENTS,
  SLIDE_EVENTS,
  type WidgetEvent,
  type SlideEvent,
} from '@elearn-studio/shared-types'

export {
  type Slide,
  type SlideTemplate,
  type Resource,
  type NavigationMode,
  type CourseSettings,
  type SCORMMetadata,
  type CourseDoc,
  type CourseListItem,
} from '@elearn-studio/shared-types'
