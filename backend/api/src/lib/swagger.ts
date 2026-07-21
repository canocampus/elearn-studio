/**
 * swagger.ts — OpenAPI 3.0 spec generation via swagger-jsdoc.
 *
 * The spec object is built once at startup and shared by:
 *  - Swagger UI (GET /docs, dev only)
 *  - gen:openapi script (writes openapi.json for openapi-typescript)
 */

import swaggerJsdoc from 'swagger-jsdoc'
import path from 'path'
// TD-024: the Widget type enum is DERIVED from the shared contract — adding a
// widget type updates the OpenAPI (and the generated client) automatically.
import { WIDGET_TYPES } from '@elearn-studio/shared-types'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'eLearn Studio API',
      version: '1.0.0',
      description:
        'REST API for eLearn Studio — course authoring, slide management, asset storage, ' +
        'simulation import, and SCORM packaging.',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
          },
        },
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Something went wrong' },
          },
        },
        PaginationMeta: {
          type: 'object',
          required: ['total', 'limit', 'skip'],
          properties: {
            total: { type: 'integer', example: 42 },
            limit: { type: 'integer', example: 50 },
            skip:  { type: 'integer', example: 0 },
          },
        },
        UserInfo: {
          type: 'object',
          required: ['id', 'email', 'role'],
          properties: {
            id:    { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            role:  { type: 'string', enum: ['admin', 'author'], example: 'author' },
          },
        },
        Course: {
          type: 'object',
          required: ['_id', 'title', 'slides', 'createdAt', 'updatedAt'],
          properties: {
            _id:       { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            title:     { type: 'string', example: 'Intro to SQL' },
            slides:    { type: 'array', items: { '$ref': '#/components/schemas/Slide' } },
            templates: { type: 'array', items: { type: 'object' } },
            resources: { type: 'array', items: { type: 'object' } },
            settings:  { type: 'object' },
            metadata:  { type: 'object' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CourseSummary: {
          type: 'object',
          required: ['_id', 'title', 'updatedAt'],
          properties: {
            _id:       { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            title:     { type: 'string', example: 'Intro to SQL' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Slide: {
          type: 'object',
          required: ['id', 'title', 'widgets'],
          properties: {
            id:         { type: 'string', example: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789' },
            title:      { type: 'string', example: 'Introduction' },
            templateId: { type: 'string', description: 'SlideTemplate this slide was created from.' },
            widgets:    { type: 'array', items: { '$ref': '#/components/schemas/Widget' } },
            transition: { type: 'object', additionalProperties: true },
            thumbnail: { type: 'string', nullable: true },
          },
        },
        // TD-024 (audit finding 3): Widget/ActionSequence were published as
        // generic objects, so the generated client typed slide content as
        // Record<string, never> and the compiler could not see the Course
        // domain at all — the missing `name` of TD-019b was invisible here.
        Bounds: {
          type: 'object',
          required: ['x', 'y', 'width', 'height'],
          properties: {
            x:      { type: 'number', example: 100 },
            y:      { type: 'number', example: 200 },
            width:  { type: 'number', example: 320 },
            height: { type: 'number', example: 180 },
          },
        },
        ActionNode: {
          type: 'object',
          required: ['type'],
          properties: {
            id:           { type: 'string', example: 'act-1' },
            type:         { type: 'string', example: 'navigate' },
            params:       { type: 'object', additionalProperties: true },
            children:     { type: 'array', items: { '$ref': '#/components/schemas/ActionNode' } },
            elseChildren: { type: 'array', items: { '$ref': '#/components/schemas/ActionNode' } },
          },
        },
        ActionSequence: {
          type: 'object',
          required: ['event', 'actions'],
          properties: {
            event:   { type: 'string', example: 'click' },
            actions: { type: 'array', items: { '$ref': '#/components/schemas/ActionNode' } },
          },
        },
        Widget: {
          type: 'object',
          required: ['id', 'type', 'bounds', 'layer', 'visible', 'properties', 'extendedProperties'],
          properties: {
            id:     { type: 'string', example: 'w1' },
            type:   { type: 'string', enum: [...WIDGET_TYPES], example: 'button' },
            name: {
              type: 'string',
              description:
                'Author-assigned display name (Props panel → Name). Optional for courses saved before the field existed (TD-019b).',
              example: 'StartBtn',
            },
            bounds:             { '$ref': '#/components/schemas/Bounds' },
            layer:              { type: 'number', example: 0 },
            visible:            { type: 'boolean', example: true },
            properties:         { type: 'object', additionalProperties: true },
            actions:            { type: 'array', items: { '$ref': '#/components/schemas/ActionSequence' } },
            extendedProperties: { type: 'object', additionalProperties: true },
          },
        },
        AuditEntry: {
          type: 'object',
          required: ['_id', 'courseId', 'action', 'actorId', 'actorEmail', 'createdAt'],
          properties: {
            _id:        { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            courseId:   { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d2' },
            action: {
              type: 'string',
              enum: ['course.create', 'course.update', 'course.delete', 'slide.create', 'slide.update', 'slide.delete', 'slide.reorder'],
            },
            actorId:    { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d3' },
            actorEmail: { type: 'string', format: 'email', example: 'author@example.com' },
            detail:     { type: 'object', additionalProperties: true },
            createdAt:  { type: 'string', format: 'date-time' },
          },
        },
        Asset: {
          type: 'object',
          required: ['url', 'objectName', 'originalName'],
          properties: {
            url:          { type: 'string', example: '/assets/uuid.png' },
            objectName:   { type: 'string', example: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789.png' },
            originalName: { type: 'string', example: 'photo.png' },
          },
        },
        SimHotspot: {
          type: 'object',
          required: ['x', 'y', 'width', 'height', 'tolerance'],
          properties: {
            x:         { type: 'number', example: 320 },
            y:         { type: 'number', example: 180 },
            width:     { type: 'number', example: 80 },
            height:    { type: 'number', example: 40 },
            tolerance: { type: 'number', example: 8 },
          },
        },
        AuthoredSimStep: {
          type: 'object',
          required: [
            'id', 'order', 'description', 'instruction', 'hint',
            'correctFeedback', 'incorrectFeedback', 'demoDelay', 'maxAttempts',
            'screenshotKey', 'screenshotUrl', 'hotspot', 'interactionType',
          ],
          properties: {
            id:                { type: 'string',  example: 'step-0' },
            order:             { type: 'integer', example: 0 },
            description:       { type: 'string',  example: "Click 'Submit'" },
            instruction:       { type: 'string',  example: 'Click the Submit button to send the form.' },
            hint:              { type: 'string',  example: 'Look near the bottom-right of the form.' },
            correctFeedback:   { type: 'string',  example: 'Correct!' },
            incorrectFeedback: { type: 'string',  example: 'Try again.' },
            demoDelay:         { type: 'integer', example: 1500 },
            maxAttempts:       { type: 'integer', example: -1 },
            screenshotKey:     { type: 'string',  example: 'recordings/abc-123/screenshots/step-0.png' },
            screenshotUrl:     { type: 'string',  example: '/simulations/screenshot?key=recordings%2Fabc-123%2Fscreenshots%2Fstep-0.png' },
            hotspot:           { '$ref': '#/components/schemas/SimHotspot' },
            interactionType:   { type: 'string',  enum: ['click', 'hover', 'type'], example: 'click' },
            expectedText:      { type: 'string',  nullable: true, description: 'Required text for type-interaction steps; absent otherwise.' },
          },
        },
        SimConfig: {
          type: 'object',
          required: ['mode', 'passingScore', 'steps'],
          properties: {
            mode:         { type: 'string', enum: ['demo', 'practice', 'assessment'] },
            passingScore: { type: 'number', example: 80 },
            steps:        { type: 'array', items: { '$ref': '#/components/schemas/AuthoredSimStep' } },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    // Absolute glob so it works regardless of cwd during script execution
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
}

export const swaggerSpec = swaggerJsdoc(options)
