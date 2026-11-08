import { describe, expect, it } from 'vitest';
import { acceptInput } from './inputDedup';

describe('acceptInput', () => {
  it('applies each number once per device', () => {
    expect(acceptInput('s:phone', 1)).toBe(true);
    expect(acceptInput('s:phone', 1)).toBe(false);
    expect(acceptInput('s:phone', 2)).toBe(true);
    expect(acceptInput('s:phone', 2)).toBe(false);
  });

  it('keeps devices apart', () => {
    expect(acceptInput('s:a', 1)).toBe(true);
    expect(acceptInput('s:b', 1)).toBe(true);
  });
});
