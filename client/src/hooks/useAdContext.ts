import axios from 'axios';
import { useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import type { AdContextResult } from '~/store/experiment';
import { adContextAtom } from '~/store/experiment';

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
  const firedRef = useRef(new Set<string>());

  const getAdContext = useCallback(
    async ({ userMessageId, userMessageText, conversationId }: AdContextParams) => {
      if (firedRef.current.has(userMessageId)) return;
      firedRef.current.add(userMessageId);

      try {
        const { data } = await axios.post('/api/experiment/ad-context', {
          messageText: userMessageText,
          conversationId,
          messageId: userMessageId,
        });
        if (data.showAd) {
          setAdContextMap((prev) => ({ ...prev, [userMessageId]: data as AdContextResult }));
        }
      } catch {
        // Non-critical — silently skip network errors
      }
    },
    [setAdContextMap],
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
  dwellTimeMs?: number;
  hoverTimeMs?: number;
  scrollDepthPercent?: number;
  linkUrl?: string;
}): Promise<void> {
  try {
    await axios.post('/api/experiment/ad-event', params);
  } catch {
    // Non-critical tracking — silently skip
  }
}
