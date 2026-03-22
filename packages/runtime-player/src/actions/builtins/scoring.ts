import type {
  ScoreQuestionAction,
  ScoreQuizAction,
  SendToLMSAction,
  SuspendLessonAction,
} from '../types'
import type { ExecutionContext } from '../context'

export function executeScoreQuestion(
  action: ScoreQuestionAction,
  ctx: ExecutionContext,
): void {
  ctx.scoring.scoreQuestion(action.params.widgetId)
}

export function executeScoreQuiz(
  _action: ScoreQuizAction,
  ctx: ExecutionContext,
): void {
  ctx.scoring.scoreQuiz()
}

export function executeSendToLMS(
  _action: SendToLMSAction,
  ctx: ExecutionContext,
): void {
  if (!ctx.scorm) return
  const score = ctx.scoring.getCurrentScore()
  ctx.scorm.setValue('cmi.core.score.raw', String(score))
  ctx.scorm.setValue('cmi.core.score.min', '0')
  ctx.scorm.setValue('cmi.core.score.max', '100')
  ctx.scorm.commit()
}

export function executeSuspendLesson(
  _action: SuspendLessonAction,
  ctx: ExecutionContext,
): void {
  if (!ctx.scorm) return
  const score = ctx.scoring.getCurrentScore()
  ctx.scorm.setValue('cmi.core.score.raw', String(score))
  ctx.scorm.setValue('cmi.core.lesson_status', 'incomplete')
  ctx.scorm.commit()
  ctx.scorm.finish()
}
