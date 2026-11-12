import { PREVIEW_TABS_MAX } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { activeTab, addTab, closeTab, firstTabs, withBrowserTabs } from './previewTabs';

describe('preview tabs', () => {
  it('starts with one tab', () => {
    expect(firstTabs()).toEqual({ list: [1], active: 1 });
  });

  it('adds a tab, shows it, and gives it the lowest free number', () => {
    const three = addTab(addTab(firstTabs()));
    expect(three).toEqual({ list: [1, 2, 3], active: 3 });
    expect(addTab(closeTab(three, 2)).list).toEqual([1, 3, 2]);
  });

  it('stops adding at the limit', () => {
    let tabs = firstTabs();
    for (let i = 0; i < PREVIEW_TABS_MAX + 3; i += 1) tabs = addTab(tabs);
    expect(tabs.list).toHaveLength(PREVIEW_TABS_MAX);
  });

  it('closes a tab and shows its neighbour, but never the last tab', () => {
    const tabs = addTab(addTab(firstTabs())); // 1, 2, 3 (3 shown)
    expect(closeTab(tabs, 3).active).toBe(2);
    expect(closeTab({ ...tabs, active: 1 }, 3).active).toBe(1);
    expect(closeTab(firstTabs(), 1).list).toEqual([1]);
    expect(activeTab(closeTab(tabs, 99))).toBe(3);
  });
});

describe('shared browser tabs', () => {
  it('follows the numbers the deck shares', () => {
    expect(withBrowserTabs({ list: [1], active: 1 }, [3, 2, 3])).toEqual({
      list: [2, 3],
      active: 2,
    });
  });

  it('never ends up empty', () => {
    expect(withBrowserTabs({ list: [2], active: 2 }, [])).toEqual(firstTabs());
  });
});
