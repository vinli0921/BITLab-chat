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
      className="group flex h-full flex-col overflow-hidden rounded-xl no-underline"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="relative aspect-[13/16] w-full overflow-hidden rounded-xl bg-[#F3F3F3] dark:bg-[#F3F3F3]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            className="absolute inset-0 m-0 h-full w-full object-cover object-top mix-blend-darken transition-transform duration-300 ease-out hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
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

      <div className="flex flex-col gap-1 px-1 pt-2">
        {sponsored && (
          <span className="text-[11px] text-text-secondary">{localize('com_ui_sponsored')}</span>
        )}
        <p className="line-clamp-2 text-sm font-medium text-text-primary">{product.name}</p>
        <span className="text-sm text-text-secondary">
          {product.price}
          {product.storeName && (
            <>
              <span className="mx-0.5">&bull;</span>
              {product.storeName}
            </>
          )}
        </span>
        {product.rating != null && (
          <span className="flex items-center gap-0.5 text-sm text-text-secondary">
            <Star className="mb-[0.1875rem] inline-block h-3 w-3 fill-current" />
            {product.rating}
          </span>
        )}
      </div>
    </a>
  );
}
