import { useRef, useCallback } from 'react';
import { postAdEvent } from '~/hooks/useAdContext';

interface AdTrackingParams {
  messageId: string;
  conversationId: string;
  queryText: string;
}

/**
 * Provides viewport (IntersectionObserver) and hover tracking for ad elements.
 * Attach `trackingRef` to the ad container element.
 * Uses a callback ref so the observer is attached/detached when the element mounts/unmounts,
 * even if the element renders conditionally after the hook's first call.
 */
export function useAdTracking({ messageId, conversationId, queryText }: AdTrackingParams) {
  const enterTimeRef = useRef<number | null>(null);
  const hoverStartRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fireExit = useCallback(() => {
    const dwellTimeMs =
      enterTimeRef.current != null ? Date.now() - enterTimeRef.current : undefined;
    enterTimeRef.current = null;
    postAdEvent({
      productSource: 'sponsored',
      conversationId,
      messageId,
      queryText,
      eventType: 'viewport_exit',
      dwellTimeMs,
    });
  }, [messageId, conversationId, queryText]);

  const fireHoverEnd = useCallback(() => {
    const hoverTimeMs =
      hoverStartRef.current != null ? Date.now() - hoverStartRef.current : undefined;
    hoverStartRef.current = null;
    postAdEvent({
      productSource: 'sponsored',
      conversationId,
      messageId,
      queryText,
      eventType: 'hover_end',
      hoverTimeMs,
    });
  }, [messageId, conversationId, queryText]);

  const trackingRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        if (enterTimeRef.current != null) {
          fireExit();
        }
        if (hoverStartRef.current != null) {
          fireHoverEnd();
        }
        observerRef.current = null;
      }

      if (!el) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              enterTimeRef.current = Date.now();
              postAdEvent({
                productSource: 'sponsored',
                conversationId,
                messageId,
                queryText,
                eventType: 'viewport_enter',
              });
            } else if (enterTimeRef.current != null) {
              fireExit();
            }
          }
        },
        { threshold: 0.5 },
      );

      observer.observe(el);
      observerRef.current = observer;
    },
    [messageId, conversationId, queryText, fireExit, fireHoverEnd],
  );

  const onHoverStart = useCallback(() => {
    hoverStartRef.current = Date.now();
    postAdEvent({
      productSource: 'sponsored',
      conversationId,
      messageId,
      queryText,
      eventType: 'hover_start',
    });
  }, [messageId, conversationId, queryText]);

  const onHoverEnd = fireHoverEnd;

  return { trackingRef, onHoverStart, onHoverEnd };
}
