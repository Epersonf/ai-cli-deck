import { PREVIEW_TABS_MAX } from '@deck/shared';

/** `frame`: the page in an iframe on this device (fast). `browser`: the deck's Chromium, which the agent drives too. */
export type PreviewMode = 'frame' | 'browser';

/** One tab of a session's preview. `n` is stable while the tab lives and names its page on the server. */
export interface PreviewTab {
  n: number;
  mode: PreviewMode;
}

export interface PreviewTabs {
  list: PreviewTab[];
  active: number;
}

export const firstTabs = (mode: PreviewMode): PreviewTabs => ({
  list: [{ n: 1, mode }],
  active: 1,
});

export const activeTab = (tabs: PreviewTabs): PreviewTab =>
  tabs.list.find((tab) => tab.n === tabs.active) ?? tabs.list[0] ?? { n: 1, mode: 'frame' };

/** A new tab of `mode`, next to the others and shown. Past the limit nothing changes. */
export function addTab(tabs: PreviewTabs, mode: PreviewMode): PreviewTabs {
  if (tabs.list.length >= PREVIEW_TABS_MAX) return tabs;
  const used = new Set(tabs.list.map((tab) => tab.n));
  let n = 1;
  while (used.has(n)) n += 1;
  return { list: [...tabs.list, { n, mode }], active: n };
}

/** Closes a tab (the last one stays). The tab before it, or the first, is shown when it was the active one. */
export function closeTab(tabs: PreviewTabs, n: number): PreviewTabs {
  const index = tabs.list.findIndex((tab) => tab.n === n);
  if (index < 0 || tabs.list.length <= 1) return tabs;
  const list = tabs.list.filter((tab) => tab.n !== n);
  if (tabs.active !== n) return { ...tabs, list };
  return { list, active: (list[Math.max(0, index - 1)] ?? list[0])?.n ?? 1 };
}

/** Shows the first tab of `mode`, opening one when there is none. */
export function showMode(tabs: PreviewTabs, mode: PreviewMode): PreviewTabs {
  const found = tabs.list.find((tab) => tab.mode === mode);
  return found ? { ...tabs, active: found.n } : addTab(tabs, mode);
}
