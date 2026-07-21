import mongoose, { Schema } from 'mongoose'
import { WIDGET_TYPES } from './Widget'

// M-01 fix: all Bounds fields are required
const BoundsSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false }
)

const ActionSchema = new Schema(
  {
    id: { type: String },
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    children: { type: [Schema.Types.Mixed], default: [] },
    elseChildren: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
)

const ActionSequenceSchema = new Schema(
  {
    event: { type: String, required: true },
    actions: { type: [ActionSchema], default: [] },
  },
  { _id: false }
)

const WidgetSchema = new Schema(
  {
    id: { type: String, required: true },
    // M-03 fix: enforce enum to match WidgetType union
    type: { type: String, required: true, enum: WIDGET_TYPES },
    // TD-019b: author-assigned display name (BaseWidget.name). Its absence
    // here made Mongoose (strict mode) silently DROP the name on every save —
    // the root cause behind the whole author-name-loss family: any load
    // served from the database came back nameless and the editor re-saved
    // the type default over the author's name.
    name: String,
    bounds: { type: BoundsSchema, required: true },
    layer: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    actions: { type: [ActionSequenceSchema], default: [] },
    extendedProperties: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
)

const SlideSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    templateId: String,
    widgets: { type: [WidgetSchema], default: [] },
    // TD-027: slide-level `actions` retired — the fossil field (TD-017) was
    // never wired; slide lifecycle events live on WIDGET sequences. Old docs
    // still carrying empty arrays are inert: strict mode drops the field on
    // every future save and it is no longer projected into responses.
    transition: Schema.Types.Mixed,
    // T013.6: serialized HTML thumbnail (srcdoc string)
    thumbnail: String,
  },
  { _id: false }
)

const CourseSettingsSchema = new Schema(
  {
    width: { type: Number, default: 1024 },
    height: { type: Number, default: 768 },
    passingScore: { type: Number, default: 80 },
    allowReview: { type: Boolean, default: true },
    navigationMode: { type: String, enum: ['free', 'linear-strict'], default: 'free' },
    requireAllSlides: { type: Boolean, default: false },
  },
  { _id: false }
)

const SCORMMetadataSchema = new Schema(
  {
    identifier: String,
    version: { type: String, default: '1.0' },
    masteryScore: { type: Number, default: 80 },
  },
  { _id: false }
)

const SharedActionSequenceSchema = new Schema(
  {
    name: { type: String, required: true },
    actions: { type: [ActionSchema], default: [] },
  },
  { _id: false }
)

const CourseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slides: { type: [SlideSchema], default: [] },
    templates: { type: [Schema.Types.Mixed], default: [] },
    resources: { type: [Schema.Types.Mixed], default: [] },
    settings: { type: CourseSettingsSchema, default: () => ({}) },
    metadata: { type: SCORMMetadataSchema, default: () => ({}) },
    sharedSequences: { type: [SharedActionSequenceSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Conditional registration prevents OverwriteModelError when modules are re-imported
// (e.g. vitest module isolation between test files)
export const Course = mongoose.models['Course'] ?? mongoose.model('Course', CourseSchema)
