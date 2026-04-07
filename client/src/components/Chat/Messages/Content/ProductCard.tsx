import React from 'react';
import { Star } from 'lucide-react';
import type { ProductCardData } from '@librechat/api';
import { useLocalize } from '~/hooks';

export const PRODUCT_CARD_MIME_TYPE = 'application/vnd.librechat.product-card+json';

interface ProductCardProps {
  text: string;
  sponsored?: boolean;
}

function StarRating({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < full
                ? 'fill-yellow-400 text-yellow-400'
                : i === full && hasHalf
                  ? 'fill-yellow-200 text-yellow-400'
                  : 'fill-transparent text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
      {reviewCount != null && (
        <span className="text-xs text-text-secondary">({reviewCount.toLocaleString()})</span>
      )}
    </div>
  );
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
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-surface-secondary transition-all duration-200 hover:border-border-medium hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-tertiary">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
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
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white">
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {sponsored && (
          <span className="mb-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800">
            {localize('com_ui_sponsored')}
          </span>
        )}
        <p className="line-clamp-3 text-sm font-medium leading-snug text-text-primary">
          {product.name}
        </p>

        <div className="mt-auto flex flex-col gap-1">
          {product.rating != null && (
            <StarRating rating={product.rating} reviewCount={product.reviewCount} />
          )}

          <div className="flex flex-col">
            <span className="text-base font-bold text-text-primary">{product.price}</span>
            {product.originalPrice && product.originalPrice !== product.price && (
              <span className="text-xs text-text-secondary line-through">
                {product.originalPrice}
              </span>
            )}
          </div>

          <span className="text-xs text-text-secondary">{product.storeName}</span>
        </div>
      </div>
    </a>
  );
}
