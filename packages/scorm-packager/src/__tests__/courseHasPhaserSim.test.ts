/**
 * Unit tests for courseHasPhaserSim — T035
 */

import { describe, it, expect } from 'vitest'
import { courseHasPhaserSim, type CourseDoc } from '../index'

function makeWidget(type: string) {
  return {
    id: `w-${type}`,
    type,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    layer: 0,
    visible: true,
    properties: {},
    extendedProperties: {},
  }
}

function makeCourse(widgetTypes: string[]): CourseDoc {
  return {
    _id: 'course-1',
    title: 'Test',
    slides: [
      { id: 's1', title: 'Slide 1', widgets: widgetTypes.map(makeWidget) },
    ],
    settings: { width: 1024, height: 768, passingScore: 80 },
    metadata: { version: '1.0', masteryScore: 80 },
  }
}

describe('courseHasPhaserSim', () => {
  it('returns false for a course with no widgets', () => {
    const course = makeCourse([])
    expect(courseHasPhaserSim(course)).toBe(false)
  })

  it('returns false for a course with only non-phaser widgets', () => {
    const course = makeCourse(['text', 'image', 'question-mc', 'screenshot-sim'])
    expect(courseHasPhaserSim(course)).toBe(false)
  })

  it('returns true when any widget is phaser-sim', () => {
    const course = makeCourse(['text', 'phaser-sim'])
    expect(courseHasPhaserSim(course)).toBe(true)
  })

  it('returns true when the only widget is phaser-sim', () => {
    const course = makeCourse(['phaser-sim'])
    expect(courseHasPhaserSim(course)).toBe(true)
  })

  it('returns true when phaser-sim is on a second slide', () => {
    const course: CourseDoc = {
      ...makeCourse(['text']),
      slides: [
        { id: 's1', title: 'Slide 1', widgets: [makeWidget('text')] },
        { id: 's2', title: 'Slide 2', widgets: [makeWidget('phaser-sim')] },
      ],
    }
    expect(courseHasPhaserSim(course)).toBe(true)
  })

  it('returns false for an empty slides array', () => {
    const course: CourseDoc = { ...makeCourse([]), slides: [] }
    expect(courseHasPhaserSim(course)).toBe(false)
  })

  it('returns true when every slide has multiple widgets and one is phaser-sim', () => {
    // Stress test: verifies the some/some short-circuit works across many slides + widgets
    const slides = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      title: `Slide ${i}`,
      widgets: [
        makeWidget('text'),
        makeWidget('image'),
        makeWidget('question-mc'),
        ...(i === 3 ? [makeWidget('phaser-sim')] : []),
      ],
    }))
    const course: CourseDoc = { ...makeCourse([]), slides }
    expect(courseHasPhaserSim(course)).toBe(true)
  })

  it('returns false when every slide has multiple widgets but none is phaser-sim', () => {
    const slides = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      title: `Slide ${i}`,
      widgets: [makeWidget('text'), makeWidget('image'), makeWidget('screenshot-sim')],
    }))
    const course: CourseDoc = { ...makeCourse([]), slides }
    expect(courseHasPhaserSim(course)).toBe(false)
  })
})
