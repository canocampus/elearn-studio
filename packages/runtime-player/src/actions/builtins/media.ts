import type { PlayMediaAction, StopMediaAction } from '../types'
import type { ExecutionContext } from '../context'

export function executePlayMedia(
  action: PlayMediaAction,
  ctx: ExecutionContext,
): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (!ref?.el) return
  const media = ref.el.querySelector<HTMLMediaElement>('video, audio')
  media?.play().catch(() => {
    // Autoplay may be blocked by browser — ignore silently; user interaction
    // already occurred (the action was triggered by a click)
  })
}

export function executeStopMedia(
  action: StopMediaAction,
  ctx: ExecutionContext,
): void {
  const ref = ctx.getWidget(action.params.widgetId)
  if (!ref?.el) return
  const media = ref.el.querySelector<HTMLMediaElement>('video, audio')
  if (media) {
    media.pause()
    media.currentTime = 0
  }
}
