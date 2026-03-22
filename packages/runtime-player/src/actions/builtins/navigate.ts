import type { NavigateAction } from '../types'
import type { ExecutionContext } from '../context'

export async function executeNavigate(
  action: NavigateAction,
  ctx: ExecutionContext,
): Promise<void> {
  const { target, slideName, slideNumber } = action.params
  const nav = ctx.navigation
  const current = nav.getCurrentIndex()
  const count = nav.getSlideCount()

  switch (target) {
    case 'next':
      if (current < count - 1) nav.goToIndex(current + 1)
      break
    case 'prev':
      if (current > 0) nav.goToIndex(current - 1)
      break
    case 'first':
      nav.goToIndex(0)
      break
    case 'last':
      nav.goToIndex(count - 1)
      break
    case 'slide-name': {
      const slides = nav.getSlides()
      const idx = slides.findIndex(
        (s) => s.title.toLowerCase() === (slideName ?? '').toLowerCase(),
      )
      if (idx !== -1) nav.goToIndex(idx)
      break
    }
    case 'slide-number': {
      const idx = (slideNumber ?? 1) - 1
      if (idx >= 0 && idx < count) nav.goToIndex(idx)
      break
    }
  }
}
