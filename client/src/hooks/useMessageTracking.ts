import { useRef, useCallback, useEffect } from 'react';
import { isActive, subscribePresence } from '~/lib/research/presence';
import { emitResearchEvent } from '~/lib/research/queue';
import { postAdEvent } from '~/hooks/useAdContext';
import { DwellClock } from '~/lib/research/dwell';

interface MessageTrackingParams {
  messageId: string;
  conversationId: string;
}

/**
 * Provides viewport (IntersectionObserver) and scroll-depth tracking for assistant messages.
 * Attach the returned `trackingRef` to the message container. Fires response_viewport_enter /
 * response_viewport_exit AdEvents (legacy, unchanged) plus ResearchEvent envelopes with
 * visibility-gated active dwell and a revisit index. Scroll depth is the maximum visible
 * fraction observed while in view — seeded at enter, updated on scroll.
 */
export function useMessageTracking({ messageId, conversationId }: MessageTrackingParams) {
  const dwellClockRef = useRef(new DwellClock());
  const maxScrollDepthRef = useRef<number>(0);
  // Counts viewport entries for this hook instance only: remounts (route changes,
  // virtualization) reset it, so cross-mount revisits re-emit revisitIndex 0 —
  // downstream revisit aggregation must treat the index as per-mount, not per-message.
  const enterCountRef = useRef<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePresence((active) => {
      dwellClockRef.current.setActive(Date.now(), active);
    });
    return unsubscribe;
  }, []);

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
    const dwell = dwellClockRef.current.stop(Date.now());
    if (dwell == null) {
      return;
    }
    const scrollDepthPercent = Math.round(maxScrollDepthRef.current);
    maxScrollDepthRef.current = 0;
    // Transitional dual-write: the legacy AdEvent write retires after ResearchEvent
    // validation — when cleaning up, remove postAdEvent calls, keep emitResearchEvent.
    postAdEvent({
      eventType: 'response_viewport_exit',
      productSource: 'none',
      messageId,
      conversationId,
      dwellTimeMs: dwell.wallMs,
      scrollDepthPercent,
    });
    emitResearchEvent({
      eventType: 'response_viewport_exit',
      messageId,
      conversationId,
      payload: {
        dwellWallMs: dwell.wallMs,
        dwellActiveMs: dwell.activeMs,
        scrollDepthPercent,
        revisitIndex: enterCountRef.current - 1,
      },
    });
  }, [messageId, conversationId]);

  const trackingRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        if (dwellClockRef.current.running) {
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
              dwellClockRef.current.start(Date.now(), isActive());
              maxScrollDepthRef.current = computeScrollDepth(el);
              enterCountRef.current += 1;
              postAdEvent({
                eventType: 'response_viewport_enter',
                productSource: 'none',
                messageId,
                conversationId,
              });
              emitResearchEvent({
                eventType: 'response_viewport_enter',
                messageId,
                conversationId,
                payload: { revisitIndex: enterCountRef.current - 1 },
              });
            } else if (dwellClockRef.current.running) {
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
