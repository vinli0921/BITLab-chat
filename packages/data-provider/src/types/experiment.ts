export const STUDY_ID = 'study-1' as const;
export const VARIANTS = ['control', 'sponsored-inline', 'sponsored-outside'] as const;
export type Variant = (typeof VARIANTS)[number];

export interface ProductCardData {
  name: string;
  price: string;
  storeName: string;
  buyUrl: string;
  imageUrl?: string;
  imageAlt?: string;
  badge?: string;
  originalPrice?: string;
  rating?: number;
  reviewCount?: number;
}
