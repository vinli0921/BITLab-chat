import axios from 'axios';
import type { ResearchPayloadValue } from 'librechat-data-provider';

const ENDPOINT = '/api/research/events';
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;

export interface ResearchEventDraft {
  eventType: string;
  conversationId?: string;
  messageId?: string;
  payload?: Record<string, ResearchPayloadValue>;
}

export interface BufferedResearchEvent extends ResearchEventDraft {
  eventId: string;
  tsWall: number;
  tsMono: number;
  platform: string;
}

export class ResearchEventQueue {
  private buffer: BufferedResearchEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  enqueue(draft: ResearchEventDraft): void {
    this.buffer.push({
      ...draft,
      eventId: crypto.randomUUID(),
      tsWall: Date.now(),
      tsMono: performance.now(),
      platform: 'bitlab-chat',
    });
    if (this.buffer.length >= MAX_BATCH) {
      void this.flush();
      return;
    }
    this.ensureTimer();
  }

  peek(): readonly BufferedResearchEvent[] {
    return [...this.buffer];
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }
    this.flushing = true;
    const events = this.buffer.splice(0, MAX_BATCH);
    try {
      await axios.post(ENDPOINT, { events });
    } catch {
      this.buffer.unshift(...events);
    } finally {
      this.flushing = false;
      if (this.buffer.length === 0 && this.timer != null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  private ensureTimer(): void {
    if (this.timer != null) {
      return;
    }
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }
}

export const researchQueue = new ResearchEventQueue();

export function emitResearchEvent(draft: ResearchEventDraft): void {
  researchQueue.enqueue(draft);
}

const LISTENER_FLAG = Symbol.for('bitlab.research.queue.visibilityListener');
type FlaggedGlobal = typeof globalThis & { [LISTENER_FLAG]?: boolean };

const flaggedGlobal = globalThis as FlaggedGlobal;
if (typeof document !== 'undefined' && flaggedGlobal[LISTENER_FLAG] !== true) {
  flaggedGlobal[LISTENER_FLAG] = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void researchQueue.flush();
    }
  });
}
