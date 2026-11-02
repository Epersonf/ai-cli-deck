import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './LoginThrottle.js';

describe('LoginThrottle', () => {
  it('blocks after max failures until the window ends, and resets on success', () => {
    let now = 0;
    const throttle = new LoginThrottle(() => now, 3, 60_000);
    for (let i = 0; i < 3; i += 1) {
      expect(throttle.check('ip')).toBe(0);
      throttle.fail('ip');
    }
    expect(throttle.check('ip')).toBe(60);
    expect(throttle.check('other')).toBe(0);
    now = 30_000;
    expect(throttle.check('ip')).toBe(30);
    now = 60_000;
    expect(throttle.check('ip')).toBe(0);
    throttle.fail('ip');
    throttle.succeed('ip');
    expect(throttle.check('ip')).toBe(0);
  });
});
