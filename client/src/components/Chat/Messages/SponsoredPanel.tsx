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
    <div className="mt-2 overflow-hidden rounded-xl border border-border-light bg-surface-primary">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-bold text-white">
            {brandInitial}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text-primary">{brandName}</p>
            <p className="text-[11px] text-text-secondary">{localize('com_ui_sponsored')}</p>
          </div>
        </div>
        <button
          className="text-text-secondary hover:text-text-primary"
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

      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-3 pb-2">
        {products.map((product, i) => (
          <a
            key={i}
            href={product.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[140px] flex-col gap-1 rounded-lg border border-border-light bg-surface-secondary p-2 hover:bg-surface-hover"
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
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-16 w-full rounded object-contain"
              />
            )}
            <p className="line-clamp-2 text-[12px] font-medium text-text-primary">{product.name}</p>
            <p className="text-[12px] text-text-secondary">{product.price}</p>
          </a>
        ))}
      </div>

      <div className="border-t border-border-light px-3 py-2 text-[11px] text-text-tertiary">
        {localize('com_ui_ads_disclaimer')}{' '}
        <span className="cursor-pointer underline">{localize('com_ui_ads_learn_more')} ›</span>
      </div>
    </div>
  );
}
