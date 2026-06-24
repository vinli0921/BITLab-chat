import { createIndexesWithRetry } from '@librechat/data-schemas';
import type mongoose from 'mongoose';

const RESEARCH_MODELS = ['ResearchEvent', 'ParticipantMapping', 'PairingCode'] as const;

/**
 * Builds research-layer indexes explicitly at startup. Models are registered before
 * the Mongo connection opens (with `bufferCommands: false`), so Mongoose's automatic
 * index builds fail silently. These indexes are load-bearing — unique `eventId`
 * provides ingest idempotency, unique `participantId` guards identity integrity,
 * and the PairingCode TTL enforces code expiry — so they cannot rely on autoIndex.
 */
export async function ensureResearchIndexes(db: typeof mongoose): Promise<void> {
  for (const name of RESEARCH_MODELS) {
    const model = db.models[name];
    if (model == null) {
      throw new Error(`[ensureResearchIndexes] Model ${name} is not registered`);
    }
    await createIndexesWithRetry(model);
  }
}
