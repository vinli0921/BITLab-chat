import { randomUUID } from 'node:crypto';
import type { ResearchEventPayload, ResearchEventPayloadValue } from '@librechat/data-schemas';
import type mongoose from 'mongoose';
import type { ResearchIngestResult } from './service';
import { resolveParticipant, upsertBeaconMapping } from './pairing';
import { logResearchEvents } from './service';

const ENVELOPE_KEYS = new Set([
  'eventId',
  'type',
  'tsWall',
  'tsMono',
  'tsOrigin',
  'tsBgRecv',
  'timestamp',
  'sessionId',
  'participantId',
  'platformName',
  'appUserId', // stripped: the user join lives only in ParticipantMapping
  'consentVersion', // stripped: mapping metadata, not behavioral payload
]);

export interface RawExtensionEvent {
  eventId?: string;
  type: string;
  tsWall?: number;
  timestamp?: number;
  tsMono?: number;
  sessionId?: string;
  platformName?: string;
  appUserId?: string;
  consentVersion?: string;
  [key: string]: ResearchEventPayloadValue | undefined;
}

function toPayload(raw: RawExtensionEvent): ResearchEventPayload {
  const payload: ResearchEventPayload = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ENVELOPE_KEYS.has(key) && value !== undefined) {
      payload[key] = value as ResearchEventPayloadValue;
    }
  }
  return payload;
}

function isObjectIdString(value: string | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

export async function processExtensionBatch(params: {
  participantId: string;
  sessionId?: string;
  events: RawExtensionEvent[];
  studyId: string;
  db: typeof mongoose;
}): Promise<ResearchIngestResult> {
  const { participantId, sessionId, events, studyId, db } = params;

  for (const event of events) {
    if (event.type === 'identity_bridge' && isObjectIdString(event.appUserId)) {
      await upsertBeaconMapping({
        participantId,
        userId: event.appUserId,
        studyId,
        db,
        consentVersion: event.consentVersion,
      });
    }
  }

  const userId = await resolveParticipant({ participantId, db });

  return logResearchEvents({
    events: events.map((raw) => {
      const tsWall = raw.tsWall ?? raw.timestamp;
      const payload = toPayload(raw);
      if (tsWall == null) {
        payload.tsWallSynthetic = true;
      }
      return {
        eventId: raw.eventId ?? randomUUID(),
        eventType: raw.type,
        tsWall: tsWall ?? Date.now(),
        tsMono: raw.tsMono,
        platform: raw.platformName,
        sessionId: raw.sessionId ?? sessionId,
        payload,
      };
    }),
    context: {
      source: 'extension',
      studyId,
      participantId,
      userId: userId?.toString(),
    },
    db,
  });
}
