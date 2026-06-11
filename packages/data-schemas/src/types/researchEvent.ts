import type { Types, Document } from 'mongoose';

export const RESEARCH_EVENT_SOURCES = ['app-client', 'app-server', 'extension'] as const;
export type ResearchEventSource = (typeof RESEARCH_EVENT_SOURCES)[number];

export type ResearchEventPayloadValue =
  | string
  | number
  | boolean
  | null
  | ResearchEventPayloadValue[]
  | ResearchEventPayloadObject;

export interface ResearchEventPayloadObject {
  [key: string]: ResearchEventPayloadValue;
}

export type ResearchEventPayload = ResearchEventPayloadObject;

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
