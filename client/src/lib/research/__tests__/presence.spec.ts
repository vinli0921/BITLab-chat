/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('../queue', () => ({ emitResearchEvent: jest.fn() }));

describe('presence', () => {
  let setHidden: (hidden: boolean) => void;
  let setFocused: (next: boolean) => void;

  beforeEach(() => {
    jest.resetModules();
    let hidden = false;
    let focused = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    jest.spyOn(document, 'hasFocus').mockImplementation(() => focused && !hidden);
    setHidden = (next: boolean) => {
      hidden = next;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setFocused = (next: boolean) => {
      focused = next;
      window.dispatchEvent(new Event(next ? 'focus' : 'blur'));
    };
  });

  it('reports active and notifies subscribers on change', () => {
    const { isActive, subscribePresence } = require('../presence');
    const seen: boolean[] = [];
    subscribePresence((active: boolean) => seen.push(active));
    expect(isActive()).toBe(true);
    setHidden(true);
    expect(isActive()).toBe(false);
    setHidden(false);
    expect(seen).toEqual([false, true]);
  });

  it('emits chat_presence research events on transitions', () => {
    require('../presence');
    // Re-require AFTER resetModules so we assert against the same mock
    // instance the freshly-loaded presence module imported.
    const { emitResearchEvent } = require('../queue');
    setHidden(true);
    expect(emitResearchEvent).toHaveBeenCalledWith({
      eventType: 'chat_presence',
      payload: { active: false },
    });
  });

  it('unsubscribes cleanly', () => {
    const { subscribePresence } = require('../presence');
    const listener = jest.fn();
    const unsubscribe = subscribePresence(listener);
    unsubscribe();
    setHidden(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('treats visible-but-unfocused as inactive (focus gating)', () => {
    const { isActive, subscribePresence } = require('../presence');
    const seen: boolean[] = [];
    subscribePresence((active: boolean) => seen.push(active));
    expect(isActive()).toBe(true);
    setFocused(false); // window blur, document still visible
    expect(isActive()).toBe(false);
    setFocused(true); // window focus
    expect(isActive()).toBe(true);
    expect(seen).toEqual([false, true]);
  });
});
