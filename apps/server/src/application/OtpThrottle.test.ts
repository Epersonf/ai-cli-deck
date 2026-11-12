import { describe, expect, it } from 'vitest';
import { OtpThrottle } from './OtpThrottle.js';

const MIN = 60_000;
function setup() {
  let now = 1_000_000;
  const throttle = new OtpThrottle(() => now);
  const wrong = (key = 'a', times = 3) => Array.from({ length: times }, () => throttle.fail(key));
  return { throttle, wrong, advance: (ms: number) => (now += ms) };
}

describe('the one-time code ban', () => {
  it('counts three tries a round, then locks for a minute', () => {
    const { throttle, wrong, advance } = setup();
    expect(wrong('a', 3)).toEqual([
      { triesLeft: 2, wait: 0 },
      { triesLeft: 1, wait: 0 },
      { triesLeft: 0, wait: 60 },
    ]);
    expect(throttle.check('a')).toBe(60);
    advance(30_000);
    expect(throttle.check('a')).toBe(30);
    expect(throttle.check('b')).toBe(0);
    advance(30_000);
    expect(throttle.check('a')).toBe(0);
  });

  it('locks longer each round: 1, 5, 15, then 60 minutes and no more', () => {
    const { throttle, wrong, advance } = setup();
    const waits: number[] = [];
    for (let round = 0; round < 6; round += 1) {
      waits.push(wrong('a', 3)[2]?.wait ?? -1);
      advance(throttle.check('a') * 1000);
    }
    expect(waits).toEqual([60, 300, 900, 3600, 3600, 3600]);
  });

  it('forgets a client after an hour without failures, and a right code clears it', () => {
    const { throttle, wrong, advance } = setup();
    wrong('a', 2);
    advance(61 * MIN);
    expect(throttle.fail('a').triesLeft).toBe(2);
    wrong('a', 2);
    advance(61_000);
    expect(wrong('a', 3)[2]?.wait).toBe(300);
    advance(6 * MIN);
    throttle.succeed('a');
    expect(throttle.fail('a').triesLeft).toBe(2);
    wrong('b', 3);
    advance(61 * MIN);
    expect(throttle.fail('b')).toEqual({ triesLeft: 2, wait: 0 });
  });
});
