import { describe, expect, it } from 'vitest';
import { PREVIEW_TABS_MAX, previewKey, sessionOfPreviewKey } from './browserProtocol.js';

describe('preview keys', () => {
  it('uses the session id itself for the first tab and "~n" for the others', () => {
    expect(previewKey('s1', 1)).toBe('s1');
    expect(previewKey('s1', 3)).toBe('s1~3');
  });

  it('finds the session of a key, whatever the tab', () => {
    expect(sessionOfPreviewKey('s1')).toBe('s1');
    expect(sessionOfPreviewKey('s1~2')).toBe('s1');
    expect(sessionOfPreviewKey(previewKey('abc-123', PREVIEW_TABS_MAX))).toBe('abc-123');
  });

  it('refuses keys that would open a page nobody can reach', () => {
    expect(sessionOfPreviewKey('')).toBeNull();
    expect(sessionOfPreviewKey('~2')).toBeNull();
    expect(sessionOfPreviewKey('s1~1')).toBeNull();
    expect(sessionOfPreviewKey(`s1~${PREVIEW_TABS_MAX + 1}`)).toBeNull();
    expect(sessionOfPreviewKey('s1~02')).toBeNull();
    expect(sessionOfPreviewKey('s1~x')).toBeNull();
  });
});
