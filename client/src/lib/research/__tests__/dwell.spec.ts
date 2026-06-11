import { DwellClock } from '../dwell';

describe('DwellClock', () => {
  it('accumulates only active time', () => {
    const clock = new DwellClock();
    clock.start(1000, true);
    clock.setActive(3000, false); // 2000ms active
    clock.setActive(6000, true); // 3000ms inactive (not counted)
    const result = clock.stop(7000); // 1000ms more active
    expect(result).toEqual({ wallMs: 6000, activeMs: 3000 });
  });

  it('handles starting while inactive', () => {
    const clock = new DwellClock();
    clock.start(0, false);
    clock.setActive(500, true);
    const result = clock.stop(1500);
    expect(result).toEqual({ wallMs: 1500, activeMs: 1000 });
  });

  it('returns null when stopped without start, and resets after stop', () => {
    const clock = new DwellClock();
    expect(clock.stop(100)).toBeNull();
    clock.start(0, true);
    clock.stop(100);
    expect(clock.stop(200)).toBeNull();
  });

  it('ignores redundant setActive transitions', () => {
    const clock = new DwellClock();
    clock.start(0, true);
    clock.setActive(100, true);
    clock.setActive(200, true);
    const result = clock.stop(300);
    expect(result).toEqual({ wallMs: 300, activeMs: 300 });
  });
});
