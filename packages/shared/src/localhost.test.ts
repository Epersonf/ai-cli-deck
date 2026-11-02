import { describe, expect, it } from 'vitest';
import { isLocalUrl, parseLocalUrl } from './localhost.js';

describe('parseLocalUrl', () => {
  it('accepts localhost, 127.0.0.1 and ::1 over http(s)', () => {
    expect(isLocalUrl('http://localhost:3000')).toBe(true);
    expect(isLocalUrl('https://127.0.0.1:8443/x')).toBe(true);
    expect(isLocalUrl('http://[::1]:5173/')).toBe(true);
  });

  it('rejects remote hosts and lookalikes', () => {
    expect(isLocalUrl('http://example.com')).toBe(false);
    expect(isLocalUrl('http://localhost.evil.com')).toBe(false);
    expect(isLocalUrl('http://127.0.0.1.evil.com')).toBe(false);
  });

  it('rejects other schemes and credentials', () => {
    expect(isLocalUrl('javascript:alert(1)')).toBe(false);
    expect(isLocalUrl('file:///etc/passwd')).toBe(false);
    expect(isLocalUrl('http://user:pw@localhost:3000')).toBe(false);
  });

  it('rejects garbage', () => {
    expect(parseLocalUrl('not a url')).toBeNull();
  });
});
