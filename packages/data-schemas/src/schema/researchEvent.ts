import { Schema } from 'mongoose';
import type { IResearchEvent } from '~/types/researchEvent';
import { RESEARCH_EVENT_SOURCES } from '~/types/researchEvent';

const researchEventSchema: Schema<IResearchEvent> = new Schema<IResearchEvent>(
  {
    eventId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId },
    participantId: { type: String },
    source: { type: String, required: true, enum: RESEARCH_EVENT_SOURCES },
    studyId: { type: String, required: true },
    variant: { type: String },
    platform: { type: String },
    sessionId: { type: String },
    conversationId: { type: String },
    messageId: { type: String },
    eventType: { type: String, required: true },
    tsWall: { type: Date, required: true },
    tsMono: { type: Number },
    tsServerRecv: { type: Date, required: true },
    schemaVersion: { type: Number, required: true, default: 1 },
  },
  { timestamps: false },
);

// payload added via add(): inlining Mixed in the typed definition triggers TS2589 (deep instantiation of the recursive payload type)
researchEventSchema.add({ payload: Schema.Types.Mixed });

researchEventSchema.index({ eventId: 1 }, { unique: true });
researchEventSchema.index({ userId: 1, tsWall: 1 });
researchEventSchema.index({ participantId: 1, tsWall: 1 });
researchEventSchema.index({ studyId: 1, eventType: 1, tsWall: 1 });

export default researchEventSchema;
