import { useRef, useCallback, useEffect } from 'react';
import { postAdEvent } from '~/hooks/useAdContext';

interface AdTrackingParams {
  messageId: string;
  conversationId: string;
  queryText: string;
}

/**
 * Provides viewport (IntersectionObserver) and hover tracking for ad elements.
 * Attach `trackingRef` to the ad container element.
 * Calls postAdEvent for viewport_enter/viewport_exit and hover_start/hover_end.
 */
export function useAdTracking({ messageId, conversationId, queryText }: AdTrackingParams) {
  const trackingRef = useRef<HTMLDivElement>(null);
  const enterTimeRef = useRef<number | null>(null);
  const hoverStartRef = useRef<number | null>(null);

  const basePayload = {
    productSource: 'sponsored' as const,
    conversationId,
    messageId,
    queryText,
  };

  const onViewportEnter = useCallback(() => {
    enterTimeRef.current = Date.now();
    postAdEvent({ ...basePayload, eventType: 'viewport_enter' });
  }, [messageId, conversationId, queryText]);

  const onViewportExit = useCallback(() => {
    const dwellTimeMs =
      enterTimeRef.current != null ? Date.now() - enterTimeRef.current : undefined;
    enterTimeRef.current = null;
    postAdEvent({ ...basePayload, eventType: 'viewport_exit', dwellTimeMs });
  }, [messageId, conversationId, queryText]);

  const onHoverStart = useCallback(() => {
    hoverStartRef.current = Date.now();
    postAdEvent({ ...basePayload, eventType: 'hover_start' });
  }, [messageId, conversationId, queryText]);

  const onHoverEnd = useCallback(() => {
    const hoverTimeMs =
      hoverStartRef.current != null ? Date.now() - hoverStartRef.current : undefined;
    hoverStartRef.current = null;
    postAdEvent({ ...basePayload, eventType: 'hover_end', hoverTimeMs });
  }, [messageId, conversationId, queryText]);

  useEffect(() => {
    const el = trackingRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onViewportEnter();
          } else if (enterTimeRef.current != null) {
            onViewportExit();
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (enterTimeRef.current != null) {
        onViewportExit();
      }
    };
  }, [onViewportEnter, onViewportExit]);

  return { trackingRef, onHoverStart, onHoverEnd };
}
