import type { Types, Document } from 'mongoose';

export const PARTICIPANT_MAPPING_SOURCES = ['beacon', 'pairing'] as const;
export type ParticipantMappingSource = (typeof PARTICIPANT_MAPPING_SOURCES)[number];

export interface IParticipantMapping extends Document {
  participantId: string;
  userId: Types.ObjectId;
  studyId: string;
  source: ParticipantMappingSource;
  consentVersion?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPairingCode extends Document {
  code: string;
  userId: Types.ObjectId;
  studyId: string;
  expiresAt: Date;
  usedAt?: Date;
}
