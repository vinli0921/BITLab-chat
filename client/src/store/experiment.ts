import { atom } from 'jotai';
import type { ProductCardData } from '@librechat/api';

export interface AdContextResult {
  showAd: true;
  variant: string;
  products: ProductCardData[];
  queryText: string;
}

export const adContextAtom = atom<Record<string, AdContextResult>>({});
