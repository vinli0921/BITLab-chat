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
