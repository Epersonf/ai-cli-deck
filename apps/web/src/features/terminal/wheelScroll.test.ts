import { describe, expect, it } from 'vitest';
import { wheelLines } from './wheelScroll';

describe('wheelLines', () => {
  it('converts pixels, lines and pages into lines', () => {
    expect(wheelLines({ deltaY: 36, deltaMode: 0 }, 24)).toBe(2);
    expect(wheelLines({ deltaY: 3, deltaMode: 1 }, 24)).toBe(3);
    expect(wheelLines({ deltaY: 1, deltaMode: 2 }, 24)).toBe(24);
    expect(wheelLines({ deltaY: -18, deltaMode: 0 }, 24)).toBe(-1);
  });
});
