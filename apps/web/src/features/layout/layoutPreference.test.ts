import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, MAX_RATIO, MIN_RATIO, clampRatio, parseLayout } from './layoutPreference';

describe('clampRatio', () => {
  it('keeps both panels usable and repairs bad numbers', () => {
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(0.01)).toBe(MIN_RATIO);
    expect(clampRatio(0.99)).toBe(MAX_RATIO);
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_LAYOUT.ratio);
  });
});

describe('parseLayout', () => {
  it('reads a valid stored layout', () => {
    expect(parseLayout('{"showRight":false,"rightView":"preview","ratio":0.4}')).toEqual({
      showRight: false,
      rightView: 'preview',
      ratio: 0.4,
    });
  });

  it('repairs invalid fields individually', () => {
    expect(parseLayout('{"showRight":"yes","rightView":"nope","ratio":5}')).toEqual({
      showRight: true,
      rightView: 'files',
      ratio: MAX_RATIO,
    });
  });

  it('falls back to defaults for missing or broken data', () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{ not json')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('[]')).toEqual(DEFAULT_LAYOUT);
  });
});
