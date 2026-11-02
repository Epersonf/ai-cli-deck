import { describe, expect, it } from 'vitest';
import { OFF, consume, isActive, tap } from './stickyModifier';

describe('sticky modifier', () => {
  it('arms on tap and releases after one key', () => {
    const armed = tap(OFF, 1000);
    expect(armed.mode).toBe('armed');
    expect(isActive(armed)).toBe(true);
    expect(consume(armed)).toEqual(OFF);
  });

  it('locks on a quick second tap and stays after keys', () => {
    const locked = tap(tap(OFF, 1000), 1200);
    expect(locked.mode).toBe('locked');
    expect(consume(locked).mode).toBe('locked');
  });

  it('releases when tapped again, or when the second tap is slow', () => {
    expect(tap(tap(tap(OFF, 1000), 1200), 5000)).toEqual(OFF);
    expect(tap(tap(OFF, 1000), 3000)).toEqual(OFF);
  });
});
