import { randomUUID, randomBytes } from 'node:crypto';
import type { IPairingCode, IParticipantMapping } from '@librechat/data-schemas';
import type { Types } from 'mongoose';
import type mongoose from 'mongoose';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DEFAULT_TTL_MS = 15 * 60 * 1000;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function createPairingCode(params: {
  userId: string;
  studyId: string;
  db: typeof mongoose;
  ttlMs?: number;
}): Promise<{ code: string; expiresAt: Date }> {
  const PairingCode = params.db.models.PairingCode as mongoose.Model<IPairingCode>;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_TTL_MS));
  await PairingCode.create({ code, userId: params.userId, studyId: params.studyId, expiresAt });
  return { code, expiresAt };
}

export async function redeemPairingCode(params: {
  code: string;
  db: typeof mongoose;
  consentVersion?: string;
}): Promise<{ participantId: string } | null> {
  const PairingCode = params.db.models.PairingCode as mongoose.Model<IPairingCode>;
  const ParticipantMapping = params.db.models
    .ParticipantMapping as mongoose.Model<IParticipantMapping>;

  const pairing = await PairingCode.findOneAndUpdate(
    { code: params.code.toUpperCase(), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (pairing == null) {
    return null;
  }

  // Each redemption mints a new participant identity by design: re-pairing after a
  // reinstall or second device yields N participantIds per user, collapsed by userId at analysis.
  const participantId = randomUUID();
  await ParticipantMapping.create({
    participantId,
    userId: pairing.userId,
    studyId: pairing.studyId,
    source: 'pairing',
    consentVersion: params.consentVersion,
  });
  return { participantId };
}

export async function resolveParticipant(params: {
  participantId: string;
  db: typeof mongoose;
}): Promise<Types.ObjectId | null> {
  const ParticipantMapping = params.db.models
    .ParticipantMapping as mongoose.Model<IParticipantMapping>;
  const mapping = await ParticipantMapping.findOne({ participantId: params.participantId }).lean();
  return mapping?.userId ?? null;
}

interface MongoError extends Error {
  code?: number;
}

export async function upsertBeaconMapping(params: {
  participantId: string;
  userId: string;
  studyId: string;
  db: typeof mongoose;
  consentVersion?: string;
}): Promise<{ conflict: boolean }> {
  const ParticipantMapping = params.db.models
    .ParticipantMapping as mongoose.Model<IParticipantMapping>;

  const existing = await ParticipantMapping.findOne({ participantId: params.participantId });
  if (existing != null) {
    if (params.consentVersion != null && existing.consentVersion !== params.consentVersion) {
      existing.consentVersion = params.consentVersion;
      await existing.save();
    }
    return { conflict: existing.userId.toString() !== params.userId };
  }

  try {
    await ParticipantMapping.create({
      participantId: params.participantId,
      userId: params.userId,
      studyId: params.studyId,
      source: 'beacon',
      consentVersion: params.consentVersion,
    });
    return { conflict: false };
  } catch (error) {
    const mongoError = error as MongoError;
    if (mongoError.code !== 11000) {
      throw error;
    }
    // Race: another concurrent insert won — read the winner and compute conflict
    const winner = await ParticipantMapping.findOne({ participantId: params.participantId });
    return { conflict: winner?.userId.toString() !== params.userId };
  }
}
