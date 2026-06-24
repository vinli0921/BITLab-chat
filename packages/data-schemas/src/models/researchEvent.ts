import { Model } from 'mongoose';
import type { IResearchEvent } from '~/types/researchEvent';
import researchEventSchema from '~/schema/researchEvent';

export function createResearchEventModel(
  mongoose: typeof import('mongoose'),
): Model<IResearchEvent> {
  return (
    mongoose.models.ResearchEvent ||
    mongoose.model<IResearchEvent>('ResearchEvent', researchEventSchema)
  );
}
