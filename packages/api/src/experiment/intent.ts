const COMMERCIAL_KEYWORDS = [
  'buy', 'purchase', 'shop', 'order', 'price', 'cost', 'cheap', 'deal', 'discount',
  'recommend', 'best', 'top', 'review', 'compare', 'vs', 'alternative',
  'blender', 'laptop', 'phone', 'camera', 'headphones', 'tv', 'monitor', 'speaker',
  'hotel', 'restaurant', 'product', 'brand', 'store', 'subscription',
];

const COMMERCIAL_PATTERN = new RegExp(`\\b(${COMMERCIAL_KEYWORDS.join('|')})\\b`, 'i');

export function detectCommercialIntent(messageText: string): boolean {
  return COMMERCIAL_PATTERN.test(messageText);
}
