import type {
  ResearchPayload,
  ResearchPayloadValue,
  ResearchPayloadObject,
} from 'librechat-data-provider';
import type { Types, Document } from 'mongoose';

export const RESEARCH_EVENT_SOURCES = ['app-client', 'app-server', 'extension'] as const;
export type ResearchEventSource = (typeof RESEARCH_EVENT_SOURCES)[number];

/**
 * Re-exported aliases for the canonical research-payload types, which now live
 * in `librechat-data-provider` as the single source of truth. The names are
 * preserved so `packages/api` and other existing consumers compile unchanged.
 */
export type ResearchEventPayloadValue = ResearchPayloadValue;
export type ResearchEventPayloadObject = ResearchPayloadObject;
export type ResearchEventPayload = ResearchPayload;

export interface IResearchEvent extends Document {
  eventId: string;
  userId?: Types.ObjectId;
  participantId?: string;
  source: ResearchEventSource;
  studyId: string;
  variant?: string;
  platform?: string;
  sessionId?: string;
  conversationId?: string;
  messageId?: string;
  eventType: string;
  tsWall: Date;
  tsMono?: number;
  tsServerRecv: Date;
  schemaVersion: number;
  payload?: ResearchEventPayload;
}
