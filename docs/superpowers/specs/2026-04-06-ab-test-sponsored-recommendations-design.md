# A/B Test: Sponsored Recommendations
## Design Spec — 2026-04-06

### Research Context

This feature implements the experimental infrastructure for "Trust, Transparency, and Timing in Conversational Commerce" (Study 1). It provides a three-condition A/B test to study how sponsored recommendations in AI answer engines affect user trust at three levels: trust in the assistant, trust in the recommendation, and trust in the promoted brand.

---

### Experimental Conditions

| Condition | Label | Description |
|---|---|---|
| A | `control` | Organic MCP product-search results only. No sponsored content. Current behavior unchanged. |
| B | `sponsored-inline` | Same MCP carousel + mock sponsored card(s) injected. Visually identical to organic cards but with a "Sponsored" badge. |
| C | `sponsored-outside` | MCP carousel unchanged in chat. A separate ChatGPT-style sponsored panel renders below the assistant's action buttons, outside the message flow. |

Assignment is **persistent per user** for the duration of the study. Once assigned, a user always sees the same condition. Split is equal (1/3 each), randomized at assignment time.

---

### Architecture: Hybrid Approach

Backend handles intent detection and variant assignment (research integrity). Frontend handles rendering (UI flexibility). The message streaming pipeline is not touched.

**Request flow:**

1. User logs in → backend assigns variant if not already assigned → persists to User document
2. Variant returned in `/api/config` response → frontend stores in React context
3. User submits message → frontend fires `POST /api/experiment/ad-context` in parallel with normal chat request, using the **user's message ID** (generated client-side) as the key
4. Backend runs keyword intent detection; if commercial intent + variant B or C → returns mock ad payload + logs impression
5. Frontend renders based on variant and ad payload

---

### MongoDB Schema

#### User model — add field (`packages/data-schemas`)

```ts
experimentAssignment?: {
  studyId: string        // "study-1"
  variant: 'control' | 'sponsored-inline' | 'sponsored-outside'
  assignedAt: Date
}
```

#### Conversation model — add field (`packages/data-schemas`)

```ts
experimentContext?: {
  studyId: string
  variant: string
  adShownAt: string[]    // messageIds where ad was triggered
}
```

#### New collection: `AdEvent`

One document per trackable interaction. This is the primary behavioral data source for the study.

```ts
{
  userId: ObjectId
  conversationId: ObjectId
  messageId: string         // user's message ID (the query that triggered the ad)
  studyId: string           // "study-1"
  variant: string
  eventType: 'impression' | 'click' | 'link_visit' | 'dismiss'
  productSource: 'organic' | 'sponsored'
  productId?: string        // null for impressions; filled for click/link_visit
  productName?: string      // null for impressions; filled for click/link_visit
  queryText: string         // raw user message that triggered the ad
  timestamp: Date
}
```

`impression` events cover the whole ad unit — `productId`/`productName` are omitted. `click`, `link_visit`, and `dismiss` events include the specific product interacted with.

`queryText` stores the raw message text for post-hoc analysis. This is acceptable per research protocol — no anonymization required.

---

### Backend (`packages/api`)

All new code lives in `packages/api/src/experiment/`.

#### `constants.ts`

```ts
export const STUDY_ID = 'study-1'
export const VARIANTS = ['control', 'sponsored-inline', 'sponsored-outside'] as const
export type Variant = typeof VARIANTS[number]
```

#### `assignment.ts`

Called from login/registration middleware. Checks if `user.experimentAssignment` exists; if not, randomly assigns one of the three variants (equal probability) and persists to the User document. Assignment is permanent — never re-assigned for the same `studyId`.

#### `intent.ts`

Keyword-based commercial intent detection. Takes `messageText: string`, returns `boolean`. Uses a configurable keyword list (e.g., buy, recommend, best, review, blender, laptop, hotel, restaurant, price, cheap, deal). No LLM call — synchronous, zero latency impact.

#### `ads.ts`

Mock ad service. Returns a hardcoded fixture of 5 products in the `application/vnd.librechat.product-card+json` shape. Returns a random subset of 2 per call to simulate ad rotation. Structured so the fixture can be replaced with a real ad API without changing the interface.

#### Route: `POST /api/experiment/ad-context`

Auth-gated. Thin JS wrapper in `/api` calls into `packages/api`.

**Request body:**
```ts
{
  messageText: string
  conversationId: string
  messageId: string
}
```

**Logic:**
1. Read `req.user.experimentAssignment.variant`
2. If `control` → return `{ showAd: false }`
3. Run intent detector on `messageText`
4. If no intent → return `{ showAd: false }`
5. Fetch mock ad products
6. Log `AdEvent` with `eventType: 'impression'`
7. Append `messageId` to `Conversation.experimentContext.adShownAt`
8. Return `{ showAd: true, variant, products }`

**Separate click-tracking endpoint:** `POST /api/experiment/ad-event` — accepts `{ eventType, productId, productName, productSource, conversationId, messageId }`, logs an `AdEvent`. Used by frontend for click/link_visit/dismiss events.

---

### Frontend (`client/src`)

#### `context/ExperimentContext.tsx`

Reads `experimentVariant` from the existing config response (requires adding this field to the `/api/config` output and its TypeScript type). Exposes `{ variant: Variant | null }` via React context. Provider wraps the app alongside existing context providers.

#### `hooks/useAdContext.ts`

Fires `POST /api/experiment/ad-context` when called. Takes `{ messageText, conversationId, messageId }`. Returns `{ showAd: boolean, products: ProductCard[] | null }`. Result cached in local state keyed by `messageId` — fires once per message, no re-fetching.

#### Carousel injection — Condition B

In `UIResourceCarousel.tsx`, read variant from `ExperimentContext`. The carousel renders when MCP tool results arrive in the stream; `useAdContext` fires in parallel and may resolve before or after. The carousel checks whether the ad-context response for the current `messageId` (user's message ID) has resolved — if yes, appends sponsored cards immediately; if not yet, appends them once the response arrives. This avoids a flash of organic-only content followed by injection. Sponsored cards use the existing `ProductCard` component with a `sponsored: true` prop that renders the badge. No new component required.

#### `SponsoredPanel` component — Condition C

**Location:** `components/Chat/Messages/SponsoredPanel.tsx`

Renders below the assistant message action buttons (copy, thumbs up/down, regenerate). Only mounts when variant is `sponsored-outside` and `useAdContext` returned products for that `messageId`.

Layout matches the ChatGPT sponsored ad format:
- Brand icon (colored circle) + brand name + "Sponsored" label
- `···` options button (top right)
- Horizontally scrollable product cards (same dimensions as carousel cards)
- Footer: "Ads do not influence the answers you get. Learn more ›"

#### Click tracking

`ProductCard` receives an optional `onProductClick` callback. When a sponsored card is clicked, fires `POST /api/experiment/ad-event` with `eventType: 'click'`. When the external purchase URL is followed, fires `eventType: 'link_visit'`. Organic card clicks in B/C sessions are also tracked with `productSource: 'organic'` for baseline comparison.

---

### Data the Study Can Export

By joining `AdEvent`, `User.experimentAssignment`, and `Conversation.experimentContext`:

- **Impression rate** by variant and query type
- **Click-through rate** on sponsored vs. organic products per condition
- **Link visit rate** (downstream purchase intent proxy)
- **Dismissal rate** (Condition C only)
- **Query text** for qualitative coding of commercial intent accuracy

Survey responses (7-point Likert scales for persuasion inference, transparency, system/message/brand trust, compliance, continued usage) are collected externally (Qualtrics or equivalent) and joined to behavioral data via `userId` + `conversationId` passed as URL parameters in the survey link.

---

### What This Does Not Include

- Study 2 (placement × framing) and Study 3 (timing) conditions — separate specs when ready
- Real ad API integration — mock fixture only for Study 1
- In-app survey UI — external tool handles this
- Admin dashboard for experiment monitoring — out of scope for Study 1
