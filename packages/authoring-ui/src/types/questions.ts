/**
 * Re-exports question types from @elearn-studio/shared-types.
 * All definitions live in @elearn-studio/shared-types/src/questions.ts.
 *
 * Local imports across authoring-ui continue to use this path unchanged.
 */

export type {
  ScormInteractionType,
  QuestionScoring,
  BaseQuestionExtendedProps,
  MCOption,
  MCExtendedProps,
  TFExtendedProps,
  FillMatchType,
  FillExtendedProps,
  QuestionWidgetType,
} from '@elearn-studio/shared-types'

export {
  MC_DEFAULT_EXTENDED,
  TF_DEFAULT_EXTENDED,
  FILL_DEFAULT_EXTENDED,
  QUESTION_WIDGET_TYPES,
  isQuestionWidgetType,
} from '@elearn-studio/shared-types'
