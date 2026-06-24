import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger, createModels } from '@librechat/data-schemas';
import { logResearchEvents } from './service';

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

function input(eventId: string) {
  return {
    eventId,
    eventType: 'response_viewport_exit',
    tsWall: Date.now() - 50,
    tsMono: 123.45,
    conversationId: 'c1',
    messageId: 'm1',
    payload: { dwellActiveMs: 900 },
  };
}

describe('logResearchEvents', () => {
  it('inserts a batch with server-stamped tsServerRecv and context fields', async () => {
    const result = await logResearchEvents({
      events: [input('e1'), input('e2')],
      context: {
        source: 'app-client',
        studyId: 'study-1',
        variant: 'control',
        userId: new mongoose.Types.ObjectId().toString(),
      },
      db: mongoose,
    });
    expect(result).toEqual({ inserted: 2, duplicates: 0, failed: 0 });
    const docs = await mongoose.models.ResearchEvent.find({}).lean();
    expect(docs).toHaveLength(2);
    expect(docs[0].source).toBe('app-client');
    expect(docs[0].tsServerRecv).toBeInstanceOf(Date);
    expect(docs[0].tsWall.getTime()).toBeLessThan(docs[0].tsServerRecv.getTime());
    expect(docs[0].tsServerRecv.getTime()).toBe(docs[1].tsServerRecv.getTime());
  });

  it('counts duplicate eventIds without failing the batch', async () => {
    await logResearchEvents({
      events: [input('dup')],
      context: { source: 'app-client', studyId: 'study-1' },
      db: mongoose,
    });
    const result = await logResearchEvents({
      events: [input('dup'), input('fresh')],
      context: { source: 'app-client', studyId: 'study-1' },
      db: mongoose,
    });
    expect(result).toEqual({ inserted: 1, duplicates: 1, failed: 0 });
  });

  it('counts validation-dropped events while inserting valid ones in the same batch', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const invalid = { ...input('invalid'), tsWall: Number.NaN };
    const result = await logResearchEvents({
      events: [input('valid-1'), invalid, input('valid-2')],
      context: { source: 'app-client', studyId: 'study-1' },
      db: mongoose,
    });
    expect(result).toEqual({ inserted: 2, duplicates: 0, failed: 1 });
    expect(await mongoose.models.ResearchEvent.countDocuments({})).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/dropped 1 event/);
    warnSpy.mockRestore();
  });

  it('rejects oversized batches', async () => {
    const events = Array.from({ length: 501 }, (_, i) => input(`e${i}`));
    await expect(
      logResearchEvents({
        events,
        context: { source: 'app-client', studyId: 'study-1' },
        db: mongoose,
      }),
    ).rejects.toThrow(/batch/i);
  });

  it('returns zero counts for an empty batch', async () => {
    const result = await logResearchEvents({
      events: [],
      context: { source: 'app-client', studyId: 'study-1' },
      db: mongoose,
    });
    expect(result).toEqual({ inserted: 0, duplicates: 0, failed: 0 });
    expect(await mongoose.models.ResearchEvent.countDocuments({})).toBe(0);
  });

  it('rethrows non-duplicate bulk errors instead of counting them', async () => {
    const bulkError = Object.assign(new Error('bulk write error'), {
      writeErrors: [{ err: { code: 2 } }],
      result: { insertedCount: 0 },
    });
    const spy = jest
      .spyOn(mongoose.models.ResearchEvent, 'insertMany')
      .mockRejectedValueOnce(bulkError);
    await expect(
      logResearchEvents({
        events: [input('ok'), input('also-ok')],
        context: { source: 'app-client', studyId: 'study-1' },
        db: mongoose,
      }),
    ).rejects.toThrow('bulk write error');
    spy.mockRestore();
  });
});
