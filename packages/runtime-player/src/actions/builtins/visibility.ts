import type { ShowAction, HideAction, BringToFrontAction } from '../types'
import type { ExecutionContext } from '../context'

export function executeShow(action: ShowAction, ctx: ExecutionContext): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (ref?.el) {
    ref.el.style.display = ''
    ref.el.removeAttribute('data-hidden')
    // Restore the z-index that was saved before hiding (T203)
    const saved = ref.el.getAttribute('data-original-zindex')
    if (saved !== null) {
      ref.el.style.zIndex = saved === 'auto' ? '' : saved
      ref.el.removeAttribute('data-original-zindex')
    }
  }
}

export function executeHide(action: HideAction, ctx: ExecutionContext): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (ref?.el) {
    // Save current z-index before hiding so executeShow can restore it (T203)
    const computed = window.getComputedStyle(ref.el).zIndex
    ref.el.setAttribute('data-original-zindex', computed)
    ref.el.style.display = 'none'
    ref.el.setAttribute('data-hidden', 'true')
  }
}

export function executeBringToFront(action: BringToFrontAction, ctx: ExecutionContext): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (!ref?.el) return

  // Find the maximum z-index among all widgets currently in the slide container
  const allWidgets = ctx.container.querySelectorAll<HTMLElement>('[data-widget-id]')
  let maxZ = 0
  for (const el of allWidgets) {
    const z = parseInt(window.getComputedStyle(el).zIndex, 10)
    if (!isNaN(z) && z > maxZ) maxZ = z
  }

  ref.el.style.zIndex = String(maxZ + 1)
}
