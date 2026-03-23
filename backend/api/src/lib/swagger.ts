/**
 * swagger.ts — OpenAPI 3.0 spec generation via swagger-jsdoc.
 *
 * The spec object is built once at startup and shared by:
 *  - Swagger UI (GET /docs, dev only)
 *  - gen:openapi script (writes openapi.json for openapi-typescript)
 */

import swaggerJsdoc from 'swagger-jsdoc'
import path from 'path'

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
          required: ['id', 'title'],
          properties: {
            id:        { type: 'string', example: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789' },
            title:     { type: 'string', example: 'Introduction' },
            widgets:   { type: 'array', items: { type: 'object' } },
            actions:   { type: 'array', items: { type: 'object' } },
            thumbnail: { type: 'string', nullable: true },
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
        SimConfig: {
          type: 'object',
          required: ['sessionId', 'mode', 'passingScore', 'steps'],
          properties: {
            sessionId:    { type: 'string' },
            mode:         { type: 'string', enum: ['demo', 'practice', 'assessment'] },
            passingScore: { type: 'number', example: 80 },
            steps:        { type: 'array', items: { type: 'object' } },
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
