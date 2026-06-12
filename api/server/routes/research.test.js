const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels } = require('@librechat/data-schemas');

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: jest.fn((req, res, next) => next()),
}));

jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  limiterCache: jest.fn(() => undefined),
  removePorts: (req) => req?.ip ?? 'test-ip',
}));

jest.mock('~/cache', () => ({
  logViolation: jest.fn().mockResolvedValue(undefined),
}));

let app;
let mongod;
let requireJwtAuth;

beforeAll(async () => {
  process.env.RESEARCH_STUDY_KEY = 'test-key';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  createModels(mongoose);
  await mongoose.models.ResearchEvent.init();

  requireJwtAuth = require('~/server/middleware').requireJwtAuth;

  app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/research', require('./research'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  requireJwtAuth.mockReset();
  await mongoose.models.ResearchEvent.deleteMany({});
  await mongoose.models.ParticipantMapping.deleteMany({});
  await mongoose.models.PairingCode.deleteMany({});
});

function appUser() {
  return {
    id: new mongoose.Types.ObjectId().toString(),
    experimentAssignment: { studyId: 'study-1', variant: 'control', assignedAt: new Date() },
  };
}

function event(eventId) {
  return {
    eventId,
    eventType: 'chat_presence',
    tsWall: Date.now(),
    payload: { active: false },
  };
}

describe('POST /api/research/events (app path)', () => {
  it('ingests a JWT-authed batch and stamps user context', async () => {
    const user = appUser();
    requireJwtAuth.mockImplementation((req, res, next) => {
      req.user = user;
      next();
    });
    const res = await request(app)
      .post('/api/research/events')
      .send({ events: [event('a1'), event('a2')] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 2, duplicates: 0, failed: 0 });
    const docs = await mongoose.models.ResearchEvent.find({}).lean();
    expect(docs).toHaveLength(2);
    expect(docs[0].userId.toString()).toBe(user.id);
    expect(docs[0].source).toBe('app-client');
    expect(docs[0].variant).toBe('control');
  });

  it('rejects unauthenticated requests', async () => {
    requireJwtAuth.mockImplementation((req, res) => {
      res.status(401).json({ error: 'unauthorized' });
    });
    const res = await request(app)
      .post('/api/research/events')
      .send({ events: [event('a3')] });
    expect(res.status).toBe(401);
  });

  it('rejects malformed bodies', async () => {
    const user = appUser();
    requireJwtAuth.mockImplementation((req, res, next) => {
      req.user = user;
      next();
    });
    const res = await request(app).post('/api/research/events').send({ events: 'nope' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/research/events (extension path)', () => {
  it('accepts a study-key batch and quarantines unmapped participants', async () => {
    const res = await request(app)
      .post('/api/research/events')
      .set('X-Study-Key', 'test-key')
      .send({
        participantId: 'p-ext',
        sessionId: 'session_1',
        events: [{ eventId: 'x1', type: 'tab_switch', tsWall: Date.now() }],
      });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    const [doc] = await mongoose.models.ResearchEvent.find({}).lean();
    expect(doc.source).toBe('extension');
    expect(doc.participantId).toBe('p-ext');
    expect(doc.userId).toBeUndefined();
  });

  it('rejects a wrong study key', async () => {
    const res = await request(app)
      .post('/api/research/events')
      .set('X-Study-Key', 'wrong')
      .send({ participantId: 'p-ext', events: [] });
    expect(res.status).toBe(401);
  });
});

describe('pairing endpoints', () => {
  it('issues a code (JWT) and redeems it (study key)', async () => {
    const user = appUser();
    requireJwtAuth.mockImplementation((req, res, next) => {
      req.user = user;
      next();
    });
    const issued = await request(app).post('/api/research/pairing-code').send({});
    expect(issued.status).toBe(200);
    expect(issued.body.code).toMatch(/^[A-Z2-9]{8}$/);

    const paired = await request(app)
      .post('/api/research/pair')
      .set('X-Study-Key', 'test-key')
      .send({ code: issued.body.code });
    expect(paired.status).toBe(200);
    expect(paired.body.participantId).toMatch(/[0-9a-f-]{36}/);
  });

  it('rejects an invalid pairing code', async () => {
    const res = await request(app)
      .post('/api/research/pair')
      .set('X-Study-Key', 'test-key')
      .send({ code: 'NOPENOPE' });
    expect(res.status).toBe(404);
  });

  // No 429 test for the pair limiter: its in-memory fallback store is shared across
  // this module's tests (router loaded once in beforeAll), so hammering /pair would
  // contaminate counters for the other cases. The limiter pattern is covered by
  // twoFactorTempLimiter.test.js.
});
