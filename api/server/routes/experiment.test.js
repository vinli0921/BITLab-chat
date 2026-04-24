const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const userId1 = new mongoose.Types.ObjectId().toHexString();
const userId2 = new mongoose.Types.ObjectId().toHexString();

const mockState = {
  user: { id: userId1, experimentAssignment: { studyId: 'study-1', variant: 'sponsored-inline' } },
};

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = mockState.user;
    next();
  },
}));

let app;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const { createModels } = require('@librechat/data-schemas');
  createModels(mongoose);

  app = express();
  app.use(express.json());

  const experimentRouter = require('./experiment');
  app.use('/api/experiment', experimentRouter);
});

afterEach(async () => {
  mockState.user = {
    id: userId1,
    experimentAssignment: { studyId: 'study-1', variant: 'sponsored-inline' },
  };
  if (mongoose.models.AdEvent) {
    await mongoose.models.AdEvent.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('POST /api/experiment/ad-event', () => {
  it('persists response_viewport_exit event with scrollDepthPercent and dwellTimeMs', async () => {
    const body = {
      eventType: 'response_viewport_exit',
      productSource: 'none',
      conversationId: 'convo-1',
      messageId: 'msg-1',
      queryText: 'best laptop',
      dwellTimeMs: 4200,
      scrollDepthPercent: 75,
    };

    const res = await request(app).post('/api/experiment/ad-event').send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stored = await mongoose.models.AdEvent.findOne({ messageId: 'msg-1' }).lean();
    expect(stored).not.toBeNull();
    expect(stored.eventType).toBe('response_viewport_exit');
    expect(stored.dwellTimeMs).toBe(4200);
    expect(stored.scrollDepthPercent).toBe(75);
    expect(stored.variant).toBe('sponsored-inline');
    expect(stored.studyId).toBe('study-1');
  });

  it('persists response_link_click event with linkUrl', async () => {
    const body = {
      eventType: 'response_link_click',
      productSource: 'sponsored',
      productId: 'prod-abc',
      productName: 'Test Product',
      conversationId: 'convo-2',
      messageId: 'msg-2',
      linkUrl: 'https://example.com/product',
    };

    const res = await request(app).post('/api/experiment/ad-event').send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stored = await mongoose.models.AdEvent.findOne({ messageId: 'msg-2' }).lean();
    expect(stored).not.toBeNull();
    expect(stored.eventType).toBe('response_link_click');
    expect(stored.linkUrl).toBe('https://example.com/product');
    expect(stored.productId).toBe('prod-abc');
  });

  it('returns 400 when messageId is missing', async () => {
    const body = {
      eventType: 'click',
      productSource: 'sponsored',
      conversationId: 'convo-3',
      // messageId intentionally omitted
    };

    const res = await request(app).post('/api/experiment/ad-event').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messageId/);

    const count = await mongoose.models.AdEvent.countDocuments({});
    expect(count).toBe(0);
  });

  it('falls back to control variant when user has no experimentAssignment', async () => {
    mockState.user = { id: userId2 };

    const body = {
      eventType: 'impression',
      productSource: 'none',
      conversationId: 'convo-4',
      messageId: 'msg-4',
    };

    const res = await request(app).post('/api/experiment/ad-event').send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stored = await mongoose.models.AdEvent.findOne({ messageId: 'msg-4' }).lean();
    expect(stored).not.toBeNull();
    expect(stored.variant).toBe('control');
    expect(stored.userId.toString()).toBe(userId2);
  });
});
