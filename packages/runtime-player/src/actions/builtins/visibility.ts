import type { ShowAction, HideAction } from '../types'
import type { ExecutionContext } from '../context'

export function executeShow(action: ShowAction, ctx: ExecutionContext): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (ref?.el) {
    ref.el.style.display = ''
    ref.el.removeAttribute('data-hidden')
  }
}

export function executeHide(action: HideAction, ctx: ExecutionContext): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (ref?.el) {
    ref.el.style.display = 'none'
    ref.el.setAttribute('data-hidden', 'true')
  }
}
