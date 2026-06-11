import { Model } from 'mongoose';
import type { IPairingCode } from '~/types/participant';
import pairingCodeSchema from '~/schema/pairingCode';

export function createPairingCodeModel(mongoose: typeof import('mongoose')): Model<IPairingCode> {
  return (
    mongoose.models.PairingCode || mongoose.model<IPairingCode>('PairingCode', pairingCodeSchema)
  );
}
