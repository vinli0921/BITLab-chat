import React from 'react';
import { Star } from 'lucide-react';
import type { ProductCardData } from '@librechat/api';
import { useLocalize } from '~/hooks';

export const PRODUCT_CARD_MIME_TYPE = 'application/vnd.librechat.product-card+json';

interface ProductCardProps {
  text: string;
  sponsored?: boolean;
}

export default function ProductCard({ text, sponsored = false }: ProductCardProps) {
  const localize = useLocalize();
  let product: ProductCardData;
  try {
    product = JSON.parse(text) as ProductCardData;
  } catch {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        {localize('com_ui_invalid_product_data')}
      </div>
    );
  }

  return (
    <a
      href={product.buyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-xl"
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-surface-tertiary">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-secondary">
            <svg
              className="h-12 w-12 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 pt-2.5">
        {sponsored && (
          <span className="mb-0.5 text-[11px] text-text-secondary">
            {localize('com_ui_sponsored')}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
          {product.name}
        </p>
        <span className="text-sm text-text-secondary">
          {product.price}
          {product.storeName && ` · ${product.storeName}`}
        </span>
        {product.rating != null && (
          <div className="mt-auto flex items-center gap-1 pt-0.5">
            <Star className="h-3.5 w-3.5 fill-text-secondary text-text-secondary" />
            <span className="text-sm text-text-secondary">{product.rating}</span>
          </div>
        )}
      </div>
    </a>
  );
}
