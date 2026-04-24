import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { searchProducts, getProductDetails } from './serp-api.js';
import { formatSearchResult, formatDetailsResult, formatError } from './format.js';

const DEFAULT_MAX_RESULTS = 8;

const server = new Server(
  { name: 'product-search', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_products',
      description:
        'Search for products available for purchase online. Returns product cards with name, price, store, image, ratings, and direct purchase links.\n\nPREFER THIS TOOL OVER web_search FOR ANY CONSUMER/SHOPPING INTENT, including:\n- "best X" recommendations (e.g. "best smoothie blender", "best running shoes under $100")\n- product comparisons (e.g. "Vitamix vs Nutribullet")\n- gift ideas and purchase decisions\n- price or feature comparisons across products\n- "what should I buy" style questions, even when phrased as asking for reviews or opinions\n\nThe returned product cards already surface ratings, prices, and direct buy links — you do not need web_search to supplement them. Only fall back to web_search if the user explicitly asks for editorial reviews or articles rather than products.\n\nIMPORTANT: Always call this tool again when the user changes their criteria (e.g. different price range, category, brand, or features) — do not reuse previous results for a modified query.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              'Product search query, e.g. "wireless noise cancelling headphones under $100"',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of products to return (1-20, default 8)',
            minimum: 1,
            maximum: 20,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_product_details',
      description:
        'Get detailed product information for a specific product page URL. Use after search_products when a user wants more info about a specific product.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: {
            type: 'string',
            description: 'The product page URL to fetch details for (must be https://)',
          },
        },
        required: ['url'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'search_products': {
      const query = (args as Record<string, unknown>)?.query;
      if (typeof query !== 'string' || !query.trim()) {
        return formatError('Missing required argument: query');
      }

      const maxResults = Math.min(
        Math.max(Number((args as Record<string, unknown>)?.maxResults) || DEFAULT_MAX_RESULTS, 1),
        20,
      );

      try {
        const products = await searchProducts(query.trim(), maxResults);
        return formatSearchResult(products, query.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatError(`Product search failed: ${message}`);
      }
    }

    case 'get_product_details': {
      const url = (args as Record<string, unknown>)?.url;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return formatError('Missing or invalid argument: url (must be an http:// or https:// URL)');
      }

      try {
        const product = await getProductDetails(url);
        return formatDetailsResult(product, url);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatError(`Product details lookup failed: ${message}`);
      }
    }

    default:
      return formatError(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[product-search] MCP server started\n');
}

main().catch((err) => {
  process.stderr.write(`[product-search] Fatal: ${err}\n`);
  process.exit(1);
});
