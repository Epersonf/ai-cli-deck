import { PREVIEW_TABS_MAX } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import {
  activeTab,
  addTab,
  browserNumbers,
  closeTab,
  firstTabs,
  showMode,
  withBrowserTabs,
} from './previewTabs';

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

describe('shared browser tabs', () => {
  const mine = { list: [{ n: 1, mode: 'frame' as const }], active: 1 };

  it('adds the shared tabs and moves an iframe tab out of their way', () => {
    const next = withBrowserTabs(mine, [1, 2], 'frame');
    expect(next.list).toEqual([
      { n: 1, mode: 'browser' },
      { n: 2, mode: 'browser' },
      { n: 3, mode: 'frame' },
    ]);
    expect(browserNumbers(next)).toEqual([1, 2]);
    expect(next.list.some((tab) => tab.n === next.active)).toBe(true);
  });

  it('never ends up empty', () => {
    const only = { list: [{ n: 2, mode: 'browser' as const }], active: 2 };
    expect(withBrowserTabs(only, [], 'frame')).toEqual({
      list: [{ n: 1, mode: 'frame' }],
      active: 1,
    });
  });
});
