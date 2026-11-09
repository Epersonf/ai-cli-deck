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

/** Closes a tab (the last one is replaced by an empty tab). The tab before it, or the first, is shown when it was the active one. */
export function closeTab(tabs: PreviewTabs, n: number): PreviewTabs {
  const index = tabs.list.findIndex((tab) => tab.n === n);
  if (index < 0) return tabs;
  // The last tab is replaced by an empty one on this device (a browser tab becomes an iframe one).
  if (tabs.list.length <= 1) return firstTabs('frame');
  const list = tabs.list.filter((tab) => tab.n !== n);
  if (tabs.active !== n) return { ...tabs, list };
  return { list, active: (list[Math.max(0, index - 1)] ?? list[0])?.n ?? 1 };
}

/** Shows the first tab of `mode`, opening one when there is none. */
export function showMode(tabs: PreviewTabs, mode: PreviewMode): PreviewTabs {
  const found = tabs.list.find((tab) => tab.mode === mode);
  return found ? { ...tabs, active: found.n } : addTab(tabs, mode);
}

/** The numbers of the browser tabs: the part of the list that every device shares. */
export const browserNumbers = (tabs: PreviewTabs): number[] =>
  tabs.list.filter((tab) => tab.mode === 'browser').map((tab) => tab.n);

/**
 * The list with its browser tabs replaced by the shared ones (`numbers`); this device's iframe tabs stay, moved to
 * another number when a shared tab took theirs. Never empty, and `active` always names a tab that exists.
 */
export function withBrowserTabs(
  tabs: PreviewTabs,
  numbers: readonly number[],
  fallback: PreviewMode,
): PreviewTabs {
  const taken = new Set(numbers);
  const kept = tabs.list.filter((tab) => tab.mode === 'frame');
  const frames: PreviewTab[] = [];
  for (const tab of kept) {
    let n = tab.n;
    while (taken.has(n) || frames.some((f) => f.n === n)) n += 1;
    frames.push({ n, mode: 'frame' });
  }
  const list = [...numbers.map((n): PreviewTab => ({ n, mode: 'browser' })), ...frames].sort(
    (a, b) => a.n - b.n,
  );
  if (list.length === 0) return firstTabs(fallback);
  const active = list.some((tab) => tab.n === tabs.active) ? tabs.active : (list[0]?.n ?? 1);
  return { list, active };
}
