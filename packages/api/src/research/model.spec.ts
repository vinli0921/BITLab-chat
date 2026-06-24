import mongoose from 'mongoose';
import { createModels } from '@librechat/data-schemas';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  createModels(mongoose);
  await mongoose.models.ResearchEvent.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.models.ResearchEvent.deleteMany({});
});

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-1',
    source: 'app-client',
    studyId: 'study-1',
    eventType: 'chat_presence',
    tsWall: new Date(),
    tsServerRecv: new Date(),
    ...overrides,
  };
}

describe('ResearchEvent model', () => {
  it('persists a valid envelope with payload', async () => {
    const payload = { active: true, depth: 42, meta: { tags: ['a', 'b'], counts: [1, 2] } };
    const doc = await mongoose.models.ResearchEvent.create(baseEvent({ payload }));
    expect(doc.schemaVersion).toBe(1);
    expect(doc.payload).toEqual(payload);
  });

  it('rejects duplicate eventId', async () => {
    await mongoose.models.ResearchEvent.create(baseEvent());
    await expect(mongoose.models.ResearchEvent.create(baseEvent())).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('rejects an unknown source', async () => {
    await expect(
      mongoose.models.ResearchEvent.create(baseEvent({ eventId: 'evt-2', source: 'bogus' })),
    ).rejects.toThrow(/validation/i);
  });
});
