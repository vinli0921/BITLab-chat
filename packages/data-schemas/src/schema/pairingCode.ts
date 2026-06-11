import { Schema } from 'mongoose';
import type { IPairingCode } from '~/types/participant';

const pairingCodeSchema: Schema<IPairingCode> = new Schema<IPairingCode>(
  {
    code: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    studyId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

pairingCodeSchema.index({ code: 1 }, { unique: true });
pairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default pairingCodeSchema;
