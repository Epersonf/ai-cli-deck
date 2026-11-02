import { describe, expect, it } from 'vitest';
import { safeFileName } from './upload.js';

describe('safeFileName', () => {
  it('keeps plain names and strips any folder part', () => {
    expect(safeFileName('photo.png')).toBe('photo.png');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\temp\\a.txt')).toBe('a.txt');
  });

  it('rejects empty and dot-only names', () => {
    expect(() => safeFileName('..')).toThrow();
    expect(() => safeFileName('   ')).toThrow();
  });
});
