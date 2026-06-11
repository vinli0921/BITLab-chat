const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels } = require('@librechat/data-schemas');

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: jest.fn((req, res, next) => next()),
}));

let app;
let mongod;
let requireJwtAuth;

beforeAll(async () => {
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
    expect(res.body).toEqual({ inserted: 2, duplicates: 0 });
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
