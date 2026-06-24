export interface DwellResult {
  wallMs: number;
  activeMs: number;
}

/**
 * Accumulates wall time and visibility-gated active time between start() and stop().
 * Calling start() while running silently discards the in-progress episode.
 */
export class DwellClock {
  private wallStart: number | null = null;
  private activeSince: number | null = null;
  private accumulatedActiveMs = 0;

  start(now: number, isActive: boolean): void {
    this.wallStart = now;
    this.activeSince = isActive ? now : null;
    this.accumulatedActiveMs = 0;
  }

  setActive(now: number, isActive: boolean): void {
    if (this.wallStart == null) {
      return;
    }
    if (isActive && this.activeSince == null) {
      this.activeSince = now;
      return;
    }
    if (!isActive && this.activeSince != null) {
      this.accumulatedActiveMs += now - this.activeSince;
      this.activeSince = null;
    }
  }

  stop(now: number): DwellResult | null {
    if (this.wallStart == null) {
      return null;
    }
    if (this.activeSince != null) {
      this.accumulatedActiveMs += now - this.activeSince;
    }
    const result = { wallMs: now - this.wallStart, activeMs: this.accumulatedActiveMs };
    this.wallStart = null;
    this.activeSince = null;
    this.accumulatedActiveMs = 0;
    return result;
  }

  get running(): boolean {
    return this.wallStart != null;
  }
}
