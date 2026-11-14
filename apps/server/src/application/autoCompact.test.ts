import { describe, expect, it } from 'vitest';
import { parseAutoCompact } from './autoCompact.js';

describe('the auto-compact note', () => {
  it('reads never, a token count, and nothing', () => {
    expect(parseAutoCompact('off')).toBe('off');
    expect(parseAutoCompact('150000')).toBe(150_000);
    expect(parseAutoCompact('')).toBeNull();
    expect(parseAutoCompact(undefined)).toBeNull();
  });

  it('ignores a note that is not a sensible value', () => {
    expect(parseAutoCompact('soon')).toBeNull();
    expect(parseAutoCompact('12')).toBeNull();
  });
});
