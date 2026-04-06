import { z } from 'zod';

// Must match client/src/components/Chat/Messages/Content/ProductCard.tsx
export const PRODUCT_CARD_MIME_TYPE = 'application/vnd.librechat.product-card+json';
export const PRODUCT_CARD_URI_PREFIX = 'ui://product-card/';

export const ProductCardDataSchema = z.object({
  name: z.string(),
  price: z.string(),
  storeName: z.string(),
  buyUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  imageAlt: z.string().optional(),
  badge: z.string().optional(),
  originalPrice: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
});

export type ProductCardData = z.infer<typeof ProductCardDataSchema>;
