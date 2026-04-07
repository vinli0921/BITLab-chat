# A/B Test: Sponsored Recommendations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent A/B experiment assigning users to one of three sponsored-ad conditions (control, sponsored-inline, sponsored-outside) with intent-triggered mock ad delivery and behavioral event tracking.

**Architecture:** Backend handles variant assignment (lazily, on config load) and intent detection (keyword regex). A new `/api/experiment/ad-context` endpoint returns mock ad payloads for B/C users when commercial intent is detected. Frontend reads variant from React context and renders sponsored cards inline (B) or a ChatGPT-style panel below the message (C), with all interactions tracked in a new `AdEvent` MongoDB collection.

**Tech Stack:** TypeScript (packages/api, packages/data-schemas), MongoDB/Mongoose, React 18, Jotai, React Query, Jest + RTL + mongodb-memory-server

---

## File Map

**New files:**
- `packages/data-schemas/src/types/adEvent.ts` — IAdEvent interface
- `packages/data-schemas/src/schema/adEvent.ts` — Mongoose schema
- `packages/data-schemas/src/models/adEvent.ts` — Model factory
- `packages/api/src/experiment/constants.ts` — STUDY_ID, VARIANTS, Variant type
- `packages/api/src/experiment/intent.ts` — `detectCommercialIntent(text)`
- `packages/api/src/experiment/ads.ts` — `getMockAds()` fixture
- `packages/api/src/experiment/assignment.ts` — `ensureAssignment(userId, mongoose)`
- `packages/api/src/experiment/service.ts` — `getAdContext(...)`, `logAdEvent(...)`
- `packages/api/src/experiment/index.ts` — barrel export
- `api/server/routes/experiment.js` — POST /api/experiment/ad-context, POST /api/experiment/ad-event
- `client/src/store/experiment.ts` — Jotai atoms `adContextAtom` + `adContextFiredAtom`
- `client/src/context/ExperimentContext.tsx` — React context + provider
- `client/src/hooks/useAdContext.ts` — fires ad-context API, caches by messageId
- `client/src/components/Chat/Messages/SponsoredPanel.tsx` — Condition C panel

**Modified files:**
- `client/src/components/Chat/Messages/Content/ContentParts.tsx` — thread `userMessageId` prop to UIResourceCarousel
- `packages/data-schemas/src/schema/user.ts` — add ExperimentAssignmentSchema sub-schema + field
- `packages/data-schemas/src/types/user.ts` — add `experimentAssignment` to IUser
- `packages/data-schemas/src/schema/convo.ts` — add `experimentContext` field
- `packages/data-schemas/src/types/convo.ts` — add `experimentContext` to IConversation
- `packages/data-schemas/src/models/index.ts` — add `AdEvent: createAdEventModel(mongoose)`
- `packages/data-schemas/src/types/index.ts` — add `export * from './adEvent'`
- `packages/data-provider/src/config.ts` — add `experimentVariant` to TStartupConfig
- `api/server/routes/config.js` — call assignment, add `experimentVariant` to payload
- `api/server/routes/index.js` — export experiment router
- `api/server/index.js` — mount `/api/experiment` route
- `packages/api/src/index.ts` — add `export * from './experiment'`
- `client/src/App.jsx` — wrap with `ExperimentProvider`
- `client/src/components/Chat/Messages/Content/ProductCard.tsx` — add `sponsored` prop + badge
- `client/src/components/Chat/Messages/Content/UIResourceCarousel.tsx` — inject sponsored cards for B
- `client/src/components/Chat/Messages/MessageParts.tsx` — call useAdContext (user messages), mount SponsoredPanel (assistant messages)

---

## Task 1: Schema additions (data-schemas)

**Files:**
- Create: `packages/data-schemas/src/types/adEvent.ts`
- Create: `packages/data-schemas/src/schema/adEvent.ts`
- Create: `packages/data-schemas/src/models/adEvent.ts`
- Modify: `packages/data-schemas/src/models/index.ts`
- Modify: `packages/data-schemas/src/types/index.ts`
- Modify: `packages/data-schemas/src/schema/user.ts`
- Modify: `packages/data-schemas/src/types/user.ts`
- Modify: `packages/data-schemas/src/schema/convo.ts`
- Modify: `packages/data-schemas/src/types/convo.ts`
- Test: `packages/data-schemas/src/methods/__tests__/experiment.schema.spec.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `packages/data-schemas/src/methods/__tests__/experiment.schema.spec.ts`:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';

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
    const found = await User.findById(user._id).lean();
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
    const found = await User.findById(user._id).lean();
    expect(found?.experimentAssignment).toBeUndefined();
  });
});

describe('Conversation experimentContext', () => {
  it('saves and retrieves experimentContext on a conversation', async () => {
    const Conversation = mongoose.models.Conversation;
    const convo = await Conversation.create({
      conversationId: 'test-convo-1',
      user: 'user-123',
      experimentContext: {
        studyId: 'study-1',
        variant: 'sponsored-inline',
        adShownAt: ['msg-abc', 'msg-def'],
      },
    });
    const found = await Conversation.findById(convo._id).lean();
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
    const found = await AdEvent.findById(event._id).lean();
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/data-schemas && npx jest experiment.schema.spec --no-coverage
```
Expected: FAIL — `AdEvent` is not defined in models, schema fields missing.

- [ ] **Step 3: Create `packages/data-schemas/src/types/adEvent.ts`**

```ts
import type { Types, Document } from 'mongoose';

export type AdEventType = 'impression' | 'click' | 'link_visit' | 'dismiss';
export type ProductSource = 'organic' | 'sponsored';

export interface IAdEvent extends Document {
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: string;
  studyId: string;
  variant: string;
  eventType: AdEventType;
  productSource: ProductSource;
  productId?: string;
  productName?: string;
  queryText: string;
  timestamp: Date;
}
```

- [ ] **Step 4: Create `packages/data-schemas/src/schema/adEvent.ts`**

```ts
import { Schema } from 'mongoose';
import type { IAdEvent } from '~/types/adEvent';

const adEventSchema = new Schema<IAdEvent>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    messageId: { type: String, required: true },
    studyId: { type: String, required: true },
    variant: { type: String, required: true },
    eventType: {
      type: String,
      required: true,
      enum: ['impression', 'click', 'link_visit', 'dismiss'],
    },
    productSource: {
      type: String,
      required: true,
      enum: ['organic', 'sponsored'],
    },
    productId: { type: String },
    productName: { type: String },
    queryText: { type: String, required: true },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

adEventSchema.index({ userId: 1, studyId: 1 });
adEventSchema.index({ studyId: 1, variant: 1, eventType: 1 });

export default adEventSchema;
```

- [ ] **Step 5: Create `packages/data-schemas/src/models/adEvent.ts`**

```ts
import adEventSchema from '~/schema/adEvent';
import type { IAdEvent } from '~/types/adEvent';

export function createAdEventModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AdEvent || mongoose.model<IAdEvent>('AdEvent', adEventSchema);
}
```

- [ ] **Step 6: Register AdEvent in `packages/data-schemas/src/models/index.ts`**

Add import at the top with the other imports:
```ts
import { createAdEventModel } from './adEvent';
```

Add to the return object inside `createModels`:
```ts
AdEvent: createAdEventModel(mongoose),
```

- [ ] **Step 7: Export IAdEvent from `packages/data-schemas/src/types/index.ts`**

Add at the end of the file:
```ts
/* Experiment */
export * from './adEvent';
```

- [ ] **Step 8: Add `experimentAssignment` to the User schema**

In `packages/data-schemas/src/schema/user.ts`, add after `BackupCodeSchema` and before `const userSchema`:

```ts
const ExperimentAssignmentSchema = new Schema(
  {
    studyId: { type: String, required: true },
    variant: { type: String, required: true },
    assignedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);
```

Then add the field to `userSchema`:
```ts
experimentAssignment: {
  type: ExperimentAssignmentSchema,
},
```
Add it after the `favorites` field definition.

- [ ] **Step 9: Add `experimentAssignment` to `IUser` in `packages/data-schemas/src/types/user.ts`**

Add to the `IUser` interface (after `favorites`):
```ts
experimentAssignment?: {
  studyId: string;
  variant: string;
  assignedAt: Date;
};
```

- [ ] **Step 10: Add `experimentContext` to the Conversation schema**

In `packages/data-schemas/src/schema/convo.ts`, add inside the schema definition object (after `tenantId`):

```ts
experimentContext: {
  type: {
    studyId: { type: String },
    variant: { type: String },
    adShownAt: { type: [String], default: [] },
  },
  default: undefined,
},
```

- [ ] **Step 11: Add `experimentContext` to `IConversation` in `packages/data-schemas/src/types/convo.ts`**

Add to the `IConversation` interface (after `tenantId`):
```ts
experimentContext?: {
  studyId: string;
  variant: string;
  adShownAt: string[];
};
```

- [ ] **Step 12: Run tests to confirm they pass**

```bash
cd packages/data-schemas && npx jest experiment.schema.spec --no-coverage
```
Expected: PASS (all 4 tests).

- [ ] **Step 13: Commit**

```bash
git add packages/data-schemas/src/types/adEvent.ts \
        packages/data-schemas/src/schema/adEvent.ts \
        packages/data-schemas/src/models/adEvent.ts \
        packages/data-schemas/src/models/index.ts \
        packages/data-schemas/src/types/index.ts \
        packages/data-schemas/src/schema/user.ts \
        packages/data-schemas/src/types/user.ts \
        packages/data-schemas/src/schema/convo.ts \
        packages/data-schemas/src/types/convo.ts \
        packages/data-schemas/src/methods/__tests__/experiment.schema.spec.ts
git commit -m "add experiment schema: AdEvent model, User.experimentAssignment, Conversation.experimentContext"
```

---

## Task 2: Experiment backend module (packages/api)

**Files:**
- Create: `packages/api/src/experiment/constants.ts`
- Create: `packages/api/src/experiment/intent.ts`
- Create: `packages/api/src/experiment/ads.ts`
- Create: `packages/api/src/experiment/assignment.ts`
- Create: `packages/api/src/experiment/index.ts`
- Test: `packages/api/src/experiment/experiment.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/experiment/experiment.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/api && npx jest experiment.spec --no-coverage
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `packages/api/src/experiment/constants.ts`**

```ts
export const STUDY_ID = 'study-1' as const;
export const VARIANTS = ['control', 'sponsored-inline', 'sponsored-outside'] as const;
export type Variant = (typeof VARIANTS)[number];
```

- [ ] **Step 4: Create `packages/api/src/experiment/intent.ts`**

```ts
const COMMERCIAL_KEYWORDS = [
  'buy', 'purchase', 'shop', 'order', 'price', 'cost', 'cheap', 'deal', 'discount',
  'recommend', 'best', 'top', 'review', 'compare', 'vs', 'alternative',
  'blender', 'laptop', 'phone', 'camera', 'headphones', 'tv', 'monitor', 'speaker',
  'hotel', 'restaurant', 'product', 'brand', 'store', 'subscription',
];

const COMMERCIAL_PATTERN = new RegExp(`\\b(${COMMERCIAL_KEYWORDS.join('|')})\\b`, 'i');

export function detectCommercialIntent(messageText: string): boolean {
  return COMMERCIAL_PATTERN.test(messageText);
}
```

- [ ] **Step 5: Create `packages/api/src/experiment/ads.ts`**

```ts
export interface ProductCardData {
  name: string;
  price: string;
  storeName: string;
  buyUrl: string;
  imageUrl?: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
}

const AD_FIXTURES: ProductCardData[] = [
  {
    name: 'BlendJet 2 Portable Blender',
    price: '$49.95',
    storeName: 'BlendJet',
    buyUrl: 'https://blendjet.com/products/blendjet-2',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=BJ2',
    badge: 'Best Seller',
    rating: 4.5,
    reviewCount: 12483,
  },
  {
    name: 'Vitamix E310 Explorian Blender',
    price: '$299.95',
    storeName: 'Vitamix',
    buyUrl: 'https://www.vitamix.com/us/en_us/shop/e310',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Vtmx',
    badge: 'Pro Choice',
    rating: 4.8,
    reviewCount: 8321,
  },
  {
    name: 'Ninja BL610 Professional Blender',
    price: '$99.99',
    storeName: 'Ninja',
    buyUrl: 'https://www.ninjakitchen.com/products/ninja-professional-blender-bl610',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Ninja',
    rating: 4.3,
    reviewCount: 22100,
  },
  {
    name: 'NutriBullet Pro 900',
    price: '$79.99',
    storeName: 'NutriBullet',
    buyUrl: 'https://www.nutribullet.com/shop/blenders/nutribullet-pro/',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=NB',
    rating: 4.4,
    reviewCount: 31540,
  },
  {
    name: 'Oster Pro 1200 Blender',
    price: '$59.99',
    storeName: 'Oster',
    buyUrl: 'https://www.oster.com/blenders/oster-pro-1200-blender',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Oster',
    badge: 'Budget Pick',
    rating: 4.1,
    reviewCount: 9870,
  },
];

export function getMockAds(count = 2): ProductCardData[] {
  const shuffled = [...AD_FIXTURES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

- [ ] **Step 6: Create `packages/api/src/experiment/assignment.ts`**

```ts
import type mongoose from 'mongoose';
import type { IUser } from '@librechat/data-schemas';
import { STUDY_ID, VARIANTS } from './constants';
import type { Variant } from './constants';

export async function ensureAssignment(
  userId: string,
  db: typeof mongoose,
): Promise<Variant> {
  const User = db.models.User as mongoose.Model<IUser>;
  const user = await User.findById(userId).select('experimentAssignment').lean();

  if (user?.experimentAssignment?.studyId === STUDY_ID) {
    return user.experimentAssignment.variant as Variant;
  }

  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];

  await User.findByIdAndUpdate(userId, {
    $set: {
      experimentAssignment: {
        studyId: STUDY_ID,
        variant,
        assignedAt: new Date(),
      },
    },
  });

  return variant;
}
```

- [ ] **Step 7: Create `packages/api/src/experiment/index.ts`**

```ts
export { detectCommercialIntent } from './intent';
export { getMockAds } from './ads';
export { ensureAssignment } from './assignment';
export { STUDY_ID, VARIANTS } from './constants';
export type { Variant } from './constants';
export type { ProductCardData } from './ads';
```

- [ ] **Step 8: Add experiment exports to `packages/api/src/index.ts`**

Add at the end of the file:
```ts
/* Experiment */
export * from './experiment';
```

- [ ] **Step 9: Run tests to confirm they pass**

```bash
cd packages/api && npx jest experiment.spec --no-coverage
```
Expected: PASS (7 tests).

- [ ] **Step 10: Build packages/api**

```bash
cd /path/to/project && npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add packages/api/src/experiment/ packages/api/src/index.ts
git commit -m "add experiment backend module: constants, intent detector, mock ads, assignment service"
```

---

## Task 3: Ad-context service + experiment route

**Files:**
- Create: `packages/api/src/experiment/service.ts`
- Update: `packages/api/src/experiment/index.ts`
- Create: `api/server/routes/experiment.js`
- Modify: `api/server/routes/index.js`
- Modify: `api/server/index.js`
- Test: `packages/api/src/experiment/service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `packages/api/src/experiment/service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/api && npx jest service.spec --no-coverage
```
Expected: FAIL — `service` module not found.

- [ ] **Step 3: Create `packages/api/src/experiment/service.ts`**

```ts
import type mongoose from 'mongoose';
import type { IAdEvent, IConversation } from '@librechat/data-schemas';
import { detectCommercialIntent } from './intent';
import { getMockAds } from './ads';
import { STUDY_ID } from './constants';
import type { ProductCardData } from './ads';
import type { Variant } from './constants';
import type { AdEventType, ProductSource } from '@librechat/data-schemas';

interface AdContextParams {
  userId: string;
  variant: Variant;
  conversationId: string;
  messageId: string;
  messageText: string;
  db: typeof mongoose;
}

interface AdContextResult {
  showAd: false;
}
interface AdContextResultWithAd {
  showAd: true;
  variant: Variant;
  products: ProductCardData[];
}

export async function getAdContext(
  params: AdContextParams,
): Promise<AdContextResult | AdContextResultWithAd> {
  const { userId, variant, conversationId, messageId, messageText, db } = params;

  if (variant === 'control') {
    return { showAd: false };
  }

  if (!detectCommercialIntent(messageText)) {
    return { showAd: false };
  }

  const products = getMockAds(2);

  await Promise.all([
    logAdEvent({
      userId,
      conversationId,
      messageId,
      studyId: STUDY_ID,
      variant,
      eventType: 'impression',
      productSource: 'sponsored',
      queryText: messageText,
      db,
    }),
    updateConversationAdShown(conversationId, messageId, db),
  ]);

  return { showAd: true, variant, products };
}

async function updateConversationAdShown(
  conversationId: string,
  messageId: string,
  db: typeof mongoose,
): Promise<void> {
  const Conversation = db.models.Conversation as mongoose.Model<IConversation>;
  await Conversation.findOneAndUpdate(
    { conversationId },
    {
      $push: { 'experimentContext.adShownAt': messageId },
      $setOnInsert: {
        'experimentContext.studyId': STUDY_ID,
      },
    },
  );
}

interface LogAdEventParams {
  userId: string;
  conversationId: string;
  messageId: string;
  studyId: string;
  variant: string;
  eventType: AdEventType;
  productSource: ProductSource;
  productId?: string;
  productName?: string;
  queryText: string;
  db: typeof mongoose;
}

export async function logAdEvent(params: LogAdEventParams): Promise<void> {
  const AdEvent = params.db.models.AdEvent as mongoose.Model<IAdEvent>;
  await AdEvent.create({
    userId: params.userId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    studyId: params.studyId,
    variant: params.variant,
    eventType: params.eventType,
    productSource: params.productSource,
    productId: params.productId,
    productName: params.productName,
    queryText: params.queryText,
    timestamp: new Date(),
  });
}
```

- [ ] **Step 4: Update `packages/api/src/experiment/index.ts`** to export service functions:

```ts
export { detectCommercialIntent } from './intent';
export { getMockAds } from './ads';
export { ensureAssignment } from './assignment';
export { getAdContext, logAdEvent } from './service';
export { STUDY_ID, VARIANTS } from './constants';
export type { Variant } from './constants';
export type { ProductCardData } from './ads';
```

- [ ] **Step 5: Run service tests**

```bash
cd packages/api && npx jest service.spec --no-coverage
```
Expected: PASS (5 tests).

- [ ] **Step 6: Build packages/api**

```bash
npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 7: Create `api/server/routes/experiment.js`**

```js
const express = require('express');
const mongoose = require('mongoose');
const { requireJwtAuth } = require('~/server/middleware');
const { getAdContext, logAdEvent } = require('@librechat/api');

const router = express.Router();

router.use(requireJwtAuth);

router.post('/ad-context', async (req, res) => {
  try {
    const { messageText, conversationId, messageId } = req.body;
    const variant = req.user.experimentAssignment?.variant ?? 'control';

    if (!messageText || !conversationId || !messageId) {
      return res.status(400).json({ error: 'messageText, conversationId, and messageId required' });
    }

    const result = await getAdContext({
      userId: req.user.id,
      variant,
      conversationId,
      messageId,
      messageText,
      db: mongoose,
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/ad-event', async (req, res) => {
  try {
    const { eventType, productSource, productId, productName, conversationId, messageId, queryText } = req.body;
    const variant = req.user.experimentAssignment?.variant ?? 'control';
    const studyId = req.user.experimentAssignment?.studyId ?? 'study-1';

    if (!eventType || !productSource || !conversationId || !messageId) {
      return res.status(400).json({ error: 'eventType, productSource, conversationId, messageId required' });
    }

    await logAdEvent({
      userId: req.user.id,
      conversationId,
      messageId,
      studyId,
      variant,
      eventType,
      productSource,
      productId,
      productName,
      queryText: queryText ?? '',
      db: mongoose,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 8: Register experiment router in `api/server/routes/index.js`**

Add import with the other requires:
```js
const experiment = require('./experiment');
```

Add to the `module.exports` object:
```js
experiment,
```

- [ ] **Step 9: Mount experiment route in `api/server/index.js`**

Add after the existing `/api/mcp` mount (around line 187):
```js
app.use('/api/experiment', routes.experiment);
```

- [ ] **Step 10: Commit**

```bash
git add packages/api/src/experiment/service.ts \
        packages/api/src/experiment/index.ts \
        packages/api/src/experiment/service.spec.ts \
        api/server/routes/experiment.js \
        api/server/routes/index.js \
        api/server/index.js
git commit -m "add ad-context service and experiment API route"
```

---

## Task 4: Config route — assignment hook + experimentVariant

**Files:**
- Modify: `packages/data-provider/src/config.ts`
- Modify: `api/server/routes/config.js`
- Test: manual curl verification

- [ ] **Step 1: Add `experimentVariant` to `TStartupConfig` in `packages/data-provider/src/config.ts`**

Find the `TStartupConfig` type (around line 815). Add the field:
```ts
experimentVariant?: 'control' | 'sponsored-inline' | 'sponsored-outside' | null;
```
Add it after `conversationImportMaxFileSize`.

- [ ] **Step 2: Rebuild data-provider**

```bash
npm run build:data-provider
```
Expected: builds successfully.

- [ ] **Step 3: Add assignment + experimentVariant to `api/server/routes/config.js`**

Add the require at the top of the file with other requires:
```js
const mongoose = require('mongoose');
const { ensureAssignment } = require('@librechat/api');
```

In the authenticated user branch (after `const appConfig = await getAppConfig(...)`), add:
```js
const experimentVariant = await ensureAssignment(req.user.id, mongoose);
```

Then add to the authenticated payload object:
```js
experimentVariant,
```

- [ ] **Step 4: Verify with curl**

Start the backend (`npm run backend:dev`), log in, then:
```bash
curl -s http://localhost:3080/api/config \
  -H "Authorization: Bearer <your-token>" | jq '.experimentVariant'
```
Expected: `"control"`, `"sponsored-inline"`, or `"sponsored-outside"` (one of the three).

Run a second time for the same user — should return the same variant.

- [ ] **Step 5: Commit**

```bash
git add packages/data-provider/src/config.ts api/server/routes/config.js
git commit -m "expose experimentVariant in startup config, assign on config load"
```

---

## Task 5: ExperimentContext + useAdContext hook (client)

**Files:**
- Create: `client/src/store/experiment.ts`
- Create: `client/src/context/ExperimentContext.tsx`
- Create: `client/src/hooks/useAdContext.ts`
- Modify: `client/src/App.jsx`
- Test: `client/src/context/__tests__/ExperimentContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/context/__tests__/ExperimentContext.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExperimentProvider, useExperiment } from '../ExperimentContext';

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: jest.fn(),
}));

const { useGetStartupConfig } = jest.requireMock('~/data-provider');

function Probe() {
  const { variant } = useExperiment();
  return <div data-testid="variant">{variant ?? 'null'}</div>;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ExperimentProvider', () => {
  it('provides variant from startup config', async () => {
    useGetStartupConfig.mockReturnValue({ data: { experimentVariant: 'sponsored-inline' } });
    render(
      <ExperimentProvider>
        <Probe />
      </ExperimentProvider>,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByTestId('variant').textContent).toBe('sponsored-inline'));
  });

  it('provides null variant when config not ready', async () => {
    useGetStartupConfig.mockReturnValue({ data: undefined });
    render(
      <ExperimentProvider>
        <Probe />
      </ExperimentProvider>,
      { wrapper },
    );
    expect(screen.getByTestId('variant').textContent).toBe('null');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx jest ExperimentContext.test --no-coverage
```
Expected: FAIL — `ExperimentContext` not found.

- [ ] **Step 3: Create `client/src/store/experiment.ts`**

```ts
import { atom } from 'jotai';
import type { ProductCardData } from '@librechat/api';

export interface AdContextResult {
  showAd: true;
  variant: string;
  products: ProductCardData[];
}

/** Keyed by user messageId. Only populated for showAd:true results. */
export const adContextAtom = atom<Record<string, AdContextResult>>({});

/**
 * Tracks every user messageId for which the ad-context API has been fired,
 * regardless of whether the result was showAd:true or false. Prevents duplicate
 * API calls on re-renders when showAd was false (which leaves no entry in adContextAtom).
 */
export const adContextFiredAtom = atom<Set<string>>(new Set<string>());
```

- [ ] **Step 4: Create `client/src/context/ExperimentContext.tsx`**

```tsx
import React, { createContext, useContext, useMemo } from 'react';
import { useGetStartupConfig } from '~/data-provider';
import type { Variant } from '@librechat/api';

interface ExperimentContextValue {
  variant: Variant | null;
}

const ExperimentContext = createContext<ExperimentContextValue>({ variant: null });

export function ExperimentProvider({ children }: { children: React.ReactNode }) {
  const { data: config } = useGetStartupConfig();
  const value = useMemo(
    () => ({ variant: (config?.experimentVariant ?? null) as Variant | null }),
    [config?.experimentVariant],
  );
  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
}

export function useExperiment(): ExperimentContextValue {
  return useContext(ExperimentContext);
}
```

- [ ] **Step 5: Create `client/src/hooks/useAdContext.ts`**

```ts
import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { adContextAtom, adContextFiredAtom } from '~/store/experiment';
import type { AdContextResult } from '~/store/experiment';

interface AdContextParams {
  userMessageId: string;
  userMessageText: string;
  conversationId: string;
}

interface UseAdContextReturn {
  getAdContext: (params: AdContextParams) => Promise<void>;
  getResult: (userMessageId: string) => AdContextResult | undefined;
}

export function useAdContext(): UseAdContextReturn {
  const [adContextMap, setAdContextMap] = useAtom(adContextAtom);
  const [firedSet, setFiredSet] = useAtom(adContextFiredAtom);

  const getAdContext = useCallback(
    async ({ userMessageId, userMessageText, conversationId }: AdContextParams) => {
      // Guard against duplicate calls for the same message (handles both showAd:true and false)
      if (firedSet.has(userMessageId)) return;
      setFiredSet((prev) => new Set([...prev, userMessageId]));

      try {
        const res = await fetch('/api/experiment/ad-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: userMessageText,
            conversationId,
            messageId: userMessageId,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.showAd) {
          setAdContextMap((prev) => ({ ...prev, [userMessageId]: data as AdContextResult }));
        }
      } catch {
        // Network errors are non-critical — silently skip
      }
    },
    [firedSet, setFiredSet, setAdContextMap],
  );

  const getResult = useCallback(
    (userMessageId: string) => adContextMap[userMessageId],
    [adContextMap],
  );

  return { getAdContext, getResult };
}

export async function postAdEvent(params: {
  eventType: string;
  productSource: string;
  productId?: string;
  productName?: string;
  conversationId: string;
  messageId: string;
  queryText?: string;
}): Promise<void> {
  try {
    await fetch('/api/experiment/ad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-critical tracking — silently skip
  }
}
```

- [ ] **Step 6: Wrap app with ExperimentProvider in `client/src/App.jsx`**

Import at top:
```js
import { ExperimentProvider } from '~/context/ExperimentContext';
```

Wrap the `RouterProvider` with `ExperimentProvider`:
```jsx
<ExperimentProvider>
  <RouterProvider router={router} />
</ExperimentProvider>
```

- [ ] **Step 7: Run tests**

```bash
cd client && npx jest ExperimentContext.test --no-coverage
```
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add client/src/store/experiment.ts \
        client/src/context/ExperimentContext.tsx \
        client/src/context/__tests__/ExperimentContext.test.tsx \
        client/src/hooks/useAdContext.ts \
        client/src/App.jsx
git commit -m "add ExperimentContext, adContextAtom, and useAdContext hook"
```

---

## Task 6: ProductCard sponsored prop + carousel injection (Condition B)

**Files:**
- Modify: `client/src/components/Chat/Messages/Content/ProductCard.tsx`
- Modify: `client/src/components/Chat/Messages/Content/UIResourceCarousel.tsx`
- Test: `client/src/components/Chat/Messages/Content/__tests__/ProductCard.sponsored.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/Chat/Messages/Content/__tests__/ProductCard.sponsored.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import ProductCard from '../ProductCard';

const baseProduct = JSON.stringify({
  name: 'Test Blender',
  price: '$99',
  storeName: 'TestStore',
  buyUrl: 'https://example.com',
  rating: 4.5,
  reviewCount: 100,
});

describe('ProductCard sponsored prop', () => {
  it('does not show sponsored badge when sponsored is false', () => {
    render(<ProductCard text={baseProduct} sponsored={false} />);
    expect(screen.queryByText('Sponsored')).toBeNull();
  });

  it('shows sponsored badge when sponsored is true', () => {
    render(<ProductCard text={baseProduct} sponsored={true} />);
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx jest ProductCard.sponsored.test --no-coverage
```
Expected: FAIL — `sponsored` prop not recognized.

- [ ] **Step 3: Add `sponsored` prop to `ProductCard.tsx`**

Find `interface ProductCardProps` and update:
```tsx
interface ProductCardProps {
  text: string;
  sponsored?: boolean;
}
```

Update the function signature:
```tsx
export default function ProductCard({ text, sponsored = false }: ProductCardProps) {
```

Inside the JSX, add the sponsored badge just before the product image (or at the top of the card content):
```tsx
{sponsored && (
  <span className="mb-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800">
    Sponsored
  </span>
)}
```

- [ ] **Step 4: Run tests**

```bash
cd client && npx jest ProductCard.sponsored.test --no-coverage
```
Expected: PASS (2 tests).

- [ ] **Step 5: Write carousel injection test**

Add to the existing `client/src/components/Chat/Messages/Content/__tests__/UIResourceCarousel.test.tsx` (or create a new file `UIResourceCarousel.sponsored.test.tsx`):

```tsx
// This test verifies that sponsored cards are appended for sponsored-inline variant.
// Uses mocked ExperimentContext and adContextAtom.
import { render, screen } from '@testing-library/react';
import UIResourceCarousel from '../UIResourceCarousel';

jest.mock('~/context/ExperimentContext', () => ({
  useExperiment: () => ({ variant: 'sponsored-inline' }),
}));

jest.mock('jotai', () => ({
  ...jest.requireActual('jotai'),
  useAtomValue: () => ({
    'user-msg-123': {
      showAd: true,
      variant: 'sponsored-inline',
      products: [
        {
          name: 'Sponsored Blender',
          price: '$49',
          storeName: 'SponsorCo',
          buyUrl: 'https://example.com',
        },
      ],
    },
  }),
}));

describe('UIResourceCarousel with sponsored-inline variant', () => {
  it('renders sponsored card alongside organic results', () => {
    const organicResource = {
      resourceId: 'res-1',
      uri: 'uri:1',
      mimeType: 'application/vnd.librechat.product-card+json',
      text: JSON.stringify({
        name: 'Organic Blender',
        price: '$100',
        storeName: 'OrganicStore',
        buyUrl: 'https://organic.com',
      }),
    };

    render(
      <UIResourceCarousel
        uiResources={[organicResource]}
        userMessageId="user-msg-123"
      />,
    );

    expect(screen.getByText('Organic Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run carousel test to confirm it fails**

```bash
cd client && npx jest UIResourceCarousel.sponsored.test --no-coverage
```
Expected: FAIL — `userMessageId` prop not accepted, no sponsored card.

- [ ] **Step 7: Update `UIResourceCarousel.tsx` to accept `userMessageId` and inject sponsored cards**

Add `userMessageId?: string` to `UIResourceCarouselProps`:
```tsx
interface UIResourceCarouselProps {
  uiResources: UIResource[];
  userMessageId?: string;
}
```

Import context and atom at the top:
```tsx
import { useAtomValue } from 'jotai';
import { useExperiment } from '~/context/ExperimentContext';
import { adContextAtom } from '~/store/experiment';
```

Inside the component (after existing hooks), add:
```tsx
const { variant } = useExperiment();
const adContextMap = useAtomValue(adContextAtom);
const adResult = userMessageId ? adContextMap[userMessageId] : undefined;

const sponsoredResources: UIResource[] =
  variant === 'sponsored-inline' && adResult?.showAd
    ? adResult.products.map((p, i) => ({
        resourceId: `sponsored-${i}`,
        uri: `sponsored:${i}`,
        mimeType: 'application/vnd.librechat.product-card+json',
        text: JSON.stringify(p),
        sponsored: true,
      }))
    : [];

const allResources = [...uiResources, ...sponsoredResources];
```

Replace references to `uiResources` in the JSX with `allResources`. When rendering a product card, pass the `sponsored` flag:

```tsx
// When rendering items, check for sponsored flag:
mimeType === 'application/vnd.librechat.product-card+json' ? (
  <ProductCard text={resource.text ?? ''} sponsored={!!(resource as UIResource & { sponsored?: boolean }).sponsored} />
) : (...)
```

- [ ] **Step 8: Run tests**

```bash
cd client && npx jest UIResourceCarousel.sponsored.test ProductCard.sponsored.test --no-coverage
```
Expected: PASS (3 tests total).

- [ ] **Step 9: Thread `userMessageId` through ContentParts**

`UIResourceCarousel` is rendered inside `ContentParts.tsx`. Open `client/src/components/Chat/Messages/Content/ContentParts.tsx` and:

1. Add `userMessageId?: string` to the `ContentPartsProps` interface.
2. Pass it down to wherever `UIResourceCarousel` is rendered:
   ```tsx
   <UIResourceCarousel uiResources={uiResources} userMessageId={userMessageId} />
   ```

Then in `MessageParts.tsx` (Task 8 adds this), pass:
```tsx
<ContentParts
  ...existing props...
  userMessageId={!isCreatedByUser ? (message.parentMessageId ?? undefined) : undefined}
/>
```

- [ ] **Step 10: Commit**

```bash
git add client/src/components/Chat/Messages/Content/ProductCard.tsx \
        client/src/components/Chat/Messages/Content/UIResourceCarousel.tsx \
        client/src/components/Chat/Messages/Content/ContentParts.tsx \
        client/src/components/Chat/Messages/Content/__tests__/ProductCard.sponsored.test.tsx \
        client/src/components/Chat/Messages/Content/__tests__/UIResourceCarousel.sponsored.test.tsx
git commit -m "add sponsored badge to ProductCard, inject sponsored cards into carousel for condition B"
```

---

## Task 7: SponsoredPanel component (Condition C)

**Files:**
- Create: `client/src/components/Chat/Messages/SponsoredPanel.tsx`
- Test: `client/src/components/Chat/Messages/__tests__/SponsoredPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/Chat/Messages/__tests__/SponsoredPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import SponsoredPanel from '../SponsoredPanel';
import type { ProductCardData } from '@librechat/api';

const mockProducts: ProductCardData[] = [
  {
    name: 'BlendJet 2',
    price: '$49.95',
    storeName: 'BlendJet',
    buyUrl: 'https://blendjet.com',
  },
  {
    name: 'Vitamix E310',
    price: '$299.95',
    storeName: 'Vitamix',
    buyUrl: 'https://vitamix.com',
  },
];

const mockOnEvent = jest.fn();

describe('SponsoredPanel', () => {
  afterEach(() => mockOnEvent.mockClear());

  it('renders brand name, Sponsored label, products, and disclaimer', () => {
    render(
      <SponsoredPanel
        products={mockProducts}
        messageId="msg-1"
        conversationId="convo-1"
        queryText="best blender"
        onEvent={mockOnEvent}
      />,
    );
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
    expect(screen.getByText('BlendJet 2')).toBeInTheDocument();
    expect(screen.getByText('Vitamix E310')).toBeInTheDocument();
    expect(screen.getByText(/ads do not influence/i)).toBeInTheDocument();
  });

  it('calls onEvent with click when a product is clicked', () => {
    render(
      <SponsoredPanel
        products={mockProducts}
        messageId="msg-2"
        conversationId="convo-1"
        queryText="blender"
        onEvent={mockOnEvent}
      />,
    );
    fireEvent.click(screen.getByText('BlendJet 2').closest('a')!);
    expect(mockOnEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'link_visit',
        productName: 'BlendJet 2',
        productSource: 'sponsored',
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx jest SponsoredPanel.test --no-coverage
```
Expected: FAIL — component not found.

- [ ] **Step 3: Create `client/src/components/Chat/Messages/SponsoredPanel.tsx`**

```tsx
import React from 'react';
import type { ProductCardData } from '@librechat/api';

interface AdEventPayload {
  eventType: 'click' | 'link_visit' | 'dismiss';
  productSource: 'sponsored';
  productId?: string;
  productName?: string;
  messageId: string;
  conversationId: string;
  queryText: string;
}

interface SponsoredPanelProps {
  products: ProductCardData[];
  messageId: string;
  conversationId: string;
  queryText: string;
  onEvent: (payload: AdEventPayload) => void;
}

export default function SponsoredPanel({
  products,
  messageId,
  conversationId,
  queryText,
  onEvent,
}: SponsoredPanelProps) {
  if (!products.length) return null;

  const brandName = products[0].storeName;
  const brandInitial = brandName.charAt(0).toUpperCase();

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border-light bg-surface-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-bold text-white">
            {brandInitial}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text-primary">{brandName}</p>
            <p className="text-[11px] text-text-secondary">Sponsored</p>
          </div>
        </div>
        <button
          className="text-text-secondary hover:text-text-primary"
          aria-label="Ad options"
          onClick={() =>
            onEvent({ eventType: 'dismiss', productSource: 'sponsored', messageId, conversationId, queryText })
          }
        >
          ···
        </button>
      </div>

      {/* Product cards */}
      <div className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
        {products.map((product, i) => (
          <a
            key={i}
            href={product.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[140px] flex-col gap-1 rounded-lg border border-border-light bg-surface-secondary p-2 hover:bg-surface-hover"
            onClick={() =>
              onEvent({
                eventType: 'link_visit',
                productSource: 'sponsored',
                productId: product.buyUrl,
                productName: product.name,
                messageId,
                conversationId,
                queryText,
              })
            }
          >
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-16 w-full rounded object-contain"
              />
            )}
            <p className="text-[12px] font-medium text-text-primary line-clamp-2">{product.name}</p>
            <p className="text-[12px] text-text-secondary">{product.price}</p>
          </a>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-border-light px-3 py-2 text-[11px] text-text-tertiary">
        Ads do not influence the answers you get. <span className="underline cursor-pointer">Learn more ›</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd client && npx jest SponsoredPanel.test --no-coverage
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Chat/Messages/SponsoredPanel.tsx \
        client/src/components/Chat/Messages/__tests__/SponsoredPanel.test.tsx
git commit -m "add SponsoredPanel component for condition C"
```

---

## Task 8: Wire MessageParts — fire ad-context, render SponsoredPanel

**Files:**
- Modify: `client/src/components/Chat/Messages/MessageParts.tsx`
- Test: `client/src/components/Chat/Messages/__tests__/MessageParts.experiment.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/Chat/Messages/__tests__/MessageParts.experiment.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { Provider as JotaiProvider } from 'jotai';
import MessageParts from '../MessageParts';

jest.mock('~/context/ExperimentContext', () => ({
  useExperiment: jest.fn(),
}));
jest.mock('~/hooks/useAdContext', () => ({
  useAdContext: jest.fn(),
  postAdEvent: jest.fn(),
}));

const { useExperiment } = jest.requireMock('~/context/ExperimentContext');
const { useAdContext } = jest.requireMock('~/hooks/useAdContext');

const baseProps = {
  message: {
    messageId: 'assistant-msg-1',
    parentMessageId: 'user-msg-1',
    isCreatedByUser: false,
    text: 'Here are some blender options...',
    content: [],
    children: [],
  },
  siblingIdx: 0,
  siblingCount: 1,
  setSiblingIdx: jest.fn(),
  currentEditId: null,
  setCurrentEditId: jest.fn(),
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <RecoilRoot>
      <JotaiProvider>{children}</JotaiProvider>
    </RecoilRoot>
  );
}

describe('MessageParts experiment wiring', () => {
  it('does not render SponsoredPanel for control variant', async () => {
    useExperiment.mockReturnValue({ variant: 'control' });
    useAdContext.mockReturnValue({
      getAdContext: jest.fn(),
      getResult: () => undefined,
    });

    render(<MessageParts {...baseProps} />, { wrapper });
    expect(screen.queryByText('Sponsored')).toBeNull();
  });

  it('renders SponsoredPanel for sponsored-outside when showAd is true', async () => {
    useExperiment.mockReturnValue({ variant: 'sponsored-outside' });
    useAdContext.mockReturnValue({
      getAdContext: jest.fn(),
      getResult: () => ({
        showAd: true,
        variant: 'sponsored-outside',
        products: [
          { name: 'BlendJet 2', price: '$49', storeName: 'BlendJet', buyUrl: 'https://blendjet.com' },
        ],
      }),
    });

    render(<MessageParts {...baseProps} />, { wrapper });
    await waitFor(() => expect(screen.getByText('BlendJet 2')).toBeInTheDocument());
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx jest MessageParts.experiment.test --no-coverage
```
Expected: FAIL — SponsoredPanel not rendered.

- [ ] **Step 3: Update `MessageParts.tsx`**

Add imports at the top:
```tsx
import { useEffect } from 'react';
import { useExperiment } from '~/context/ExperimentContext';
import { useAdContext, postAdEvent } from '~/hooks/useAdContext';
import SponsoredPanel from './SponsoredPanel';
```

Inside the `Message` function, after existing hooks:
```tsx
const { variant } = useExperiment();
const { getAdContext, getResult } = useAdContext();

// For USER messages: fire the ad-context API call once.
// Deduplication is handled inside getAdContext via adContextFiredAtom —
// safe to call on every render.
useEffect(() => {
  if (!isCreatedByUser || !message.text || !conversation?.conversationId) return;
  getAdContext({
    userMessageId: message.messageId ?? '',
    userMessageText: message.text,
    conversationId: conversation.conversationId,
  });
}, [isCreatedByUser, message.messageId, message.text, conversation?.conversationId, getAdContext]);

// For ASSISTANT messages: read the ad result using parentMessageId
const adResult = !isCreatedByUser ? getResult(message.parentMessageId ?? '') : undefined;
const showSponsoredPanel =
  variant === 'sponsored-outside' && adResult?.showAd === true;
```

After the `SubRow` (action buttons) closing tag, add the panel:
```tsx
{!isCreatedByUser && showSponsoredPanel && adResult?.products && (
  <SponsoredPanel
    products={adResult.products}
    messageId={message.parentMessageId ?? ''}
    conversationId={conversation?.conversationId ?? ''}
    queryText=""
    onEvent={(payload) => postAdEvent(payload)}
  />
)}
```

- [ ] **Step 4: Run all experiment tests**

```bash
cd client && npx jest MessageParts.experiment SponsoredPanel.test ExperimentContext.test ProductCard.sponsored UIResourceCarousel.sponsored --no-coverage
```
Expected: PASS (all tests).

- [ ] **Step 5: Manual smoke test**

1. Start backend + frontend (`npm run backend:dev` + `npm run frontend:dev`)
2. Log in, note the variant in the config response (`/api/config`)
3. If variant is `sponsored-outside`: ask "best laptop under 1000" — the SponsoredPanel should appear below the assistant message action buttons
4. If variant is `sponsored-inline`: ask the same — sponsored card should appear in the carousel
5. If variant is `control`: no sponsored content
6. Check MongoDB `AdEvent` collection for impression events

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Chat/Messages/MessageParts.tsx \
        client/src/components/Chat/Messages/__tests__/MessageParts.experiment.test.tsx
git commit -m "wire ad-context into MessageParts: fire for user messages, render SponsoredPanel for condition C"
```
