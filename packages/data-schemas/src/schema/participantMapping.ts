import { Schema } from 'mongoose';
import type { IParticipantMapping } from '~/types/participant';
import { PARTICIPANT_MAPPING_SOURCES } from '~/types/participant';

const participantMappingSchema: Schema<IParticipantMapping> = new Schema<IParticipantMapping>(
  {
    participantId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    studyId: { type: String, required: true },
    source: { type: String, required: true, enum: PARTICIPANT_MAPPING_SOURCES },
    consentVersion: { type: String },
  },
  { timestamps: true },
);

participantMappingSchema.index({ participantId: 1 }, { unique: true });

export default participantMappingSchema;
