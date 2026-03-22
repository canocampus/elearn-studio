import type { CapturedEvent } from './types'

/** Generate a human-readable step description from a captured browser event. */
export function generateStepName(event: CapturedEvent): string {
  const text = event.targetText?.trim() ? `"${event.targetText.trim()}"` : null

  switch (event.type) {
    case 'click':
      return text ? `Click ${text}` : `Click at (${event.x}, ${event.y})`

    case 'dblclick':
      return text ? `Double-click ${text}` : `Double-click at (${event.x}, ${event.y})`

    case 'rightclick':
      return text ? `Right-click ${text}` : `Right-click at (${event.x}, ${event.y})`

    case 'keydown':
      if (event.key === 'Tab')    return text ? `Tab to ${text}` : 'Press Tab'
      if (event.key === 'Enter')  return text ? `Press Enter on ${text}` : 'Press Enter'
      if (event.key === 'Escape') return 'Press Escape'
      if (event.key?.startsWith('Arrow')) return `Press ${event.key}`
      return `Press ${event.key}`

    case 'input': {
      const field = event.targetText?.trim() ? `"${event.targetText.trim()}"` : 'field'
      const val   = event.value?.trim() ? `: "${event.value.slice(0, 40)}"` : ''
      return `Type into ${field}${val}`
    }

    case 'change':
      return text ? `Select ${text}` : `Change selection to "${event.value ?? ''}"`

    default:
      return 'Interaction'
  }
}
