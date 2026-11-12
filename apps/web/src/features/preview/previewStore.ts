import { parseLocalUrl, previewKey } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';
import {
  activeTab,
  addTab,
  closeTab,
  firstTabs,
  withBrowserTabs,
  type PreviewTabs,
} from './previewTabs';
import { shareBrowserTabs } from './tabSync';

export interface PreviewState {
  history: string[];
  index: number;
  reloadKey: number;
}

interface PreviewStore {
  byId: Record<string, PreviewState>;
  /** Per session; one not listed has a single tab (see tabsOf). */
  tabs: Record<string, PreviewTabs>;
  addTab(sessionId: string): void;
  /** A tab of its own at this address; false when the address is not a local page. */
  openInNewTab(sessionId: string, url: string): boolean;
  selectTab(sessionId: string, n: number): void;
  closeTab(sessionId: string, n: number): void;
  open(sessionId: string, url: string): boolean;
  back(sessionId: string): void;
  forward(sessionId: string): void;
  reload(sessionId: string): void;
  /** The browser tabs the deck says this session has (from another device, or on load). */
  applyServerTabs(sessionId: string, numbers: readonly number[]): void;
}

const EMPTY: PreviewState = { history: [], index: -1, reloadKey: 0 };
export const currentUrl = (state: PreviewState | undefined): string | null =>
  state?.history[state.index] ?? null;

/** Localhost only, and never the deck itself (an embedded deck could escape the sandbox). */
export function previewable(url: string, deckOrigin: string): string | null {
  const safe = parseLocalUrl(url);
  if (safe === null) return null;
  return new URL(safe).origin === deckOrigin ? null : safe;
}

export const usePreview = create<PreviewStore>()((set, get) => {
  const update = (id: string, fn: (s: PreviewState) => PreviewState): void =>
    set({ byId: { ...get().byId, [id]: fn(get().byId[id] ?? EMPTY) } });
  const setTabs = (sessionId: string, fn: (tabs: PreviewTabs) => PreviewTabs): void => {
    const before = tabsOf(get().tabs, sessionId);
    const after = fn(before);
    set({ tabs: { ...get().tabs, [sessionId]: after } });
    shareBrowserTabs(sessionId, before, after);
  };
  return {
    byId: {},
    tabs: {},
    addTab: (sessionId) => setTabs(sessionId, addTab),
    selectTab: (sessionId, n) => setTabs(sessionId, (tabs) => ({ ...tabs, active: n })),
    closeTab(sessionId, n) {
      // A closed browser tab frees its page in the deck's Chromium too.
      const before = tabsOf(get().tabs, sessionId);
      if (before.list.includes(n)) {
        void api.browserClose(previewKey(sessionId, n)).catch(() => undefined);
      }
      setTabs(sessionId, (tabs) => closeTab(tabs, n));
      // A tab opened later with this number starts empty.
      const gone = previewKey(sessionId, n);
      set({ byId: Object.fromEntries(Object.entries(get().byId).filter(([key]) => key !== gone)) });
    },
    open(sessionId, url) {
      const safe = previewable(url, window.location.origin);
      if (safe === null) return false;
      // The link goes to the tab being shown.
      const key = previewKey(sessionId, activeTab(tabsOf(get().tabs, sessionId)));
      update(key, (s) =>
        s.history[s.index] === safe
          ? s
          : { ...s, history: [...s.history.slice(0, s.index + 1), safe], index: s.index + 1 },
      );
      return true;
    },
    openInNewTab(sessionId, url) {
      if (previewable(url, window.location.origin) === null) return false;
      get().addTab(sessionId);
      return get().open(sessionId, url);
    },
    back: (id) => update(id, (s) => ({ ...s, index: Math.max(s.index - 1, 0) })),
    forward: (id) =>
      update(id, (s) => ({ ...s, index: Math.min(s.index + 1, s.history.length - 1) })),
    reload: (id) => update(id, (s) => ({ ...s, reloadKey: s.reloadKey + 1 })),
    applyServerTabs: (sessionId, numbers) =>
      set({
        tabs: {
          ...get().tabs,
          [sessionId]: withBrowserTabs(tabsOf(get().tabs, sessionId), numbers),
        },
      }),
  };
});

/** A session's tabs: what was set, else one tab. */
export const tabsOf = (tabs: Record<string, PreviewTabs>, sessionId: string): PreviewTabs =>
  tabs[sessionId] ?? firstTabs();
