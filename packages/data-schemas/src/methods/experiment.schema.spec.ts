import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';
import type { IUser } from '~/types/user';
import type { IConversation } from '~/types/convo';
import type { IAdEvent } from '~/types/adEvent';

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

describe('User experimentAssignment', () => {
  it('saves and retrieves experimentAssignment on a user', async () => {
    const User = mongoose.models.User;
    const user = await User.create({
      email: 'test@example.com',
      emailVerified: true,
      provider: 'local',
      experimentAssignment: {
        studyId: 'study-1',
        variant: 'control',
        assignedAt: new Date(),
      },
    });
    const found = await User.findById(user._id).lean<IUser>();
    expect(found?.experimentAssignment?.studyId).toBe('study-1');
    expect(found?.experimentAssignment?.variant).toBe('control');
    expect(found?.experimentAssignment?.assignedAt).toBeInstanceOf(Date);
  });

  it('allows user without experimentAssignment', async () => {
    const User = mongoose.models.User;
    const user = await User.create({
      email: 'noexp@example.com',
      emailVerified: true,
      provider: 'local',
    });
    const found = await User.findById(user._id).lean<IUser>();
    expect(found?.experimentAssignment).toBeUndefined();
  });
});

describe('Conversation experimentContext', () => {
  it('saves and retrieves experimentContext on a conversation', async () => {
    const Conversation = mongoose.models.Conversation;
    const convo = await Conversation.create({
      conversationId: 'test-convo-1',
      user: 'user-123',
      endpoint: 'openAI',
      experimentContext: {
        studyId: 'study-1',
        variant: 'sponsored-inline',
        adShownAt: ['msg-abc', 'msg-def'],
      },
    });
    const found = await Conversation.findById(convo._id).lean<IConversation>();
    expect(found?.experimentContext?.studyId).toBe('study-1');
    expect(found?.experimentContext?.variant).toBe('sponsored-inline');
    expect(found?.experimentContext?.adShownAt).toEqual(['msg-abc', 'msg-def']);
  });
});

describe('AdEvent model', () => {
  it('creates and retrieves an AdEvent', async () => {
    const AdEvent = mongoose.models.AdEvent;
    const userId = new mongoose.Types.ObjectId();
    const conversationId = new mongoose.Types.ObjectId();
    const event = await AdEvent.create({
      userId,
      conversationId,
      messageId: 'user-msg-123',
      studyId: 'study-1',
      variant: 'sponsored-inline',
      eventType: 'impression',
      productSource: 'sponsored',
      queryText: 'best laptop under 1000',
    });
    const found = await AdEvent.findById(event._id).lean<IAdEvent>();
    expect(found?.eventType).toBe('impression');
    expect(found?.variant).toBe('sponsored-inline');
    expect(found?.timestamp).toBeInstanceOf(Date);
    expect(found?.productId).toBeUndefined();
  });

  it('rejects invalid eventType', async () => {
    const AdEvent = mongoose.models.AdEvent;
    await expect(
      AdEvent.create({
        userId: new mongoose.Types.ObjectId(),
        conversationId: new mongoose.Types.ObjectId(),
        messageId: 'msg-1',
        studyId: 'study-1',
        variant: 'control',
        eventType: 'invalid-type',
        productSource: 'organic',
        queryText: 'test',
      }),
    ).rejects.toThrow();
  });
});
