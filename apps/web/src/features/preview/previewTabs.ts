import { PREVIEW_TABS_MAX } from '@deck/shared';

/** A session's preview tabs, each one a page of the deck's own browser; `n` names its page on the server. */
export interface PreviewTabs {
  list: number[];
  active: number;
}

export const firstTabs = (): PreviewTabs => ({ list: [1], active: 1 });

/** The tab being shown (the first one when `active` names none). */
export const activeTab = (tabs: PreviewTabs): number =>
  tabs.list.includes(tabs.active) ? tabs.active : (tabs.list[0] ?? 1);

/** A new tab next to the others, shown, with the lowest free number. Past the limit nothing changes. */
export function addTab(tabs: PreviewTabs): PreviewTabs {
  if (tabs.list.length >= PREVIEW_TABS_MAX) return tabs;
  let n = 1;
  while (tabs.list.includes(n)) n += 1;
  return { list: [...tabs.list, n], active: n };
}

/** Closes a tab (the last one is replaced by an empty tab). The tab before it, or the first, is shown when it was the active one. */
export function closeTab(tabs: PreviewTabs, n: number): PreviewTabs {
  const index = tabs.list.indexOf(n);
  if (index < 0) return tabs;
  if (tabs.list.length <= 1) return firstTabs();
  const list = tabs.list.filter((tab) => tab !== n);
  if (tabs.active !== n) return { ...tabs, list };
  return { list, active: list[Math.max(0, index - 1)] ?? list[0] ?? 1 };
}

/**
 * The list the deck says every device shares. Never empty, and `active` always names a tab that exists
 * (this also drops anything else an older version kept, such as iframe tabs).
 */
export function withBrowserTabs(tabs: PreviewTabs, numbers: readonly number[]): PreviewTabs {
  const list = [...new Set(numbers)].sort((a, b) => a - b);
  if (list.length === 0) return firstTabs();
  return { list, active: list.includes(tabs.active) ? tabs.active : (list[0] ?? 1) };
}
