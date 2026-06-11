import type {
  IResearchEvent,
  ResearchEventPayload,
  ResearchEventSource,
} from '@librechat/data-schemas';
import type mongoose from 'mongoose';

export const MAX_RESEARCH_BATCH = 500;

export interface ResearchEventInput {
  eventId: string;
  eventType: string;
  tsWall: number;
  tsMono?: number;
  platform?: string;
  sessionId?: string;
  conversationId?: string;
  messageId?: string;
  payload?: ResearchEventPayload;
}

export interface ResearchIngestContext {
  source: ResearchEventSource;
  studyId: string;
  variant?: string;
  userId?: string;
  participantId?: string;
}

export interface ResearchIngestResult {
  inserted: number;
  duplicates: number;
}

interface BulkWriteError extends Error {
  code?: number;
  writeErrors?: Array<{ err?: { code?: number } }>;
  result?: { insertedCount?: number };
}

export async function logResearchEvents(params: {
  events: ResearchEventInput[];
  context: ResearchIngestContext;
  db: typeof mongoose;
}): Promise<ResearchIngestResult> {
  const { events, context, db } = params;
  if (events.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }
  if (events.length > MAX_RESEARCH_BATCH) {
    throw new Error(`Research event batch exceeds ${MAX_RESEARCH_BATCH} events`);
  }

  const tsServerRecv = new Date();
  const ResearchEvent = db.models.ResearchEvent as mongoose.Model<IResearchEvent>;
  const docs = events.map((event) => ({
    eventId: event.eventId,
    userId: context.userId,
    participantId: context.participantId,
    source: context.source,
    studyId: context.studyId,
    variant: context.variant,
    platform: event.platform,
    sessionId: event.sessionId,
    conversationId: event.conversationId,
    messageId: event.messageId,
    eventType: event.eventType,
    tsWall: new Date(event.tsWall),
    tsMono: event.tsMono,
    tsServerRecv,
    schemaVersion: 1,
    payload: event.payload,
  }));

  try {
    const inserted = await ResearchEvent.insertMany(docs, { ordered: false });
    return { inserted: inserted.length, duplicates: 0 };
  } catch (error) {
    const bulkError = error as BulkWriteError;
    const writeErrors = bulkError.writeErrors ?? [];
    const allDuplicates =
      writeErrors.length > 0 && writeErrors.every((writeError) => writeError.err?.code === 11000);
    if (!allDuplicates) {
      throw error;
    }
    const inserted = bulkError.result?.insertedCount ?? docs.length - writeErrors.length;
    return { inserted, duplicates: writeErrors.length };
  }
}
