import { Model } from 'mongoose';
import type { IParticipantMapping } from '~/types/participant';
import participantMappingSchema from '~/schema/participantMapping';

export function createParticipantMappingModel(
  mongoose: typeof import('mongoose'),
): Model<IParticipantMapping> {
  return (
    mongoose.models.ParticipantMapping ||
    mongoose.model<IParticipantMapping>('ParticipantMapping', participantMappingSchema)
  );
}
