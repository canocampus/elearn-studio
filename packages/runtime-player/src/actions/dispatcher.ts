/**
 * EventDispatcher — T021.10
 *
 * Wires DOM events (click, enterSlide, questionAnswered, etc.) emitted by
 * widgets and the slide lifecycle to ActionSequences stored in widget.actions[].
 *
 * Usage:
 *   const dispatcher = new EventDispatcher(ctx)
 *   dispatcher.attachWidget(widgetEl, widgetId, widget.actions)
 *   dispatcher.fireSlideEvent('enterSlide')
 */

import type { ActionSequence } from './types'
import type { ExecutionContext } from './context'
import { ActionExecutor } from './executor'

export class EventDispatcher {
  private readonly ctx: ExecutionContext
  private readonly executor: ActionExecutor
  /** Track listeners so they can be removed on teardown */
  private readonly listeners: Array<{
    el: HTMLElement
    event: string
    fn: EventListener
  }> = []

  constructor(ctx: ExecutionContext) {
    this.ctx = ctx
    this.executor = new ActionExecutor(ctx)
  }

  /**
   * Attach DOM event listeners for a widget based on its action sequences.
   * Call once per widget after the slide DOM is rendered.
   */
  attachWidget(
    el: HTMLElement,
    widgetId: string,
    sequences: ActionSequence[],
  ): void {
    // TD-003: defensive guard — legacy MongoDB documents may omit the `actions`
    // field on a widget with no sequences, so `sequences` arrives as undefined.
    for (const seq of sequences ?? []) {
      const domEvent = widgetEventToDom(seq.event)
      if (!domEvent) continue

      const fn: EventListener = (e) => {
        e.stopPropagation()
        this.executor.run(seq.actions).catch((err) => {
          console.error(`[EventDispatcher] Error executing ${seq.event} on widget ${widgetId}:`, err)
        })
      }

      el.addEventListener(domEvent, fn)
      this.listeners.push({ el, event: domEvent, fn })
    }
  }

  /**
   * Replace event listeners for a widget element, removing any previously
   * attached listeners for the same element before re-attaching.
   * Use instead of attachWidget() when re-rendering a widget in place
   * to prevent listener accumulation across slide re-renders.
   */
  replaceWidget(
    el: HTMLElement,
    widgetId: string,
    sequences: ActionSequence[],
  ): void {
    // Remove existing listeners for this element
    const remaining: typeof this.listeners = []
    for (const listener of this.listeners) {
      if (listener.el === el) {
        el.removeEventListener(listener.event, listener.fn)
      } else {
        remaining.push(listener)
      }
    }
    this.listeners.length = 0
    this.listeners.push(...remaining)
    this.attachWidget(el, widgetId, sequences)
  }

  /**
   * Fire a slide-level event (enterSlide / exitSlide).
   * Searches ALL widgets on the current slide for matching sequences.
   * Call this from the player's slide render function.
   */
  fireSlideEvent(
    eventName: 'enterSlide' | 'exitSlide',
    allWidgetSequences: Array<{ widgetId: string; sequences: ActionSequence[] }>,
  ): void {
    // TD-003: `allWidgetSequences` is assembled from course.slides[i].widgets[j].actions
    // in the player; a legacy widget without actions persisted as undefined reaches
    // this loop through the outer `sequences` field.
    for (const { sequences } of allWidgetSequences ?? []) {
      const matching = (sequences ?? []).filter((s) => s.event === eventName)
      for (const seq of matching) {
        this.executor.run(seq.actions).catch((err) => {
          console.error(`[EventDispatcher] Error executing ${eventName}:`, err)
        })
      }
    }
  }

  /**
   * Fire a named event for a specific widget (e.g. 'questionAnswered', 'questionCorrect').
   */
  fireWidgetEvent(widgetId: string, eventName: string, sequences: ActionSequence[]): void {
    // TD-003: guard against legacy widgets missing the actions array.
    const matching = (sequences ?? []).filter((s) => s.event === eventName)
    for (const seq of matching) {
      this.executor.run(seq.actions).catch((err) => {
        console.error(`[EventDispatcher] Error executing ${eventName} on ${widgetId}:`, err)
      })
    }
  }

  /** Remove all attached DOM event listeners. Call when navigating away from a slide. */
  teardown(): void {
    for (const { el, event, fn } of this.listeners) {
      el.removeEventListener(event, fn)
    }
    this.listeners.length = 0
  }
}

// ─── Map widget event names → DOM event names ─────────────────────────────────

function widgetEventToDom(event: string): string | null {
  switch (event) {
    case 'click':       return 'click'
    case 'doubleClick': return 'dblclick'
    case 'mouseEnter':  return 'mouseenter'
    case 'mouseLeave':  return 'mouseleave'
    // Non-DOM events (slide-level or custom) — handled separately
    default: return null
  }
}
