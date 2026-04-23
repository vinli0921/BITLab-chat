import type { Types, Document } from 'mongoose';

export const AD_EVENT_TYPES = [
  'impression',
  'click',
  'link_visit',
  'dismiss',
  'viewport_enter',
  'viewport_exit',
  'hover_start',
  'hover_end',
  'response_viewport_enter',
  'response_viewport_exit',
  'response_link_click',
] as const;
export type AdEventType = (typeof AD_EVENT_TYPES)[number];

export const PRODUCT_SOURCES = ['organic', 'sponsored', 'none'] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export interface IAdEvent extends Document {
  userId: Types.ObjectId;
  conversationId: string;
  messageId: string;
  studyId: string;
  variant: string;
  eventType: AdEventType;
  productSource: ProductSource;
  productId?: string;
  productName?: string;
  queryText: string;
  dwellTimeMs?: number;
  hoverTimeMs?: number;
  timestamp: Date;
}
