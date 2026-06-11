import mongoose from 'mongoose';
import { createModels } from '@librechat/data-schemas';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { processExtensionBatch } from './extension';
import { upsertBeaconMapping } from './pairing';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  createModels(mongoose);
  await mongoose.models.ResearchEvent.init();
  await mongoose.models.ParticipantMapping.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.models.ResearchEvent.deleteMany({});
  await mongoose.models.ParticipantMapping.deleteMany({});
});

function rawEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: `ext-${Math.random().toString(36).slice(2)}`,
    type: 'tab_switch',
    tsWall: Date.now(),
    tsMono: 12.5,
    platformName: 'chatgpt',
    sessionId: 'session_1',
    ...overrides,
  };
}

describe('processExtensionBatch', () => {
  it('maps raw events to envelopes and resolves userId for mapped participants', async () => {
    const uid = new mongoose.Types.ObjectId().toString();
    await upsertBeaconMapping({
      participantId: 'p-9',
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
    });

    const result = await processExtensionBatch({
      participantId: 'p-9',
      sessionId: 'session_1',
      events: [rawEvent(), rawEvent({ type: 'page_load' })],
      studyId: 'study-1',
      db: mongoose,
    });
    expect(result.inserted).toBe(2);

    const docs = await mongoose.models.ResearchEvent.find({}).sort({ eventType: 1 }).lean();
    expect(docs).toHaveLength(2);
    const tabSwitchDoc = docs.find(
      (d) => (d as { eventType?: string }).eventType === 'tab_switch',
    ) as
      | {
          source: string;
          participantId: string;
          userId?: { toString(): string };
          eventType: string;
        }
      | undefined;
    expect(tabSwitchDoc?.source).toBe('extension');
    expect(tabSwitchDoc?.participantId).toBe('p-9');
    expect(tabSwitchDoc?.userId?.toString()).toBe(uid);
    expect(tabSwitchDoc?.eventType).toBe('tab_switch');
  });

  it('quarantines unmapped participants (no userId) instead of dropping events', async () => {
    const result = await processExtensionBatch({
      participantId: 'unknown-participant',
      sessionId: 'session_1',
      events: [rawEvent()],
      studyId: 'study-1',
      db: mongoose,
    });
    expect(result.inserted).toBe(1);
    const [doc] = await mongoose.models.ResearchEvent.find({}).lean();
    expect(doc.userId).toBeUndefined();
    expect(doc.participantId).toBe('unknown-participant');
  });

  it('upserts a beacon mapping from identity_bridge events in the batch', async () => {
    const uid = new mongoose.Types.ObjectId().toString();
    await processExtensionBatch({
      participantId: 'p-new',
      sessionId: 'session_1',
      events: [rawEvent({ type: 'identity_bridge', appUserId: uid })],
      studyId: 'study-1',
      db: mongoose,
    });
    const mapping = (await mongoose.models.ParticipantMapping.findOne({
      participantId: 'p-new',
    }).lean()) as { userId: { toString(): string }; source: string } | null;
    expect(mapping?.userId.toString()).toBe(uid);
    expect(mapping?.source).toBe('beacon');

    const bridgeDoc = await mongoose.models.ResearchEvent.findOne({
      eventType: 'identity_bridge',
    }).lean();
    expect(bridgeDoc).not.toBeNull();
    expect((bridgeDoc as { payload?: Record<string, unknown> }).payload?.appUserId).toBeUndefined();
  });

  it('flags events that arrive without capture timestamps', async () => {
    const result = await processExtensionBatch({
      participantId: 'p-legacy',
      events: [{ type: 'tab_switch' }],
      studyId: 'study-1',
      db: mongoose,
    });
    expect(result.inserted).toBe(1);
    const [doc] = await mongoose.models.ResearchEvent.find({}).lean();
    expect((doc as { payload?: Record<string, unknown> }).payload?.tsWallSynthetic).toBe(true);
  });
});
