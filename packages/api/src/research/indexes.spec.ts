import mongoose from 'mongoose';
import { createModels } from '@librechat/data-schemas';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureResearchIndexes } from './indexes';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { autoIndex: false });
  createModels(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-dup',
    source: 'app-client',
    studyId: 'study-1',
    eventType: 'chat_presence',
    tsWall: new Date(),
    tsServerRecv: new Date(),
    ...overrides,
  };
}

describe('ensureResearchIndexes', () => {
  it('accepts duplicate eventIds before indexes are built (the autoIndex gap)', async () => {
    await mongoose.models.ResearchEvent.create(baseEvent());
    await mongoose.models.ResearchEvent.create(baseEvent());
    const count = await mongoose.models.ResearchEvent.countDocuments({ eventId: 'evt-dup' });
    expect(count).toBe(2);
    await mongoose.models.ResearchEvent.deleteMany({});
  });

  it('builds all load-bearing indexes', async () => {
    await ensureResearchIndexes(mongoose);

    const eventIndexes = await mongoose.models.ResearchEvent.collection.indexes();
    const eventIdIndex = eventIndexes.find((index) => index.key.eventId === 1);
    expect(eventIdIndex?.unique).toBe(true);

    const mappingIndexes = await mongoose.models.ParticipantMapping.collection.indexes();
    const participantIndex = mappingIndexes.find((index) => index.key.participantId === 1);
    expect(participantIndex?.unique).toBe(true);

    const pairingIndexes = await mongoose.models.PairingCode.collection.indexes();
    const ttlIndex = pairingIndexes.find((index) => index.key.expiresAt === 1);
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });

  it('rejects duplicate eventIds once indexes exist', async () => {
    await mongoose.models.ResearchEvent.create(baseEvent());
    await expect(mongoose.models.ResearchEvent.create(baseEvent())).rejects.toMatchObject({
      code: 11000,
    });
    await mongoose.models.ResearchEvent.deleteMany({});
  });

  it('throws when a research model is not registered', async () => {
    const bare = new mongoose.Mongoose();
    await expect(ensureResearchIndexes(bare)).rejects.toThrow(/not registered/);
  });
});
