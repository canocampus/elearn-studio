/**
 * Delayed / deferred feedback utilities — T022
 *
 * Pure functions — no side effects, no DOM.
 * The runtime-player is responsible for rendering and flushing.
 */

import type { DeferredFeedback, FeedbackQueue } from '../types'

export function createFeedbackQueue(): FeedbackQueue {
  return { items: [] }
}

export function enqueueFeedback(
  queue: FeedbackQueue,
  entry: Omit<DeferredFeedback, 'queuedAt'>,
): FeedbackQueue {
  return {
    items: [
      ...queue.items,
      { ...entry, queuedAt: Date.now() },
    ],
  }
}

/**
 * Return all queued items and an empty queue.
 */
export function flushFeedback(queue: FeedbackQueue): {
  flushed: DeferredFeedback[]
  queue: FeedbackQueue
} {
  return {
    flushed: queue.items,
    queue: createFeedbackQueue(),
  }
}

/**
 * Return only entries for a specific question.
 */
export function feedbackForQuestion(
  queue: FeedbackQueue,
  questionId: string,
): DeferredFeedback[] {
  return queue.items.filter((item) => item.questionId === questionId)
}
