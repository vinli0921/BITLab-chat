import { useRef, useCallback } from 'react';
import { postAdEvent } from '~/hooks/useAdContext';

interface MessageTrackingParams {
  messageId: string;
  conversationId: string;
}

/**
 * Provides viewport (IntersectionObserver) and scroll-depth tracking for assistant messages.
 * Attach the returned `trackingRef` to the message container. Fires response_viewport_enter /
 * response_viewport_exit events to support all study arms (including control). Scroll depth
 * is the maximum visible fraction observed while in view — seeded at enter, updated on scroll.
 */
export function useMessageTracking({ messageId, conversationId }: MessageTrackingParams) {
  const enterTimeRef = useRef<number | null>(null);
  const maxScrollDepthRef = useRef<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  const computeScrollDepth = useCallback((el: HTMLElement): number => {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (rect.height === 0) return 0;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visible = Math.max(0, visibleBottom - visibleTop);
    return Math.min(100, (visible / rect.height) * 100);
  }, []);

  const fireExit = useCallback(() => {
    const dwellTimeMs =
      enterTimeRef.current != null ? Date.now() - enterTimeRef.current : undefined;
    const scrollDepthPercent = Math.round(maxScrollDepthRef.current);
    enterTimeRef.current = null;
    maxScrollDepthRef.current = 0;
    postAdEvent({
      eventType: 'response_viewport_exit',
      productSource: 'none',
      messageId,
      conversationId,
      dwellTimeMs,
      scrollDepthPercent,
    });
  }, [messageId, conversationId]);

  const trackingRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        if (enterTimeRef.current != null) {
          fireExit();
        }
        observerRef.current = null;
      }
      if (scrollHandlerRef.current) {
        window.removeEventListener('scroll', scrollHandlerRef.current, true);
        scrollHandlerRef.current = null;
      }
      if (!el) return;

      const onScroll = () => {
        const depth = computeScrollDepth(el);
        if (depth > maxScrollDepthRef.current) {
          maxScrollDepthRef.current = depth;
        }
      };
      scrollHandlerRef.current = onScroll;
      window.addEventListener('scroll', onScroll, true);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              enterTimeRef.current = Date.now();
              maxScrollDepthRef.current = computeScrollDepth(el);
              postAdEvent({
                eventType: 'response_viewport_enter',
                productSource: 'none',
                messageId,
                conversationId,
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
    [messageId, conversationId, computeScrollDepth, fireExit],
  );

  return { trackingRef };
}
