import type { PlayAnimationAction } from '../types'
import type { ExecutionContext } from '../context'
import { executeAnimation } from '../../animations/animator'
import type { AnimationPath } from '../../animations/animator'

/**
 * Play a named (or first) animation on a widget element.
 *
 * Animation paths are stored in widget.extendedProperties.animations
 * and carried into WidgetRef.extendedProperties at render time.
 */
export function executePlayAnimation(
  action: PlayAnimationAction,
  ctx: ExecutionContext,
): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (!ref?.el) {
    console.warn(
      `[ELearnPlayer] play-animation: widget "${action.params.widgetId}" not found`,
    )
    return
  }

  const raw = ref.extendedProperties?.animations
  if (!Array.isArray(raw)) {
    console.warn(
      `[ELearnPlayer] play-animation: widget "${action.params.widgetId}" has no animations array`,
    )
    return
  }
  const animations = raw as AnimationPath[]
  if (animations.length === 0) {
    console.warn(
      `[ELearnPlayer] play-animation: widget "${action.params.widgetId}" has no animations`,
    )
    return
  }

  const target = action.params.animationName
    ? animations.find(a => a.name === action.params.animationName)
    : animations[0]

  if (!target) {
    console.warn(
      `[ELearnPlayer] play-animation: animation "${action.params.animationName}" not found on widget "${action.params.widgetId}"`,
    )
    return
  }

  executeAnimation(ref.el, target)
}
