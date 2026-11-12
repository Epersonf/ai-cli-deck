import { describe, expect, it } from 'vitest';
import { formatClock, secondsUntil, stepFraction, stepSecondsLeft } from './otpClock';

describe('otp clock', () => {
  it('counts the step by the wall clock', () => {
    expect(stepSecondsLeft(0)).toBe(30);
    expect(stepSecondsLeft(12_000)).toBe(18);
    expect(stepSecondsLeft(29_999)).toBeCloseTo(0.001, 3);
    expect(stepFraction(15_000)).toBe(0.5);
  });

  it('counts whole seconds to a deadline', () => {
    expect(secondsUntil(10_500, 10_000)).toBe(1);
    expect(secondsUntil(10_000, 12_000)).toBe(0);
  });

  it('formats mm:ss', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(-4)).toBe('0:00');
  });
});
