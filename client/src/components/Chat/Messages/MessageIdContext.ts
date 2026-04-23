import { createContext, useContext } from 'react';

interface MessageIdContextValue {
  messageId: string;
  conversationId: string;
}

const MessageIdContext = createContext<MessageIdContextValue | null>(null);

export const MessageIdProvider = MessageIdContext.Provider;

export function useMessageIdContext(): MessageIdContextValue | null {
  return useContext(MessageIdContext);
}
