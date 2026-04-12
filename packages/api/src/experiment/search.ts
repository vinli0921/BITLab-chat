import type { ProductCardData } from './ads';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

interface ShoppingResult {
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  product_link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  tag?: string;
  extensions?: string[];
}

interface ShoppingResponse {
  shopping_results?: ShoppingResult[];
  error?: string;
}

function mapShoppingResult(item: ShoppingResult): ProductCardData | null {
  const name = item.title?.trim();
  const storeName = item.source?.trim();
  const buyUrl = item.product_link?.trim();

  const price =
    item.price?.trim() ??
    (item.extracted_price != null ? `$${item.extracted_price.toFixed(2)}` : undefined);

  if (!name || !storeName || !buyUrl || !price) {
    return null;
  }

  try {
    const protocol = new URL(buyUrl).protocol;
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  const product: ProductCardData = { name, price, storeName, buyUrl };

  if (item.thumbnail) {
    product.imageUrl = item.thumbnail;
  }
  if (item.old_price) {
    product.originalPrice = item.old_price;
  }
  if (typeof item.rating === 'number') {
    product.rating = item.rating;
  }
  if (typeof item.reviews === 'number') {
    product.reviewCount = item.reviews;
  }

  const badge = item.tag ?? item.extensions?.[0];
  if (badge) {
    product.badge = badge;
  }

  return product;
}

export async function searchProducts(
  query: string,
  maxResults: number,
): Promise<ProductCardData[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query.slice(0, 200),
      api_key: apiKey,
      gl: 'us',
      hl: 'en',
    });

    const response = await fetch(`${SERPAPI_BASE}?${params}`);
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as ShoppingResponse;
    if (data.error) {
      return [];
    }

    return (data.shopping_results ?? [])
      .map(mapShoppingResult)
      .filter((p): p is ProductCardData => p !== null)
      .slice(0, maxResults);
  } catch {
    return [];
  }
}
