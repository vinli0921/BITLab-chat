import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '@librechat/data-schemas';
import { getAdContext, logAdEvent } from './service';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  createModels(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.models.User?.deleteMany({});
  await mongoose.models.Conversation?.deleteMany({});
  await mongoose.models.AdEvent?.deleteMany({});
});

async function createUser(variant: string) {
  return mongoose.models.User.create({
    email: `${variant}@test.com`,
    emailVerified: true,
    provider: 'local',
    experimentAssignment: { studyId: 'study-1', variant, assignedAt: new Date() },
  });
}

async function createConversation(userId: string, variant: string) {
  return mongoose.models.Conversation.create({
    conversationId: `convo-${Date.now()}`,
    endpoint: 'openAI',
    user: userId,
    experimentContext: { studyId: 'study-1', variant, adShownAt: [] },
  });
}

describe('getAdContext', () => {
  it('returns showAd:false for control variant', async () => {
    const user = await createUser('control');
    const convo = await createConversation(user._id.toString(), 'control');
    const result = await getAdContext({
      userId: user._id.toString(),
      variant: 'control',
      conversationId: convo.conversationId,
      messageId: 'msg-1',
      messageText: 'best laptop under 1000',
      db: mongoose,
    });
    expect(result.showAd).toBe(false);
  });

  it('returns showAd:false when no commercial intent', async () => {
    const user = await createUser('sponsored-inline');
    const convo = await createConversation(user._id.toString(), 'sponsored-inline');
    const result = await getAdContext({
      userId: user._id.toString(),
      variant: 'sponsored-inline',
      conversationId: convo.conversationId,
      messageId: 'msg-2',
      messageText: 'explain how DNA works',
      db: mongoose,
    });
    expect(result.showAd).toBe(false);
  });

  it('returns showAd:true with products for sponsored-inline with commercial intent', async () => {
    const user = await createUser('sponsored-inline');
    const convo = await createConversation(user._id.toString(), 'sponsored-inline');
    const result = await getAdContext({
      userId: user._id.toString(),
      variant: 'sponsored-inline',
      conversationId: convo.conversationId,
      messageId: 'msg-3',
      messageText: 'best blender for smoothies',
      db: mongoose,
    });
    expect(result.showAd).toBe(true);
    expect(result.variant).toBe('sponsored-inline');
    expect(result.products).toHaveLength(2);

    const adEvents = await mongoose.models.AdEvent.find({ messageId: 'msg-3' }).lean();
    expect(adEvents).toHaveLength(1);
    expect(adEvents[0].eventType).toBe('impression');
  });

  it('returns showAd:true for sponsored-outside with commercial intent', async () => {
    const user = await createUser('sponsored-outside');
    const convo = await createConversation(user._id.toString(), 'sponsored-outside');
    const result = await getAdContext({
      userId: user._id.toString(),
      variant: 'sponsored-outside',
      conversationId: convo.conversationId,
      messageId: 'msg-4',
      messageText: 'recommend a good restaurant',
      db: mongoose,
    });
    expect(result.showAd).toBe(true);
    expect(result.variant).toBe('sponsored-outside');
  });
});

describe('logAdEvent', () => {
  it('creates an AdEvent document', async () => {
    const user = await createUser('sponsored-inline');
    await logAdEvent({
      userId: user._id.toString(),
      conversationId: new mongoose.Types.ObjectId().toString(),
      messageId: 'msg-click',
      studyId: 'study-1',
      variant: 'sponsored-inline',
      eventType: 'click',
      productSource: 'sponsored',
      productId: 'blendjet-2',
      productName: 'BlendJet 2',
      queryText: 'best blender',
      db: mongoose,
    });
    const events = await mongoose.models.AdEvent.find({ messageId: 'msg-click' }).lean();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('click');
    expect(events[0].productId).toBe('blendjet-2');
  });
});
