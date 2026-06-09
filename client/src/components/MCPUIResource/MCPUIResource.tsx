import React from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';
import { useOptionalMessagesConversation, useOptionalMessagesOperations } from '~/Providers';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import { PRODUCT_CARD_MIME_TYPE } from '~/components/Chat/Messages/Content/ProductCard';
import type { ProductCardData } from 'librechat-data-provider';
import { handleUIAction } from '~/utils';
import { useLocalize } from '~/hooks';

interface MCPUIResourceProps {
  node: {
    properties: {
      resourceId: string;
    };
  };
}

/** Renders an MCP UI resource based on its resource ID. Works in chat, share, and search views. */
export function MCPUIResource(props: MCPUIResourceProps) {
  const { resourceId } = props.node.properties;
  const localize = useLocalize();
  const { ask } = useOptionalMessagesOperations();
  const { conversationId } = useOptionalMessagesConversation();

  const conversationResourceMap = useConversationUIResources(conversationId ?? undefined);

  const uiResource = conversationResourceMap.get(resourceId ?? '');

  if (!uiResource) {
    return (
      <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
        {localize('com_ui_ui_resource_not_found', {
          0: resourceId ?? '',
        })}
      </span>
    );
  }

  if (uiResource.mimeType === PRODUCT_CARD_MIME_TYPE) {
    let product: ProductCardData | null = null;
    try {
      product = JSON.parse(uiResource.text ?? '') as ProductCardData;
    } catch {
      /* ignore */
    }
    if (!product) {
      return null;
    }
    return (
      <a
        href={product.buyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline no-underline hover:!text-blue-500 hover:!underline"
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        <span className="font-medium">{product.name}</span>
        <span> — {product.price}</span>
      </a>
    );
  }

  try {
    return (
      <span className="mx-1 inline-block w-full align-middle">
        <UIResourceRenderer
          resource={uiResource}
          onUIAction={async (result) => handleUIAction(result, ask)}
          htmlProps={{
            autoResizeIframe: { width: true, height: true },
            sandboxPermissions: 'allow-popups',
          }}
        />
      </span>
    );
  } catch (error) {
    console.error('Error rendering UI resource:', error);
    return (
      <span className="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
        {localize('com_ui_ui_resource_error', { 0: uiResource.name || resourceId })}
      </span>
    );
  }
}
