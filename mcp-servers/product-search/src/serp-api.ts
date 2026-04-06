import { ProductCardDataSchema, type ProductCardData } from './types.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    throw new Error('SERPAPI_API_KEY environment variable is required');
  }
  return key;
}

const SERPAPI_BASE = 'https://serpapi.com/search.json';

// ---------------------------------------------------------------------------
// Google Shopping — search_products
// ---------------------------------------------------------------------------

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

  // price: prefer formatted string, fall back to extracted numeric
  const price =
    item.price?.trim() ??
    (item.extracted_price != null ? `$${item.extracted_price.toFixed(2)}` : undefined);

  if (!name || !storeName || !buyUrl || !price) return null;

  const candidate: Record<string, unknown> = {
    name,
    price,
    storeName,
    buyUrl,
  };

  if (item.thumbnail) candidate.imageUrl = item.thumbnail;
  if (item.old_price) candidate.originalPrice = item.old_price;
  if (typeof item.rating === 'number') candidate.rating = item.rating;
  if (typeof item.reviews === 'number') candidate.reviewCount = item.reviews;

  // badge: prefer the explicit tag field, fall back to first extension label
  const badge = item.tag ?? item.extensions?.[0];
  if (badge) candidate.badge = badge;

  const result = ProductCardDataSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

export async function searchProducts(
  query: string,
  maxResults: number,
): Promise<ProductCardData[]> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: apiKey,
    gl: 'us',
    hl: 'en',
  });

  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ShoppingResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const results = (data.shopping_results ?? [])
    .map(mapShoppingResult)
    .filter((p): p is ProductCardData => p !== null)
    .slice(0, maxResults);

  return results;
}

// ---------------------------------------------------------------------------
// Amazon Search — get_product_details
// ---------------------------------------------------------------------------

interface AmazonResult {
  title?: string;
  link?: string;
  thumbnail?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  rating?: number;
  reviews?: number;
  prime?: boolean;
  sponsored?: boolean;
}

interface AmazonResponse {
  organic_results?: AmazonResult[];
  error?: string;
}

/**
 * Extracts meaningful search keywords from a product URL.
 *
 * Examples:
 *   amazon.com/Sony-Wireless-Headphones/dp/B0BZQRTHJM  → "Sony Wireless Headphones"
 *   bestbuy.com/site/sony-wh-1000xm5-wireless/6505727.p → "sony wh 1000xm5 wireless"
 */
function extractKeywordsFromUrl(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return url;
  }

  // Strip common e-commerce path segments and file extensions
  const cleaned = pathname
    .replace(/\.(html?|php|aspx?|jsp)$/i, '')
    // Strip ASINs only when they follow a known Amazon product ID segment
    .replace(/\/(dp|gp\/product)\/?[A-Z0-9]{10}(\/|$)/gi, '/')
    .replace(/\/(dp|gp|product|site|p|item|items|buy|detail|details|pd|products)\b/gi, '/')
    .replace(/\/\d{5,}(\/|$)/g, '/') // strip numeric IDs
    .replace(/[/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalise the first letter of each word to make it a readable query
  return cleaned
    .split(' ')
    .filter((w) => w.length > 1)
    .join(' ');
}

function mapAmazonResult(item: AmazonResult): ProductCardData | null {
  const name = item.title?.trim();
  const buyUrl = item.link?.trim();

  const price =
    item.price?.trim() ??
    (item.extracted_price != null ? `$${item.extracted_price.toFixed(2)}` : undefined);

  if (!name || !buyUrl || !price) return null;

  const candidate: Record<string, unknown> = {
    name,
    price,
    storeName: 'Amazon',
    buyUrl,
  };

  if (item.thumbnail) candidate.imageUrl = item.thumbnail;
  if (item.old_price) candidate.originalPrice = item.old_price;
  if (typeof item.rating === 'number') candidate.rating = item.rating;
  if (typeof item.reviews === 'number') candidate.reviewCount = item.reviews;
  if (item.prime) candidate.badge = 'Prime';

  const result = ProductCardDataSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

export async function getProductDetails(url: string): Promise<ProductCardData> {
  const apiKey = getApiKey();
  const keywords = extractKeywordsFromUrl(url);

  const params = new URLSearchParams({
    engine: 'amazon',
    k: keywords,
    api_key: apiKey,
    amazon_domain: 'amazon.com',
  });

  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AmazonResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  // Return the first non-sponsored organic result
  const organicResults = (data.organic_results ?? []).filter((r) => !r.sponsored);

  for (const item of organicResults) {
    const mapped = mapAmazonResult(item);
    if (mapped) return mapped;
  }

  // Fallback stub if no results could be mapped
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  return {
    name: 'Product Details',
    price: 'See website',
    storeName: hostname,
    buyUrl: url,
  };
}
