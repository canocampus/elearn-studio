import { describe, it, expect } from 'vitest'
import {
  createFeedbackQueue,
  enqueueFeedback,
  flushFeedback,
  feedbackForQuestion,
} from '../feedback/delayed-feedback'

describe('createFeedbackQueue', () => {
  it('returns empty queue', () => {
    const q = createFeedbackQueue()
    expect(q.items).toHaveLength(0)
  })
})

describe('enqueueFeedback', () => {
  it('adds entry to queue immutably', () => {
    const q0 = createFeedbackQueue()
    const q1 = enqueueFeedback(q0, { questionId: 'q1', message: 'Good!', correct: true })
    expect(q0.items).toHaveLength(0) // original unchanged
    expect(q1.items).toHaveLength(1)
    expect(q1.items[0].questionId).toBe('q1')
    expect(q1.items[0].correct).toBe(true)
    expect(q1.items[0].queuedAt).toBeGreaterThan(0)
  })

  it('accumulates multiple entries', () => {
    let q = createFeedbackQueue()
    q = enqueueFeedback(q, { questionId: 'q1', message: 'A', correct: true })
    q = enqueueFeedback(q, { questionId: 'q2', message: 'B', correct: false })
    expect(q.items).toHaveLength(2)
  })
})

describe('flushFeedback', () => {
  it('returns all items and resets queue', () => {
    let q = createFeedbackQueue()
    q = enqueueFeedback(q, { questionId: 'q1', message: 'Msg', correct: true })
    const { flushed, queue } = flushFeedback(q)
    expect(flushed).toHaveLength(1)
    expect(queue.items).toHaveLength(0)
  })

  it('returns empty array for empty queue', () => {
    const { flushed } = flushFeedback(createFeedbackQueue())
    expect(flushed).toHaveLength(0)
  })
})

describe('feedbackForQuestion', () => {
  it('filters by questionId', () => {
    let q = createFeedbackQueue()
    q = enqueueFeedback(q, { questionId: 'q1', message: 'A', correct: true })
    q = enqueueFeedback(q, { questionId: 'q2', message: 'B', correct: false })
    q = enqueueFeedback(q, { questionId: 'q1', message: 'C', correct: false })

    const items = feedbackForQuestion(q, 'q1')
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.questionId === 'q1')).toBe(true)
  })

  it('returns empty array when no match', () => {
    const q = createFeedbackQueue()
    expect(feedbackForQuestion(q, 'nope')).toHaveLength(0)
  })
})
