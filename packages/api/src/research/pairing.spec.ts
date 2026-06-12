import mongoose from 'mongoose';
import { createModels } from '@librechat/data-schemas';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createPairingCode,
  redeemPairingCode,
  resolveParticipant,
  upsertBeaconMapping,
} from './pairing';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  createModels(mongoose);
  await mongoose.models.ParticipantMapping.init();
  await mongoose.models.PairingCode.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.models.ParticipantMapping.deleteMany({});
  await mongoose.models.PairingCode.deleteMany({});
});

const userId = () => new mongoose.Types.ObjectId().toString();

describe('pairing', () => {
  it('issues a code and redeems it into a mapping with a UUID participantId', async () => {
    const uid = userId();
    const { code, expiresAt } = await createPairingCode({
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
    });
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const redeemed = await redeemPairingCode({ code, db: mongoose });
    expect(redeemed?.participantId).toMatch(/[0-9a-f-]{36}/);

    const resolved = await resolveParticipant({
      participantId: redeemed!.participantId,
      db: mongoose,
    });
    expect(resolved?.toString()).toBe(uid);
  });

  it('rejects reuse and expired codes', async () => {
    const { code } = await createPairingCode({
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
    });
    await redeemPairingCode({ code, db: mongoose });
    expect(await redeemPairingCode({ code, db: mongoose })).toBeNull();

    const { code: expired } = await createPairingCode({
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
      ttlMs: -1000,
    });
    expect(await redeemPairingCode({ code: expired, db: mongoose })).toBeNull();
  });

  it('upserts a beacon mapping and keeps the existing user on conflict', async () => {
    const firstUser = userId();
    const created = await upsertBeaconMapping({
      participantId: 'p-1',
      userId: firstUser,
      studyId: 'study-1',
      db: mongoose,
    });
    expect(created.conflict).toBe(false);

    const conflicting = await upsertBeaconMapping({
      participantId: 'p-1',
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
    });
    expect(conflicting.conflict).toBe(true);
    const resolved = await resolveParticipant({ participantId: 'p-1', db: mongoose });
    expect(resolved?.toString()).toBe(firstUser);
  });

  it('stores consentVersion on a new beacon mapping and leaves it unset when absent', async () => {
    await upsertBeaconMapping({
      participantId: 'p-consent',
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
      consentVersion: 'v1',
    });
    const withConsent = (await mongoose.models.ParticipantMapping.findOne({
      participantId: 'p-consent',
    }).lean()) as { consentVersion?: string } | null;
    expect(withConsent?.consentVersion).toBe('v1');

    await upsertBeaconMapping({
      participantId: 'p-noconsent',
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
    });
    const withoutConsent = (await mongoose.models.ParticipantMapping.findOne({
      participantId: 'p-noconsent',
    }).lean()) as { consentVersion?: string } | null;
    expect(withoutConsent?.consentVersion).toBeUndefined();
  });

  it('updates consentVersion when a newer version arrives for the same participant', async () => {
    const uid = userId();
    await upsertBeaconMapping({
      participantId: 'p-reconsent',
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
      consentVersion: 'v1',
    });
    await upsertBeaconMapping({
      participantId: 'p-reconsent',
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
      consentVersion: 'v2',
    });
    const mapping = (await mongoose.models.ParticipantMapping.findOne({
      participantId: 'p-reconsent',
    }).lean()) as { consentVersion?: string } | null;
    expect(mapping?.consentVersion).toBe('v2');
  });

  it('preserves consentVersion when a later bridge arrives without one', async () => {
    const uid = userId();
    await upsertBeaconMapping({
      participantId: 'p-preserve',
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
      consentVersion: 'v1',
    });
    await upsertBeaconMapping({
      participantId: 'p-preserve',
      userId: uid,
      studyId: 'study-1',
      db: mongoose,
    });
    const mapping = (await mongoose.models.ParticipantMapping.findOne({
      participantId: 'p-preserve',
    }).lean()) as { consentVersion?: string } | null;
    expect(mapping?.consentVersion).toBe('v1');
  });

  it('stores consentVersion on a pairing redemption when provided', async () => {
    const { code } = await createPairingCode({
      userId: userId(),
      studyId: 'study-1',
      db: mongoose,
    });
    const redeemed = await redeemPairingCode({ code, db: mongoose, consentVersion: 'v3' });
    const mapping = (await mongoose.models.ParticipantMapping.findOne({
      participantId: redeemed!.participantId,
    }).lean()) as { consentVersion?: string } | null;
    expect(mapping?.consentVersion).toBe('v3');
  });

  it('handles concurrent upserts for the same new participantId without rejecting', async () => {
    const firstUser = userId();
    const secondUser = userId();

    const results = await Promise.allSettled([
      upsertBeaconMapping({
        participantId: 'p-concurrent',
        userId: firstUser,
        studyId: 'study-1',
        db: mongoose,
      }),
      upsertBeaconMapping({
        participantId: 'p-concurrent',
        userId: secondUser,
        studyId: 'study-1',
        db: mongoose,
      }),
    ]);

    // Neither call should reject — the race E11000 must be absorbed
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');

    const outcomes = results.map((r) => (r as PromiseFulfilledResult<{ conflict: boolean }>).value);
    const noConflict = outcomes.filter((o) => !o.conflict);
    const withConflict = outcomes.filter((o) => o.conflict);
    // Exactly one winner and one loser
    expect(noConflict).toHaveLength(1);
    expect(withConflict).toHaveLength(1);

    // The stored mapping belongs to whichever user won the race
    const resolved = await resolveParticipant({ participantId: 'p-concurrent', db: mongoose });
    expect(resolved).not.toBeNull();
  });
});
