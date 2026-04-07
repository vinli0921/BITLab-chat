import React, { useMemo } from 'react';
import type { UIResource } from 'librechat-data-provider';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import UIResourceCarousel from '../Chat/Messages/Content/UIResourceCarousel';
import { useOptionalMessagesConversation } from '~/Providers';
import { useMessageContext } from '~/Providers/MessageContext';

interface MCPUIResourceCarouselProps {
  node: {
    properties: {
      resourceIds?: string[];
    };
  };
}

/** Renders multiple MCP UI resources in a carousel. Works in chat, share, and search views. */
export function MCPUIResourceCarousel(props: MCPUIResourceCarouselProps) {
  const { conversationId } = useOptionalMessagesConversation();
  const { userMessageId } = useMessageContext();

  const conversationResourceMap = useConversationUIResources(conversationId ?? undefined);

  const uiResources = useMemo(() => {
    const { resourceIds = [] } = props.node.properties;

    return resourceIds.map((id) => conversationResourceMap.get(id)).filter(Boolean) as UIResource[];
  }, [props.node.properties, conversationResourceMap]);

  if (uiResources.length === 0) {
    return null;
  }

  return <UIResourceCarousel uiResources={uiResources} userMessageId={userMessageId} />;
}
