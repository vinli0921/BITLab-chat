import adEventSchema from '~/schema/adEvent';
import type { IAdEvent } from '~/types/adEvent';

export function createAdEventModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AdEvent || mongoose.model<IAdEvent>('AdEvent', adEventSchema);
}
