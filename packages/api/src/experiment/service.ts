import type { IAdEvent, AdEventType, ProductSource } from '@librechat/data-schemas';
import type mongoose from 'mongoose';
import type { ProductCardData } from './ads';
import type { Variant } from './constants';
import { detectCommercialIntent } from './intent';
import { STUDY_ID } from './constants';
import { getMockAds } from './ads';

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

  if (!detectCommercialIntent(messageText)) {
    return { showAd: false };
  }

  const products = getMockAds(2);

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
