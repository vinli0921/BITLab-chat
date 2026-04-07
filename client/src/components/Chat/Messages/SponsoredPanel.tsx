import React from 'react';
import type { ProductCardData } from '@librechat/api';
import { useLocalize } from '~/hooks';

interface AdEventPayload {
  eventType: 'click' | 'link_visit' | 'dismiss';
  productSource: 'sponsored';
  productId?: string;
  productName?: string;
  messageId: string;
  conversationId: string;
  queryText: string;
}

interface SponsoredPanelProps {
  products: ProductCardData[];
  messageId: string;
  conversationId: string;
  queryText: string;
  onEvent: (payload: AdEventPayload) => void;
}

export default function SponsoredPanel({
  products,
  messageId,
  conversationId,
  queryText,
  onEvent,
}: SponsoredPanelProps) {
  const localize = useLocalize();

  if (!products.length) return null;

  const brandName = products[0].storeName;
  const brandInitial = brandName.charAt(0).toUpperCase();

  return (
    <div className="mt-3">
      {/* Top separator */}
      <div className="mb-4 border-t border-border-light" />

      {/* Header: brand icon + name · Sponsored + menu */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400 text-xs font-bold text-black">
            {brandInitial}
          </div>
          <span className="text-sm text-text-primary">
            {brandName}
            <span className="text-text-tertiary"> · {localize('com_ui_sponsored')}</span>
          </span>
        </div>
        <button
          className="px-1 text-lg leading-none text-text-tertiary hover:text-text-primary"
          aria-label={localize('com_ui_ad_options')}
          onClick={() =>
            onEvent({
              eventType: 'dismiss',
              productSource: 'sponsored',
              messageId,
              conversationId,
              queryText,
            })
          }
        >
          ···
        </button>
      </div>

      {/* Product cards — text-only, side by side */}
      <div className="mb-4 flex gap-3">
        {products.map((product, i) => (
          <a
            key={i}
            href={product.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-surface-secondary p-4 transition-colors hover:bg-surface-hover"
            onClick={() =>
              onEvent({
                eventType: 'link_visit',
                productSource: 'sponsored',
                productId: product.buyUrl,
                productName: product.name,
                messageId,
                conversationId,
                queryText,
              })
            }
          >
            <p className="text-sm font-semibold text-text-primary">{product.name}</p>
            <p className="mt-1 text-sm text-text-secondary line-clamp-2">
              {product.storeName} · {product.price}
              {product.rating ? ` · ★ ${product.rating}` : ''}
            </p>
          </a>
        ))}
      </div>

      {/* Bottom separator + disclaimer */}
      <div className="border-t border-border-light pt-3 text-xs text-text-tertiary">
        {localize('com_ui_ads_disclaimer')}{' '}
        <span className="cursor-pointer hover:text-text-secondary">
          {localize('com_ui_ads_learn_more')} ›
        </span>
      </div>
    </div>
  );
}
