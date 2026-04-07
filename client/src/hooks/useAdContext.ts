import { useCallback } from 'react';
import { useAtom } from 'jotai';
import type { AdContextResult } from '~/store/experiment';
import { adContextAtom, adContextFiredAtom } from '~/store/experiment';

interface AdContextParams {
  userMessageId: string;
  userMessageText: string;
  conversationId: string;
}

interface UseAdContextReturn {
  getAdContext: (params: AdContextParams) => Promise<void>;
  getResult: (userMessageId: string) => AdContextResult | undefined;
}

export function useAdContext(): UseAdContextReturn {
  const [adContextMap, setAdContextMap] = useAtom(adContextAtom);
  const [firedSet, setFiredSet] = useAtom(adContextFiredAtom);

  const getAdContext = useCallback(
    async ({ userMessageId, userMessageText, conversationId }: AdContextParams) => {
      if (firedSet.has(userMessageId)) return;
      setFiredSet((prev) => new Set([...prev, userMessageId]));

      try {
        const res = await fetch('/api/experiment/ad-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageText: userMessageText,
            conversationId,
            messageId: userMessageId,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.showAd) {
          setAdContextMap((prev) => ({ ...prev, [userMessageId]: data as AdContextResult }));
        }
      } catch {
        // Non-critical — silently skip network errors
      }
    },
    [firedSet, setFiredSet, setAdContextMap],
  );

  const getResult = useCallback(
    (userMessageId: string) => adContextMap[userMessageId],
    [adContextMap],
  );

  return { getAdContext, getResult };
}

export async function postAdEvent(params: {
  eventType: string;
  productSource: string;
  productId?: string;
  productName?: string;
  conversationId: string;
  messageId: string;
  queryText?: string;
}): Promise<void> {
  try {
    await fetch('/api/experiment/ad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-critical tracking — silently skip
  }
}
