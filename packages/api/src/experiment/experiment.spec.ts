import mongoose from 'mongoose';
import { createModels } from '@librechat/data-schemas';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IUser } from '@librechat/data-schemas';
import { searchProducts } from './search';
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

describe('searchProducts', () => {
  it('returns empty array when SERPAPI_API_KEY is not set', async () => {
    const original = process.env.SERPAPI_API_KEY;
    delete process.env.SERPAPI_API_KEY;
    try {
      const results = await searchProducts('laptop', 2);
      expect(results).toEqual([]);
    } finally {
      if (original) {
        process.env.SERPAPI_API_KEY = original;
      }
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

    const updated = await User.findById(user._id).lean<IUser>();
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

    const reloaded = await User.findById(user._id).lean<IUser>();
    expect(reloaded?.experimentAssignment?.variant).toBe('control');
  });
});
