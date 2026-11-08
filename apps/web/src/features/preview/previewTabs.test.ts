import { PREVIEW_TABS_MAX } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { activeTab, addTab, closeTab, firstTabs, showMode } from './previewTabs';

describe('preview tabs', () => {
  it('starts with one tab of the chosen mode', () => {
    expect(firstTabs('browser')).toEqual({ list: [{ n: 1, mode: 'browser' }], active: 1 });
  });

  it('adds a tab, shows it, and gives it the lowest free number', () => {
    const two = addTab(firstTabs('frame'), 'browser');
    expect(two.list.map((t) => `${t.n}:${t.mode}`)).toEqual(['1:frame', '2:browser']);
    expect(two.active).toBe(2);
    const three = addTab(two, 'browser');
    const without = closeTab(three, 2);
    expect(addTab(without, 'frame').list.map((t) => t.n)).toEqual([1, 3, 2]);
  });

  it('stops adding at the limit', () => {
    let tabs = firstTabs('frame');
    for (let i = 0; i < PREVIEW_TABS_MAX + 3; i += 1) tabs = addTab(tabs, 'browser');
    expect(tabs.list).toHaveLength(PREVIEW_TABS_MAX);
  });

  it('closes a tab and shows its neighbour, but never the last tab', () => {
    const tabs = addTab(addTab(firstTabs('frame'), 'browser'), 'browser'); // 1, 2, 3 (3 shown)
    expect(closeTab(tabs, 3).active).toBe(2);
    expect(closeTab({ ...tabs, active: 1 }, 3).active).toBe(1);
    expect(closeTab(firstTabs('frame'), 1).list).toHaveLength(1);
    expect(activeTab(closeTab(tabs, 99))).toEqual({ n: 3, mode: 'browser' });
  });

  it('shows the first tab of a mode, or opens one', () => {
    const tabs = addTab(firstTabs('frame'), 'browser'); // 2 shown
    expect(showMode(tabs, 'frame').active).toBe(1);
    expect(showMode(firstTabs('frame'), 'browser').list).toHaveLength(2);
  });
});
