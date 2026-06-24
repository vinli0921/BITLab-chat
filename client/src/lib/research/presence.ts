import { emitResearchEvent } from './queue';

type PresenceListener = (active: boolean) => void;

const listeners = new Set<PresenceListener>();
let active = computeActive();
let attached = false;

function computeActive(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  return !document.hidden && document.hasFocus();
}

function handleChange(): void {
  const next = computeActive();
  if (next === active) {
    return;
  }
  active = next;
  emitResearchEvent({ eventType: 'chat_presence', payload: { active: next } });
  listeners.forEach((listener) => listener(next));
}

/**
 * Intentionally attaches per module instance (unlike queue.ts's global-symbol
 * guard): resetModules-based tests need a fresh listener per import, and HMR
 * duplication is benign because each instance only mutates its own state.
 */
function attach(): void {
  if (attached || typeof document === 'undefined') {
    return;
  }
  attached = true;
  document.addEventListener('visibilitychange', handleChange);
  window.addEventListener('focus', handleChange);
  window.addEventListener('blur', handleChange);
}

attach();

export function isActive(): boolean {
  return active;
}

export function subscribePresence(listener: PresenceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
