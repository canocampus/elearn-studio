/**
 * ActionExecutor — T021
 *
 * Executes action sequences produced by the Actions Editor.
 * All actions run serially (await each before starting next).
 * No global state — all state lives in ExecutionContext.
 */

import type { Action } from './types'
import type { ExecutionContext } from './context'
import { executeNavigate }       from './builtins/navigate'
import { executeShow, executeHide, executeBringToFront } from './builtins/visibility'
import { executeSetVariable }    from './builtins/variables'
import { executeDisplayMessage } from './builtins/message'
import { executePlayMedia, executeStopMedia } from './builtins/media'
import {
  executeScoreQuestion,
  executeScoreQuiz,
  executeSendToLMS,
  executeSuspendLesson,
} from './builtins/scoring'
import { executeCondition } from './builtins/condition'
import { executeLoop }      from './builtins/loop'
import { executePlayAnimation } from './builtins/animation'
import { executeCallSequence }  from './builtins/callSequence'

export class ActionExecutor {
  private readonly ctx: ExecutionContext

  constructor(ctx: ExecutionContext) {
    this.ctx = ctx
  }

  /**
   * Execute a list of actions serially.
   * This method is intentionally public so ConditionAction / LoopAction
   * can recurse into it for nested sequences.
   *
   * TD-003: `actions` is declared `Action[]`, but on legacy MongoDB documents
   * saved before `then`/`else`/`body`/`actions` became required fields, the
   * array may arrive as `undefined` at runtime (e.g. a condition action whose
   * `then` branch was empty was persisted without the key). Iterating over
   * `undefined` throws TypeError and aborts the whole sequence. Default to `[]`
   * so the action call becomes a no-op instead — preserves forward-compat with
   * any future caller that forgets the guard and matches the defensive pattern
   * used in `validateSequence.ts` (authoring-side).
   */
  async run(actions: Action[]): Promise<void> {
    const errors: Error[] = []
    for (const action of actions ?? []) {
      const startTs = Date.now()
      window.dispatchEvent(new CustomEvent('elearn:action:start', {
        detail: { type: action.type, timestamp: startTs },
      }))
      try {
        await this.dispatch(action)
        window.dispatchEvent(new CustomEvent('elearn:action:end', {
          detail: { type: action.type, timestamp: startTs, duration: Date.now() - startTs },
        }))
      } catch (err) {
        console.error(`[ActionExecutor] Error in ${action.type}:`, err)
        window.dispatchEvent(new CustomEvent('elearn:action:error', {
          detail: { type: action.type, timestamp: startTs, error: String(err) },
        }))
        errors.push(err as Error)
      }
    }
    if (errors.length > 0) {
      const aggregate = new Error(`${errors.length} action(s) failed`)
      ;(aggregate as Error & { cause: Error[] }).cause = errors
      throw aggregate
    }
  }

  private async dispatch(action: Action): Promise<void> {
    switch (action.type) {
      case 'navigate':
        await executeNavigate(action, this.ctx)
        break
      case 'show':
        executeShow(action, this.ctx)
        break
      case 'hide':
        executeHide(action, this.ctx)
        break
      case 'bring-to-front':
        executeBringToFront(action, this.ctx)
        break
      case 'set-variable':
        executeSetVariable(action, this.ctx)
        break
      case 'display-message':
        executeDisplayMessage(action, this.ctx)
        break
      case 'play-media':
        executePlayMedia(action, this.ctx)
        break
      case 'stop-media':
        executeStopMedia(action, this.ctx)
        break
      case 'score-question':
        executeScoreQuestion(action, this.ctx)
        break
      case 'score-quiz':
        executeScoreQuiz(action, this.ctx)
        break
      case 'send-to-lms':
        executeSendToLMS(action, this.ctx)
        break
      case 'suspend-lesson':
        executeSuspendLesson(action, this.ctx)
        break
      case 'condition':
        await executeCondition(action, this.ctx, (a, _c) =>
          this.run(a as Action[]),
        )
        break
      case 'loop':
        await executeLoop(action, this.ctx, (a, _c) =>
          this.run(a as Action[]),
        )
        break
      case 'play-animation':
        executePlayAnimation(action, this.ctx)
        break
      case 'call-sequence':
        await executeCallSequence(action, this.ctx, (a) => this.run(a as Action[]))
        break
      default:
        // Unknown action type — ignore gracefully (forward-compatibility)
        break
    }
  }
}
