import { Model } from 'mongoose';
import type { IAdEvent } from '~/types/adEvent';
import adEventSchema from '~/schema/adEvent';

export function createAdEventModel(mongoose: typeof import('mongoose')): Model<IAdEvent> {
  return mongoose.models.AdEvent || mongoose.model<IAdEvent>('AdEvent', adEventSchema);
}
