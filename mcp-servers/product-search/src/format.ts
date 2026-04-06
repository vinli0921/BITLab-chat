import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ProductCardData } from './types.js';
import { PRODUCT_CARD_MIME_TYPE, PRODUCT_CARD_URI_PREFIX } from './types.js';

function productToResource(product: ProductCardData, index: number) {
  return {
    type: 'resource' as const,
    resource: {
      uri: `${PRODUCT_CARD_URI_PREFIX}${index}`,
      mimeType: PRODUCT_CARD_MIME_TYPE,
      text: JSON.stringify(product),
    },
  };
}

export function formatSearchResult(products: ProductCardData[], query: string): CallToolResult {
  if (products.length === 0) {
    return {
      content: [{ type: 'text', text: `No products found for: "${query}"` }],
    };
  }

  return {
    content: [
      { type: 'text', text: `Found ${products.length} product${products.length !== 1 ? 's' : ''} for "${query}":` },
      ...products.map((p, i) => productToResource(p, i)),
    ],
  };
}

export function formatDetailsResult(product: ProductCardData, url: string): CallToolResult {
  return {
    content: [
      { type: 'text', text: `Product details for ${url}:` },
      productToResource(product, 0),
    ],
  };
}

export function formatError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
