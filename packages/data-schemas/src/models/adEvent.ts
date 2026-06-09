import { Model } from 'mongoose';
import adEventSchema from '~/schema/adEvent';
import type { IAdEvent } from '~/types/adEvent';

export function createAdEventModel(mongoose: typeof import('mongoose')): Model<IAdEvent> {
  return mongoose.models.AdEvent || mongoose.model<IAdEvent>('AdEvent', adEventSchema);
}
