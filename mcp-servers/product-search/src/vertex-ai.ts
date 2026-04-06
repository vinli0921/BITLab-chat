import { VertexAI } from '@google-cloud/vertexai';
import { ProductCardDataSchema, type ProductCardData } from './types.js';

const SEARCH_PROMPT = `You are a product search assistant. Use Google Search to find real, currently purchasable products matching the user's query.

Return ONLY a valid JSON array of product objects. No markdown, no explanation, no code fences.

Each object must have these fields:
- name (string): Full product name including brand
- price (string): Current price with currency symbol, e.g. "$24.99"
- storeName (string): Retailer name, e.g. "Amazon", "Sephora"
- buyUrl (string): Direct product page URL (must be https://)
- imageUrl (string, optional): Product image URL (must be https://)
- badge (string, optional): Label like "Best Seller", "Editor's Pick", "Sale"
- originalPrice (string, optional): Original price if discounted
- rating (number, optional): Rating out of 5, e.g. 4.5
- reviewCount (number, optional): Number of reviews as integer`;

const DETAILS_PROMPT = `You are a product information assistant. Given a product page URL, use Google Search to find detailed information about that specific product.

Return ONLY a single valid JSON object (not an array). No markdown, no explanation, no code fences.

The object must have these fields:
- name (string): Full product name including brand
- price (string): Current price with currency symbol
- storeName (string): Retailer name
- buyUrl (string): The product page URL
- imageUrl (string, optional): Product image URL
- badge (string, optional): Any notable label
- originalPrice (string, optional): Original price if discounted
- rating (number, optional): Rating out of 5
- reviewCount (number, optional): Number of reviews`;

function getConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  const model = process.env.VERTEX_MODEL ?? 'gemini-2.0-flash-001';

  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  return { project, location, model };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/^```(?:json)?\r?\n?/i, '').replace(/\r?\n?```\s*$/i, '').trim();
}

function parseProductArray(raw: string): ProductCardData[] {
  const cleaned = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON array from within text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  // Validate each item individually — bad items are silently dropped
  return parsed.flatMap((item) => {
    const result = ProductCardDataSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

function parseProductObject(raw: string, fallbackUrl: string): ProductCardData {
  const cleaned = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // fall through to fallback
      }
    }
  }

  if (parsed) {
    const result = ProductCardDataSchema.safeParse(parsed);
    if (result.success) return result.data;
  }

  let hostname: string;
  try {
    hostname = new URL(fallbackUrl).hostname;
  } catch {
    hostname = fallbackUrl;
  }

  return {
    name: 'Product Details',
    price: 'See website',
    storeName: hostname,
    buyUrl: fallbackUrl,
  };
}

export async function searchProducts(query: string, maxResults: number): Promise<ProductCardData[]> {
  const { project, location, model: modelName } = getConfig();
  const vertexai = new VertexAI({ project, location });

  const model = vertexai.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: SEARCH_PROMPT }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
    tools: [{ googleSearchRetrieval: {} }],
  });

  const result = await model.generateContent(
    `Search for up to ${maxResults} products matching: "${query}"`,
  );

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Empty response from Vertex AI');
  }

  return parseProductArray(responseText).slice(0, maxResults);
}

export async function getProductDetails(url: string): Promise<ProductCardData> {
  const { project, location, model: modelName } = getConfig();
  const vertexai = new VertexAI({ project, location });

  const model = vertexai.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: DETAILS_PROMPT }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
    tools: [{ googleSearchRetrieval: {} }],
  });

  const result = await model.generateContent(
    `Get product details for this URL: ${url}`,
  );

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Empty response from Vertex AI');
  }

  return parseProductObject(responseText, url);
}
