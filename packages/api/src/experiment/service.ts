import type { IAdEvent, AdEventType, ProductSource } from '@librechat/data-schemas';
import type mongoose from 'mongoose';
import type { ProductCardData } from './ads';
import type { Variant } from './constants';
import { searchProducts } from './search';
import { STUDY_ID } from './constants';

interface AdContextParams {
  userId: string;
  variant: Variant;
  conversationId: string;
  messageId: string;
  messageText: string;
  db: typeof mongoose;
}

interface AdContextNoAd {
  showAd: false;
}

interface AdContextWithAd {
  showAd: true;
  variant: Variant;
  products: ProductCardData[];
  queryText: string;
}

export async function getAdContext(
  params: AdContextParams,
): Promise<AdContextNoAd | AdContextWithAd> {
  const { userId, variant, conversationId, messageId, messageText, db } = params;

  if (variant === 'control') {
    return { showAd: false };
  }

  let products: ProductCardData[];
  try {
    products = await searchProducts(messageText, 2);
  } catch {
    return { showAd: false };
  }

  if (products.length === 0) {
    return { showAd: false };
  }

  await logAdEvent({
    userId,
    conversationId,
    messageId,
    studyId: STUDY_ID,
    variant,
    eventType: 'impression',
    productSource: 'sponsored',
    queryText: messageText,
    db,
  });

  return { showAd: true, variant, products, queryText: messageText };
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
