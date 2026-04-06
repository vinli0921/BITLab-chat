import type { Types, Document } from 'mongoose';

export const AD_EVENT_TYPES = ['impression', 'click', 'link_visit', 'dismiss'] as const;
export type AdEventType = (typeof AD_EVENT_TYPES)[number];

export const PRODUCT_SOURCES = ['organic', 'sponsored'] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

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
