import { describe, expect, it } from 'vitest';
import { BrowserTabs } from './BrowserTabs';

describe('BrowserTabs', () => {
  it('keeps a clean, sorted list per session and tells listeners only about changes', () => {
    const tabs = new BrowserTabs();
    const seen: string[] = [];
    tabs.subscribe((id, list) => seen.push(`${id}:${list.join()}`));
    expect(tabs.get('s')).toBeNull();
    expect(tabs.set('s', [3, 1, 1, 99, 0, 2.5])).toEqual([1, 3]);
    tabs.set('s', [1, 3]);
    tabs.set('s', []);
    expect(seen).toEqual(['s:1,3', 's:']);
    expect(tabs.get('s')).toEqual([]);
  });
});
