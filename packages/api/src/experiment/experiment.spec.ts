import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '@librechat/data-schemas';
import { detectCommercialIntent } from './intent';
import { getMockAds } from './ads';
import { ensureAssignment } from './assignment';
import { VARIANTS } from './constants';

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
});

describe('detectCommercialIntent', () => {
  it('returns true for commercial queries', () => {
    expect(detectCommercialIntent('best laptop under 1000')).toBe(true);
    expect(detectCommercialIntent('recommend a good blender')).toBe(true);
    expect(detectCommercialIntent('cheap hotels in NYC')).toBe(true);
    expect(detectCommercialIntent('where to buy running shoes')).toBe(true);
  });

  it('returns false for non-commercial queries', () => {
    expect(detectCommercialIntent('how does photosynthesis work')).toBe(false);
    expect(detectCommercialIntent('explain recursion to me')).toBe(false);
    expect(detectCommercialIntent('what is the capital of France')).toBe(false);
  });
});

describe('getMockAds', () => {
  it('returns exactly 2 products by default', () => {
    const ads = getMockAds();
    expect(ads).toHaveLength(2);
  });

  it('each product has required ProductCard fields', () => {
    const ads = getMockAds();
    for (const ad of ads) {
      expect(ad.name).toBeTruthy();
      expect(ad.price).toBeTruthy();
      expect(ad.storeName).toBeTruthy();
      expect(ad.buyUrl).toBeTruthy();
    }
  });
});

describe('ensureAssignment', () => {
  it('assigns a valid variant when user has none', async () => {
    const User = mongoose.models.User;
    const user = await User.create({
      email: 'assign@example.com',
      emailVerified: true,
      provider: 'local',
    });
    const variant = await ensureAssignment(user._id.toString(), mongoose);
    expect(VARIANTS).toContain(variant);

    const updated = await User.findById(user._id).lean();
    expect(updated?.experimentAssignment?.variant).toBe(variant);
    expect(updated?.experimentAssignment?.studyId).toBe('study-1');
  });

  it('returns existing variant without overwriting', async () => {
    const User = mongoose.models.User;
    const user = await User.create({
      email: 'existing@example.com',
      emailVerified: true,
      provider: 'local',
      experimentAssignment: { studyId: 'study-1', variant: 'control', assignedAt: new Date() },
    });
    const variant = await ensureAssignment(user._id.toString(), mongoose);
    expect(variant).toBe('control');

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded?.experimentAssignment?.variant).toBe('control');
  });
});
