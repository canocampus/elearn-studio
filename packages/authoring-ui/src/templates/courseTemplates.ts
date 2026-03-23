/**
 * Built-in course templates for the New Course dialog (T043.1–4).
 * User-defined templates (T043.5) are persisted in localStorage.
 */

import type { BaseWidget, Slide } from '../types/course'

/** A template widget — id and actions are generated at apply time. */
type TemplateWidget = Omit<BaseWidget, 'id' | 'actions'>

interface TemplateSlide {
  title: string
  widgets: TemplateWidget[]
}

export interface CourseTemplate {
  id: string
  name: string
  description: string
  icon: string
  isBuiltIn: boolean
  slides: TemplateSlide[]
}

const STORAGE_KEY = 'elearn-studio:user-templates'

// ── ID helpers ────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Apply ─────────────────────────────────────────────────────────────────────

/** Convert template slides into proper Slide[] with fresh IDs. */
export function applyTemplate(template: CourseTemplate): Slide[] {
  return template.slides.map(ts => ({
    id: `slide-${makeId()}`,
    title: ts.title,
    widgets: ts.widgets.map(tw => ({
      ...tw,
      id: `w-${makeId()}`,
      actions: [],
    })),
    actions: [],
  }))
}

// ── Built-in templates ────────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: CourseTemplate[] = [
  // ── 1. Linear Course ───────────────────────────────────────────────────────
  {
    id: 'linear-course',
    name: 'Linear Course',
    description: 'Title → content pages → quiz → results',
    icon: '📖',
    isBuiltIn: true,
    slides: [
      {
        title: 'Title',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 220, width: 800, height: 120 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h1 style="text-align:center;font-size:36px">Course Title</h1>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 212, y: 360, width: 600, height: 60 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p style="text-align:center;color:#666">Course subtitle or description</p>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: false, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Introduction',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 60, width: 864, height: 60 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>Introduction</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 80, y: 140, width: 864, height: 480 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p>Add your course introduction here.</p><ul><li>Key point 1</li><li>Key point 2</li><li>Key point 3</li></ul>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Main Content',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 60, width: 864, height: 60 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>Main Content</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 80, y: 140, width: 460, height: 480 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p>Add your main content here.</p>' },
            extendedProperties: {},
          },
          {
            type: 'image',
            bounds: { x: 560, y: 140, width: 384, height: 260 },
            layer: 2, visible: true,
            properties: { src: '', alt: 'Image placeholder' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 3, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Knowledge Check',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 40, width: 864, height: 50 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>Knowledge Check</h2>' },
            extendedProperties: {},
          },
          {
            type: 'question-mc',
            bounds: { x: 80, y: 100, width: 864, height: 500 },
            layer: 1, visible: true,
            properties: {
              questionText: 'Enter your question here.',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctIndices: [0],
              feedbackCorrect: 'Correct!',
              feedbackIncorrect: 'Incorrect. Try again.',
              maxAttempts: 2,
              weight: 100,
            },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Results',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 200, width: 800, height: 80 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2 style="text-align:center">Course Complete!</h2>' },
            extendedProperties: {},
          },
          {
            type: 'score-field',
            bounds: { x: 312, y: 320, width: 400, height: 60 },
            layer: 1, visible: true,
            properties: {},
            extendedProperties: {},
          },
          {
            type: 'score-quiz',
            bounds: { x: 362, y: 420, width: 200, height: 40 },
            layer: 2, visible: true,
            properties: { label: 'Submit Score' },
            extendedProperties: {},
          },
          {
            type: 'done-button',
            bounds: { x: 412, y: 500, width: 200, height: 40 },
            layer: 3, visible: true,
            properties: { label: 'Exit Course' },
            extendedProperties: {},
          },
        ],
      },
    ],
  },

  // ── 2. Software Tutorial ───────────────────────────────────────────────────
  {
    id: 'software-tutorial',
    name: 'Software Tutorial',
    description: 'Welcome → overview → demo sim → practice → summary',
    icon: '💻',
    isBuiltIn: true,
    slides: [
      {
        title: 'Welcome',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 220, width: 800, height: 120 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h1 style="text-align:center">Software Tutorial</h1>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 212, y: 360, width: 600, height: 60 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p style="text-align:center">Learn how to use this software step by step</p>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: false, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Overview',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 60, width: 864, height: 60 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>What You Will Learn</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 80, y: 140, width: 864, height: 480 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p>In this tutorial you will learn how to:</p><ol><li>Navigate the application interface</li><li>Perform the main task step by step</li><li>Practice the workflow independently</li></ol>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Demonstration',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 20, width: 864, height: 50 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h3>Watch: Demo Mode</h3>' },
            extendedProperties: {},
          },
          {
            type: 'screenshot-sim',
            bounds: { x: 80, y: 80, width: 864, height: 580 },
            layer: 1, visible: true,
            properties: {},
            extendedProperties: { simId: null, mode: 'demo' },
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Practice',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 20, width: 864, height: 50 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h3>Try It: Practice Mode</h3>' },
            extendedProperties: {},
          },
          {
            type: 'screenshot-sim',
            bounds: { x: 80, y: 80, width: 864, height: 580 },
            layer: 1, visible: true,
            properties: {},
            extendedProperties: { simId: null, mode: 'practice' },
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Summary',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 200, width: 800, height: 80 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2 style="text-align:center">Tutorial Complete!</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 212, y: 300, width: 600, height: 100 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p style="text-align:center">You have completed this software tutorial. You are now ready to use the application independently.</p>' },
            extendedProperties: {},
          },
          {
            type: 'done-button',
            bounds: { x: 412, y: 460, width: 200, height: 40 },
            layer: 2, visible: true,
            properties: { label: 'Exit Tutorial' },
            extendedProperties: {},
          },
        ],
      },
    ],
  },

  // ── 3. Process Training ────────────────────────────────────────────────────
  {
    id: 'process-training',
    name: 'Process Training',
    description: 'Title → overview → interactive Phaser process flow → quiz → completion',
    icon: '⚙️',
    isBuiltIn: true,
    slides: [
      {
        title: 'Welcome',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 220, width: 800, height: 120 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h1 style="text-align:center">Process Training</h1>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 212, y: 360, width: 600, height: 60 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p style="text-align:center">Interactive process flow training with step-by-step guidance</p>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: false, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Process Overview',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 60, width: 864, height: 60 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>Process Overview</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 80, y: 140, width: 864, height: 480 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p>This training walks you through the key steps of the process:</p><ol><li>Learn each step in sequence</li><li>Understand decision points</li><li>Practice the complete workflow interactively</li></ol>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Interactive Process',
        widgets: [
          {
            type: 'phaser-sim',
            bounds: { x: 80, y: 40, width: 864, height: 640 },
            layer: 0, visible: true,
            properties: {},
            extendedProperties: {
              simType: 'process-flow',
              mode: 'practice',
              passingScore: 70,
              sceneDef: null,
            },
          },
        ],
      },
      {
        title: 'Knowledge Check',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 40, width: 864, height: 50 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2>Knowledge Check</h2>' },
            extendedProperties: {},
          },
          {
            type: 'question-mc',
            bounds: { x: 80, y: 100, width: 864, height: 500 },
            layer: 1, visible: true,
            properties: {
              questionText: 'What is the first step in this process?',
              options: ['Step A', 'Step B', 'Step C', 'Step D'],
              correctIndices: [0],
              feedbackCorrect: 'Correct! Step A is the starting point.',
              feedbackIncorrect: 'Not quite. Review the process flow.',
              maxAttempts: 2,
              weight: 100,
            },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Completion',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 200, width: 800, height: 80 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2 style="text-align:center">Training Complete!</h2>' },
            extendedProperties: {},
          },
          {
            type: 'score-field',
            bounds: { x: 312, y: 320, width: 400, height: 60 },
            layer: 1, visible: true,
            properties: {},
            extendedProperties: {},
          },
          {
            type: 'score-quiz',
            bounds: { x: 362, y: 420, width: 200, height: 40 },
            layer: 2, visible: true,
            properties: { label: 'Submit Score' },
            extendedProperties: {},
          },
          {
            type: 'done-button',
            bounds: { x: 412, y: 500, width: 200, height: 40 },
            layer: 3, visible: true,
            properties: { label: 'Exit Training' },
            extendedProperties: {},
          },
        ],
      },
    ],
  },

  // ── 4. Assessment Only ─────────────────────────────────────────────────────
  {
    id: 'assessment-only',
    name: 'Assessment Only',
    description: 'Instructions + 3 question slides + results',
    icon: '📝',
    isBuiltIn: true,
    slides: [
      {
        title: 'Instructions',
        widgets: [
          {
            type: 'text',
            bounds: { x: 80, y: 100, width: 864, height: 80 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2 style="text-align:center">Assessment</h2>' },
            extendedProperties: {},
          },
          {
            type: 'text',
            bounds: { x: 80, y: 200, width: 864, height: 360 },
            layer: 1, visible: true,
            properties: { htmlContent: '<p style="text-align:center">This assessment contains multiple questions. Read each carefully before answering.</p><ul style="margin-top:20px"><li>Limited attempts per question</li><li>Score reported to the LMS on completion</li></ul>' },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 2, visible: true,
            properties: { showPrev: false, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Question 1',
        widgets: [
          {
            type: 'question-mc',
            bounds: { x: 80, y: 60, width: 864, height: 580 },
            layer: 0, visible: true,
            properties: {
              questionText: 'Question 1: Enter your question here.',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctIndices: [0],
              feedbackCorrect: 'Correct!',
              feedbackIncorrect: 'Incorrect. Review the material.',
              maxAttempts: 1,
              weight: 33,
            },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 1, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Question 2',
        widgets: [
          {
            type: 'question-mc',
            bounds: { x: 80, y: 60, width: 864, height: 580 },
            layer: 0, visible: true,
            properties: {
              questionText: 'Question 2: Enter your question here.',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctIndices: [0],
              feedbackCorrect: 'Correct!',
              feedbackIncorrect: 'Incorrect. Review the material.',
              maxAttempts: 1,
              weight: 33,
            },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 1, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Question 3',
        widgets: [
          {
            type: 'question-mc',
            bounds: { x: 80, y: 60, width: 864, height: 580 },
            layer: 0, visible: true,
            properties: {
              questionText: 'Question 3: Enter your question here.',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctIndices: [0],
              feedbackCorrect: 'Correct!',
              feedbackIncorrect: 'Incorrect. Review the material.',
              maxAttempts: 1,
              weight: 34,
            },
            extendedProperties: {},
          },
          {
            type: 'nav-buttons',
            bounds: { x: 800, y: 700, width: 180, height: 36 },
            layer: 1, visible: true,
            properties: { showPrev: true, showNext: true },
            extendedProperties: {},
          },
        ],
      },
      {
        title: 'Results',
        widgets: [
          {
            type: 'text',
            bounds: { x: 112, y: 180, width: 800, height: 80 },
            layer: 0, visible: true,
            properties: { htmlContent: '<h2 style="text-align:center">Assessment Complete!</h2>' },
            extendedProperties: {},
          },
          {
            type: 'score-field',
            bounds: { x: 312, y: 290, width: 400, height: 60 },
            layer: 1, visible: true,
            properties: {},
            extendedProperties: {},
          },
          {
            type: 'score-quiz',
            bounds: { x: 362, y: 380, width: 200, height: 40 },
            layer: 2, visible: true,
            properties: { label: 'Submit Score' },
            extendedProperties: {},
          },
          {
            type: 'done-button',
            bounds: { x: 412, y: 460, width: 200, height: 40 },
            layer: 3, visible: true,
            properties: { label: 'Exit Assessment' },
            extendedProperties: {},
          },
        ],
      },
    ],
  },
]

// ── User template persistence (localStorage) ──────────────────────────────────

export function getUserTemplates(): CourseTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CourseTemplate[]
  } catch {
    return []
  }
}

export function saveUserTemplate(template: CourseTemplate): void {
  const existing = getUserTemplates().filter(t => t.id !== template.id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, template]))
}

export function deleteUserTemplate(id: string): void {
  const existing = getUserTemplates().filter(t => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

export function getAllTemplates(): CourseTemplate[] {
  return [...BUILTIN_TEMPLATES, ...getUserTemplates()]
}
