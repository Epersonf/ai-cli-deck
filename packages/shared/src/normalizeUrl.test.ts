import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './normalizeUrl.js';

describe('normalizeUrl', () => {
  it('expands bare ports and host:port shorthands', () => {
    expect(normalizeUrl('3000')).toBe('http://localhost:3000');
    expect(normalizeUrl(':5173/app')).toBe('http://localhost:5173/app');
    expect(normalizeUrl(' localhost:8080 ')).toBe('http://localhost:8080');
  });

  it('keeps full URLs untouched', () => {
    expect(normalizeUrl('https://127.0.0.1:8443/x')).toBe('https://127.0.0.1:8443/x');
  });
});
