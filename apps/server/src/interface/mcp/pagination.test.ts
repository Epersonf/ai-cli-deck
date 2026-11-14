import { describe, expect, it } from 'vitest';
import { pageItems, pageText } from './pagination.js';

describe('bounded model-facing responses', () => {
  it('retrieves all text through continuation offsets without splitting unicode', () => {
    const text = 'a😀b漢字'.repeat(100);
    let offset = 0;
    let result = '';
    for (;;) {
      const page = pageText(text, offset, 17);
      expect(page.text.length).toBeLessThanOrEqual(17);
      expect(page.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      result += page.text;
      if (page.nextOffset === null) break;
      expect(page.nextOffset).toBeGreaterThan(offset);
      offset = page.nextOffset;
    }
    expect(result).toBe(text);
  });

  it('keeps all list items accessible and handles out-of-range offsets', () => {
    expect(pageItems(['a', 'b', 'c'], 1, 1)).toEqual({ items: ['b'], total: 3, nextOffset: 2 });
    expect(pageItems(['a'], 10, 5)).toEqual({ items: [], total: 1, nextOffset: null });
    expect(pageText('a😀', 1, 2)).toEqual({ text: '😀', offset: 1, total: 3, nextOffset: null });
  });
});
