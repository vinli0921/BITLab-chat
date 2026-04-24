import { Schema } from 'mongoose';
import type { IAdEvent } from '~/types/adEvent';
import { AD_EVENT_TYPES, PRODUCT_SOURCES } from '~/types/adEvent';

const adEventSchema = new Schema<IAdEvent>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    studyId: { type: String, required: true },
    variant: { type: String, required: true },
    eventType: {
      type: String,
      required: true,
      enum: AD_EVENT_TYPES,
    },
    productSource: {
      type: String,
      required: true,
      enum: PRODUCT_SOURCES,
    },
    productId: { type: String },
    productName: { type: String },
    queryText: { type: String },
    dwellTimeMs: { type: Number },
    hoverTimeMs: { type: Number },
    scrollDepthPercent: { type: Number, min: 0, max: 100 },
    linkUrl: { type: String, maxlength: 500 },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

adEventSchema.index({ userId: 1, studyId: 1 });
adEventSchema.index({ studyId: 1, variant: 1, eventType: 1 });

export default adEventSchema;
