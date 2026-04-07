import { atom } from 'jotai';
import type { ProductCardData } from '@librechat/api';

export interface AdContextResult {
  showAd: true;
  variant: string;
  products: ProductCardData[];
}

export const adContextAtom = atom<Record<string, AdContextResult>>({});

export const adContextFiredAtom = atom<Set<string>>(new Set<string>());

export const activeUserMessageIdAtom = atom<string | null>(null);
