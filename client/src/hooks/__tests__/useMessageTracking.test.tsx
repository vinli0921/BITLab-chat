import { renderHook, act } from '@testing-library/react';
import { useMessageTracking } from '../useMessageTracking';

const observers: Array<{
  callback: IntersectionObserverCallback;
  disconnect: jest.Mock;
  observe: jest.Mock;
}> = [];

beforeAll(() => {
  global.IntersectionObserver = jest.fn().mockImplementation((cb) => {
    const entry = {
      callback: cb,
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    };
    observers.push(entry);
    return entry;
  }) as unknown as typeof IntersectionObserver;
});

jest.mock('~/hooks/useAdContext', () => ({
  postAdEvent: jest.fn(),
}));

jest.mock('~/lib/research/queue', () => ({
  emitResearchEvent: jest.fn(),
}));

jest.mock('~/lib/research/presence', () => ({
  isActive: () => true,
  subscribePresence: jest.fn(() => jest.fn()),
}));

import { postAdEvent } from '~/hooks/useAdContext';
import { emitResearchEvent } from '~/lib/research/queue';

afterEach(() => {
  (postAdEvent as jest.Mock).mockClear();
  (emitResearchEvent as jest.Mock).mockClear();
  observers.length = 0;
});

function trigger(isIntersecting: boolean) {
  const obs = observers[observers.length - 1];
  obs.callback(
    [
      {
        isIntersecting,
        target: document.createElement('div'),
      } as unknown as IntersectionObserverEntry,
    ],
    obs as unknown as IntersectionObserver,
  );
}

describe('useMessageTracking', () => {
  it('fires response_viewport_enter then response_viewport_exit with dwellTimeMs', () => {
    const { result } = renderHook(() =>
      useMessageTracking({ messageId: 'm1', conversationId: 'c1' }),
    );
    const el = document.createElement('div');
    act(() => result.current.trackingRef(el));

    act(() => trigger(true));
    expect(postAdEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'response_viewport_enter',
        messageId: 'm1',
        conversationId: 'c1',
        productSource: 'none',
      }),
    );

    act(() => trigger(false));
    const exitCall = (postAdEvent as jest.Mock).mock.calls.find(
      ([arg]) => arg.eventType === 'response_viewport_exit',
    );
    expect(exitCall).toBeDefined();
    expect(exitCall[0].dwellTimeMs).toBeGreaterThanOrEqual(0);
    expect(exitCall[0].scrollDepthPercent).toBeGreaterThanOrEqual(0);
  });

  it('fires exit on unmount while still in viewport', () => {
    const { result, unmount } = renderHook(() =>
      useMessageTracking({ messageId: 'm2', conversationId: 'c2' }),
    );
    const el = document.createElement('div');
    act(() => result.current.trackingRef(el));
    act(() => trigger(true));
    (postAdEvent as jest.Mock).mockClear();

    act(() => result.current.trackingRef(null));
    expect(postAdEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'response_viewport_exit' }),
    );

    unmount();
  });

  it('records scroll depth when element has layout and scroll fires', () => {
    const { result } = renderHook(() =>
      useMessageTracking({ messageId: 'm3', conversationId: 'c3' }),
    );
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        top: 100,
        bottom: 500,
        left: 0,
        right: 100,
        width: 100,
        height: 400,
        x: 0,
        y: 100,
        toJSON: () => {},
      }),
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
      writable: true,
    });

    act(() => result.current.trackingRef(el));
    act(() => trigger(true));

    (postAdEvent as jest.Mock).mockClear();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => trigger(false));

    const exitCall = (postAdEvent as jest.Mock).mock.calls.find(
      ([arg]) => arg.eventType === 'response_viewport_exit',
    );
    expect(exitCall[0].scrollDepthPercent).toBeGreaterThan(0);
  });

  it('emits ResearchEvent envelopes for enter and exit with correct shape', () => {
    const { result } = renderHook(() =>
      useMessageTracking({ messageId: 'm4', conversationId: 'c4' }),
    );
    const el = document.createElement('div');
    act(() => result.current.trackingRef(el));

    act(() => trigger(true));
    expect(emitResearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'response_viewport_enter',
        payload: expect.objectContaining({ revisitIndex: 0 }),
      }),
    );

    act(() => trigger(false));
    expect(emitResearchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'response_viewport_exit',
        payload: expect.objectContaining({
          revisitIndex: 0,
          dwellWallMs: expect.any(Number),
          dwellActiveMs: expect.any(Number),
          scrollDepthPercent: expect.any(Number),
        }),
      }),
    );
  });
});
